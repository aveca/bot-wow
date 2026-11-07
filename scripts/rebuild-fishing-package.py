#!/usr/bin/env python3
"""Rebuild Casinobabe Fishing Assistant 1.2.1 from a clean checkout.

Source decision, 2026-11-07:
  aveca/Casinobabe main (e76de1ee) is not the fishing package. Its addon
  toc is still version 1.0.38, describes a gold-casino panel, and does not
  load CasinobabeFishing.lua.
  The fishing branch tip is 257418c9a0c2c489a01226e8065ac9c8eaded954.
  That commit still labels the toc 1.0.38. This script applies one
  documented toc correction before the upstream packager runs.

The zip is then normalized (fixed timestamps, sorted names, deflate level 6)
so two runs produce the same SHA-256. Python 3.12 was used for the
published hash.

Usage:
  git clone --depth 1 --branch feat/fishing-route-intelligence-v2 \\
    https://github.com/aveca/Casinobabe.git /tmp/casinobabe
  # HEAD must be 257418c9a0c2c489a01226e8065ac9c8eaded954
  python3 scripts/rebuild-fishing-package.py /tmp/casinobabe /tmp/out.zip
"""
import hashlib
import importlib.util
import pathlib
import shutil
import sys
import time
import zipfile

COMMIT = "257418c9a0c2c489a01226e8065ac9c8eaded954"
VERSION = "1.2.1"
FIXED_TIME = "2026-10-22T02:18:01"
ZIP_DATE = (2026, 10, 22, 2, 18, 1)
OLD_NOTES = (
    "## Notes: Interactive customer panel for the Casinobabe gold casino - "
    "live balance, one-click bets, cashback, and a center action pop-up."
)
NEW_NOTES = (
    "## Notes: Casinobabe Fishing Assistant. Desktop package and in-game "
    "fishing helper for Interface 20506."
)


def prepare(src: pathlib.Path, dest: pathlib.Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns(".git"))
    toc = dest / "runtime-addon/Casinobabe/Casinobabe.toc"
    text = toc.read_text(encoding="utf-8")
    if OLD_NOTES not in text or "## Version: 1.0.38" not in text:
        raise SystemExit("toc does not match 257418c; refusing to patch")
    text = text.replace(OLD_NOTES, NEW_NOTES, 1)
    text = text.replace("## Version: 1.0.38", "## Version: 1.2.1", 1)
    if "1.0.38" in text or "CasinobabeFishing.lua" not in text:
        raise SystemExit("toc patch failed")
    toc.write_text(text, encoding="utf-8", newline="\n")


def normalize(src_zip: pathlib.Path, dest: pathlib.Path) -> None:
    with zipfile.ZipFile(src_zip) as zin, zipfile.ZipFile(dest, "w") as zout:
        for info in sorted(zin.infolist(), key=lambda item: item.filename):
            data = zin.read(info.filename)
            new = zipfile.ZipInfo(filename=info.filename, date_time=ZIP_DATE)
            new.compress_type = zipfile.ZIP_DEFLATED
            new.external_attr = 0o644 << 16
            new.create_system = 3
            zout.writestr(new, data, compresslevel=6)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: rebuild-fishing-package.py <casinobabe checkout> <out.zip>", file=sys.stderr)
        return 2
    src = pathlib.Path(sys.argv[1]).resolve()
    out = pathlib.Path(sys.argv[2]).resolve()
    head = src / ".git"
    work = pathlib.Path("/tmp/fish-rebuild-src")
    prepare(src, work)
    spec = importlib.util.spec_from_file_location(
        "build_desktop_package", work / "scripts/build_desktop_package.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    original = time.strftime
    time.strftime = lambda fmt, t=None: (
        FIXED_TIME if fmt == "%Y-%m-%dT%H:%M:%S"
        else "20261022-021801" if fmt == "%Y%m%d-%H%M%S"
        else original(fmt, t)
    )
    dist = pathlib.Path("/tmp/fish-rebuild-dist")
    if dist.exists():
        shutil.rmtree(dist)
    zip_path, _manifest = mod.build(VERSION, str(dist))
    time.strftime = original
    out.parent.mkdir(parents=True, exist_ok=True)
    normalize(pathlib.Path(zip_path), out)
    blob = out.read_bytes()
    print(COMMIT)
    print(len(blob))
    print(hashlib.sha256(blob).hexdigest())
    print("git dir present" if head.exists() else "copied tree (git optional)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
