#!/usr/bin/env python3
"""Verify a BOT-WOW package archive before installation.

The manifest intentionally excludes MANIFEST.json itself. All other regular
files must be declared and match both their recorded size and SHA-256.
A QA candidate is accepted only with the explicit --allow-qa flag; that flag
never turns a QA candidate into a release.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
from pathlib import Path, PurePosixPath

ROOT_LEVEL_FILES = {"VERSION", "RELEASE-NOTES.md"}


class VerificationError(Exception):
    pass


def fail(message: str) -> int:
    print("PACKAGE VERIFICATION FAILED: " + message, file=sys.stderr)
    return 1


def checked_relative_path(value: object) -> PurePosixPath:
    if not isinstance(value, str) or not value:
        raise VerificationError("manifest contains an empty or non-string path")
    if "\\" in value or ":" in value:
        raise VerificationError("unsafe manifest path: " + value)
    path = PurePosixPath(value)
    if path.is_absolute() or path.as_posix() != value:
        raise VerificationError("non-canonical manifest path: " + value)
    if any(part in ("", ".", "..") for part in path.parts):
        raise VerificationError("path traversal in manifest: " + value)
    if value == "MANIFEST.json":
        raise VerificationError("MANIFEST.json cannot hash itself")
    return path


def require_regular_file(path: Path, description: str) -> None:
    try:
        mode = path.lstat().st_mode
    except OSError as exc:
        raise VerificationError(description + " is missing or unreadable: " + str(exc)) from exc
    if stat.S_ISLNK(mode):
        raise VerificationError(description + " must not be a symbolic link")
    if not stat.S_ISREG(mode):
        raise VerificationError(description + " is not a regular file")


def digest_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            digest.update(chunk)
    return size, digest.hexdigest()


def archive_inventory(root: Path) -> set[str]:
    found: set[str] = set()
    for current, directories, files in os.walk(root, topdown=True, followlinks=False):
        current_path = Path(current)
        for name in list(directories):
            child = current_path / name
            if child.is_symlink():
                raise VerificationError("symbolic link in archive: " + child.relative_to(root).as_posix())
            if not child.is_dir():
                raise VerificationError("non-directory archive entry: " + child.relative_to(root).as_posix())
        for name in files:
            child = current_path / name
            relative = child.relative_to(root).as_posix()
            if relative == "MANIFEST.json":
                continue
            require_regular_file(child, "archive entry " + relative)
            found.add(relative)
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-qa",
        action="store_true",
        help="allow integrity verification of an internal QA candidate; never authorizes release",
    )
    args = parser.parse_args()

    script = Path(__file__).absolute()
    package_root = script.parent
    archive_root = package_root.parent

    try:
        if package_root.is_symlink() or not package_root.is_dir():
            raise VerificationError("package directory is missing or is a symbolic link")
        manifest_path = archive_root / "MANIFEST.json"
        require_regular_file(manifest_path, "MANIFEST.json")
        with manifest_path.open("r", encoding="utf-8") as stream:
            manifest = json.load(stream)

        if not isinstance(manifest, dict) or not isinstance(manifest.get("files"), dict):
            raise VerificationError("invalid manifest structure")
        if not isinstance(manifest.get("version"), str) or not manifest["version"]:
            raise VerificationError("manifest version is missing")
        if not isinstance(manifest.get("distribution"), dict):
            raise VerificationError("distribution rights metadata is missing")

        distribution = manifest["distribution"]
        mode = distribution.get("mode")
        eligible = distribution.get("eligible")
        unresolved = distribution.get("unresolvedRights")
        if distribution.get("sourceRepositoryMatches") is not True:
            raise VerificationError("source repository provenance is not verified")
        if distribution.get("sourceCommitMatches") is not True:
            raise VerificationError("source commit provenance is not verified")

        if mode == "release":
            if (
                eligible is not True
                or type(unresolved) is not int
                or unresolved != 0
            ):
                raise VerificationError("release manifest is not eligible")
        elif mode == "qa":
            if (
                eligible is not False
                or type(unresolved) is not int
                or unresolved <= 0
            ):
                raise VerificationError("QA manifest has inconsistent rights status")
            if not args.allow_qa:
                raise VerificationError("QA-only package; refusing installation without --allow-qa")
        else:
            raise VerificationError("unknown distribution mode: " + str(mode))

        version_path = archive_root / "VERSION"
        require_regular_file(version_path, "VERSION")
        if version_path.read_text(encoding="utf-8").strip() != manifest["version"]:
            raise VerificationError("VERSION does not match manifest version")

        records = manifest["files"]
        if not records:
            raise VerificationError("manifest file inventory is empty")

        expected_archive_paths: set[str] = set()
        for key, record in records.items():
            relative = checked_relative_path(key)
            if not isinstance(record, dict):
                raise VerificationError("invalid file record: " + key)
            expected_hash = record.get("sha256")
            expected_size = record.get("bytes")
            if not isinstance(expected_hash, str) or len(expected_hash) != 64:
                raise VerificationError("invalid SHA-256 in manifest: " + key)
            try:
                int(expected_hash, 16)
            except ValueError as exc:
                raise VerificationError("non-hex SHA-256 in manifest: " + key) from exc
            if not isinstance(expected_size, int) or isinstance(expected_size, bool) or expected_size < 0:
                raise VerificationError("invalid byte count in manifest: " + key)

            if key in ROOT_LEVEL_FILES:
                target = archive_root.joinpath(*relative.parts)
                archive_key = key
            else:
                target = package_root.joinpath(*relative.parts)
                archive_key = "package/" + key

            cursor = target
            while cursor != archive_root and cursor != package_root:
                if cursor.exists() or cursor.is_symlink():
                    if cursor.is_symlink():
                        raise VerificationError("symbolic link in manifest path: " + key)
                cursor = cursor.parent

            require_regular_file(target, "manifest file " + key)
            actual_size, actual_hash = digest_file(target)
            if actual_size != expected_size:
                raise VerificationError(
                    "byte count mismatch for " + key
                    + ": expected " + str(expected_size) + ", got " + str(actual_size)
                )
            if actual_hash != expected_hash.lower():
                raise VerificationError("SHA-256 mismatch for " + key)
            expected_archive_paths.add(archive_key)

        if "verify-package.py" not in records:
            raise VerificationError("verifier is not covered by MANIFEST.json")

        actual_archive_paths = archive_inventory(archive_root)
        missing = sorted(expected_archive_paths - actual_archive_paths)
        extra = sorted(actual_archive_paths - expected_archive_paths)
        if missing:
            raise VerificationError("manifested files missing from archive: " + ", ".join(missing))
        if extra:
            raise VerificationError("unmanifested files in archive: " + ", ".join(extra))

        if mode == "qa":
            print(
                "PACKAGE INTEGRITY OK — QA ONLY; not authorized for customer distribution "
                + "(unresolved rights: " + str(unresolved) + ")."
            )
        else:
            print(
                "PACKAGE INTEGRITY OK — files match the manifest; the manifest claims release mode "
                "for version " + manifest["version"] + ". No publisher signature is verified."
            )
        return 0
    except (OSError, ValueError, VerificationError) as exc:
        return fail(str(exc))


if __name__ == "__main__":
    raise SystemExit(main())
