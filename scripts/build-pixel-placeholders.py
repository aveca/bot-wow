#!/usr/bin/env python3
"""Placeholders pixel (PNG + GIF) pour la vitrine. Aucune dépendance."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets" / "pixel"

# Indices de palette (0 = transparent).
PAL = [
    (0, 0, 0),
    (11, 16, 32),
    (255, 194, 75),
    (62, 224, 255),
    (179, 136, 255),
    (47, 224, 138),
    (255, 107, 107),
    (244, 246, 255),
    (26, 35, 64),
    (255, 157, 47),
    (18, 28, 58),
    (90, 200, 255),
    (40, 48, 80),
    (255, 230, 160),
    (20, 24, 48),
    (80, 90, 130),
]
CHAR = {
    ".": 0,
    "#": 1,
    "G": 2,
    "C": 3,
    "V": 4,
    "E": 5,
    "R": 6,
    "W": 7,
    "B": 8,
    "O": 9,
    "D": 10,
    "A": 11,
    "P": 12,
    "Y": 13,
    "N": 14,
    "M": 15,
}

BUDDY = [
    "........................",
    ".........GGGGGG........",
    ".......GGYYYYYYGG......",
    "......GYYYYYYYYYYG.....",
    ".....GYYYWWYYWWYYYG....",
    ".....GYYYWWYYWWYYYG....",
    ".....GYYYYYYYYYYYYG....",
    "......GYYYYYYYYYYG.....",
    ".......GGGGGGGGGG......",
    "......OO.GGGGGG.OO.....",
    ".....OOO.GCCCCG.OOO....",
    ".....OO..GCCCCG..OO....",
    "..........CCCC.........",
    ".........CCCCCC........",
    "........CC.CC.CC.......",
    ".......EE..EE..EE......",
    "......EEE..EE..EEE.....",
    ".......EE......EE......",
    "........E......E.......",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
]

BUDDY_BLINK = [
    row.replace("WW", "CC") if "WW" in row else row for row in BUDDY
]


def shift_up(rows):
    blank = "." * len(rows[0])
    return [blank] + rows[:-1]


def normalize(rows):
    width = max(len(row) for row in rows)
    return [row.ljust(width, ".") for row in rows]


def parse(rows):
    return [[CHAR[ch] for ch in row] for row in normalize(rows)]


def scale(grid, factor):
    out = []
    for row in grid:
        wide = []
        for idx in row:
            wide.extend([idx] * factor)
        for _ in range(factor):
            out.append(wide)
    return out


def png_bytes(grid):
    h = len(grid)
    w = len(grid[0])
    raw = bytearray()
    for row in grid:
        raw.append(0)
        for idx in row:
            r, g, b = PAL[idx]
            a = 0 if idx == 0 else 255
            raw.extend((r, g, b, a))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def lzw(indices, min_code_size):
    clear = 1 << min_code_size
    eoi = clear + 1
    code_size = min_code_size + 1
    next_code = eoi + 1
    table = {bytes([i]): i for i in range(clear)}
    bits = []

    def write(code, size):
        for i in range(size):
            bits.append((code >> i) & 1)

    write(clear, code_size)
    width = b""
    for value in indices:
        key = bytes([value])
        joined = width + key
        if joined in table:
            width = joined
            continue
        write(table[width], code_size)
        if next_code < 4096:
            table[joined] = next_code
            next_code += 1
            if next_code == (1 << code_size) and code_size < 12:
                code_size += 1
        else:
            write(clear, code_size)
            table = {bytes([i]): i for i in range(clear)}
            code_size = min_code_size + 1
            next_code = eoi + 1
        width = key
    if width:
        write(table[width], code_size)
    write(eoi, code_size)
    packed = bytearray()
    acc = 0
    nbits = 0
    for bit in bits:
        acc |= bit << nbits
        nbits += 1
        if nbits == 8:
            packed.append(acc)
            acc = 0
            nbits = 0
    if nbits:
        packed.append(acc)
    blocks = bytearray([min_code_size])
    i = 0
    while i < len(packed):
        chunk = packed[i : i + 255]
        blocks.append(len(chunk))
        blocks.extend(chunk)
        i += 255
    blocks.append(0)
    return bytes(blocks)


def gif_bytes(frames, delay_cs=16):
    h = len(frames[0])
    w = len(frames[0][0])
    n = 4  # 16 couleurs
    pal = PAL[:]
    while len(pal) < 16:
        pal.append((0, 0, 0))
    buf = bytearray(b"GIF89a")
    buf += struct.pack("<HH", w, h)
    buf += bytes([0x80 | (n - 1), 0, 0])
    for r, g, b in pal:
        buf += bytes((r, g, b))
    buf += b"!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00"
    for frame in frames:
        buf += b"!\xf9\x04"
        buf += bytes([0x09, delay_cs & 255, (delay_cs >> 8) & 255, 0, 0])
        buf += b","
        buf += struct.pack("<HHHH", 0, 0, w, h)
        buf += bytes([0])
        flat = [pix for row in frame for pix in row]
        buf += lzw(flat, n)
    buf += b";"
    return bytes(buf)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    factor = 8
    base = scale(parse(BUDDY), factor)
    blink = scale(parse(BUDDY_BLINK), factor)
    bob = scale(parse(shift_up(BUDDY)), factor)
    bob_blink = scale(parse(shift_up(BUDDY_BLINK)), factor)
    (ROOT / "buddy.png").write_bytes(png_bytes(base))
    (ROOT / "buddy.gif").write_bytes(gif_bytes([base, bob, blink, bob_blink], 18))
    print(f"wrote {(ROOT / 'buddy.png').stat().st_size} png, {(ROOT / 'buddy.gif').stat().st_size} gif")


if __name__ == "__main__":
    main()
