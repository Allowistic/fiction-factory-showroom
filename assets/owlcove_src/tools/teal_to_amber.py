#!/usr/bin/env python3
"""Recolor teal glow to amber inside a binary glTF (.glb) file.

Materials whose names contain "teal" (any case) get
pbrMetallicRoughness.baseColorFactor set to the linear RGBA of #e8a04a,
[0.806952, 0.351533, 0.068478, 1.0]. When emissiveFactor is present, it is
replaced with that same amber RGB scaled so its max channel equals the old
max channel. --rename-material OLD=NEW renames a teal material when its
current name equals OLD.

Embedded PNG/JPEG images (those referenced by a bufferView) are decoded and
any teal pixel — HSV hue 160–200°, saturation > 0.35, value > 0.25 — has its
hue moved to the hue of #e8a04a (~32°). Saturation, value, and alpha stay.
An image is rewritten only when it actually contains teal pixels. Every other
bufferView is copied byte-for-byte. If an image is rewritten, bufferViews are
repacked on 4-byte alignment and buffers[0].byteLength is updated.

Geometry, nodes, joints, skins, animations, material count, and draw count
are not modified. extensionsUsed / extensionsRequired are left in place.
KHR_draco_mesh_compression and KHR_materials_unlit are preserved.

Usage:
  python3 teal_to_amber.py IN.glb OUT.glb [--rename-material OLD=NEW ...] [--dry-run]
"""

from __future__ import annotations

import argparse
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

GLB_MAGIC = 0x46546C67  # b"glTF"
CHUNK_JSON = 0x4E4F534A  # b"JSON"
CHUNK_BIN = 0x004E4942  # b"BIN\0"

# Linear RGBA of #e8a04a. Emissive recolor uses the RGB prefix.
AMBER_RGBA = [0.806952, 0.351533, 0.068478, 1.0]
AMBER_RGB = AMBER_RGBA[:3]


def _die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def rgb_to_hsv(rgb: np.ndarray):
    """rgb float array (..., 3) in 0..1 -> hue in degrees, saturation, value."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    delta = maxc - minc
    hue = np.zeros_like(maxc)
    nonzero = delta > 1e-12
    # One sector on ties: r==g==max is yellow (60°), r==b==max is magenta (300°).
    rmax = nonzero & (maxc == r)
    gmax = nonzero & (maxc == g) & ~rmax
    bmax = nonzero & ~rmax & ~gmax
    hue[rmax] = np.mod((g[rmax] - b[rmax]) / delta[rmax], 6.0)
    hue[gmax] = (b[gmax] - r[gmax]) / delta[gmax] + 2.0
    hue[bmax] = (r[bmax] - g[bmax]) / delta[bmax] + 4.0
    hue = hue * 60.0
    sat = np.zeros_like(maxc)
    bright = maxc > 1e-12
    sat[bright] = delta[bright] / maxc[bright]
    return hue, sat, maxc


def hsv_to_rgb(hue_deg: np.ndarray, sat: np.ndarray, val: np.ndarray) -> np.ndarray:
    sector = np.mod(hue_deg, 360.0) / 60.0
    chroma = val * sat
    x = chroma * (1.0 - np.abs(np.mod(sector, 2.0) - 1.0))
    match = val - chroma
    zero = np.zeros_like(sector)
    parts = (
        (chroma, x, zero),
        (x, chroma, zero),
        (zero, chroma, x),
        (zero, x, chroma),
        (x, zero, chroma),
        (chroma, zero, x),
    )
    which = np.floor(sector).astype(np.int32) % 6
    rgb = np.empty(sector.shape + (3,), dtype=np.float64)
    for index, (cr, cg, cb) in enumerate(parts):
        mask = which == index
        rgb[mask, 0] = cr[mask]
        rgb[mask, 1] = cg[mask]
        rgb[mask, 2] = cb[mask]
    rgb += match[..., None]
    return rgb


# Hue of sRGB #e8a04a (not the hue of the linear material factors).
_AMBER_SRGB = np.array([[[0xE8 / 255.0, 0xA0 / 255.0, 0x4A / 255.0]]], dtype=np.float64)
AMBER_HUE = float(rgb_to_hsv(_AMBER_SRGB)[0][0, 0])


def _teal_mask(rgb01: np.ndarray) -> np.ndarray:
    hue, sat, val = rgb_to_hsv(rgb01)
    return (hue >= 160.0) & (hue <= 200.0) & (sat > 0.35) & (val > 0.25)


def _count_teal(rgba_u8: np.ndarray) -> int:
    rgb = rgba_u8[..., :3].astype(np.float64) / 255.0
    return int(_teal_mask(rgb).sum())


def _sniff_mime(data: bytes):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    return None


def _recolor_image(data: bytes, mime: str):
    """Return (new_bytes or None, teal_before, teal_after). None means unchanged."""
    try:
        source = Image.open(io.BytesIO(data))
        source.load()
    except Exception as exc:  # Pillow raises several decode errors.
        _die(f"cannot decode embedded {mime}: {exc}")
    has_alpha = "A" in source.mode or (source.mode == "P" and "transparency" in source.info)
    rgba = np.asarray(source.convert("RGBA"))
    before = _count_teal(rgba)
    if before == 0:
        return None, before, before

    rgb = rgba[..., :3].astype(np.float64) / 255.0
    hue, sat, val = rgb_to_hsv(rgb)
    mask = _teal_mask(rgb)
    hue = np.array(hue, copy=True)
    hue[mask] = AMBER_HUE
    shifted = np.clip(hsv_to_rgb(hue, sat, val), 0.0, 1.0)
    out = np.array(rgba, copy=True)
    out[mask, :3] = np.rint(shifted[mask] * 255.0).astype(np.uint8)

    encoded = io.BytesIO()
    if mime == "image/jpeg":
        image = Image.fromarray(np.ascontiguousarray(out[..., :3]), "RGB")
        image.save(encoded, format="JPEG", quality=92)
    else:
        if has_alpha:
            image = Image.fromarray(np.ascontiguousarray(out), "RGBA")
        else:
            image = Image.fromarray(np.ascontiguousarray(out[..., :3]), "RGB")
        image.save(encoded, format="PNG")
    new_bytes = encoded.getvalue()
    after = _count_teal(np.asarray(Image.open(io.BytesIO(new_bytes)).convert("RGBA")))
    return new_bytes, before, after


def _parse_glb(data: bytes):
    if len(data) < 12:
        _die("not a GLB: file too small")
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC:
        _die("not a GLB: bad magic")
    end = length if 12 <= length <= len(data) else len(data)
    offset = 12
    json_payload = None
    bin_payload = None
    extras = []
    while offset + 8 <= end:
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        if chunk_len < 0 or offset + chunk_len > end:
            _die("truncated GLB chunk")
        payload = data[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == CHUNK_JSON and json_payload is None:
            json_payload = payload
        elif chunk_type == CHUNK_BIN and bin_payload is None:
            bin_payload = payload
        else:
            extras.append((chunk_type, payload))
    if json_payload is None:
        _die("GLB has no JSON chunk")
    try:
        gltf = json.loads(json_payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        _die(f"invalid GLB JSON: {exc}")
    return version, gltf, bin_payload, extras


def _view_bytes(blob: bytes, view: dict) -> bytes:
    start = int(view.get("byteOffset", 0))
    length = int(view["byteLength"])
    end = start + length
    if start < 0 or length < 0 or end > len(blob):
        _die(f"bufferView out of range ({start}:{end} of {len(blob)})")
    return blob[start:end]


def _recolor_materials(gltf: dict, renames: dict) -> list:
    changed = []
    for index, mat in enumerate(gltf.get("materials") or []):
        if not isinstance(mat, dict):
            continue
        name = mat.get("name") or ""
        if "teal" not in name.lower():
            continue
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        pbr["baseColorFactor"] = list(AMBER_RGBA)
        emissive = None
        old_emissive = mat.get("emissiveFactor")
        if isinstance(old_emissive, (list, tuple)) and old_emissive:
            # Keep the previous intensity: the brightest channel stays put.
            old_max = max(float(channel) for channel in old_emissive)
            peak = max(AMBER_RGB)
            scale = old_max / peak if peak else 0.0
            emissive = [channel * scale for channel in AMBER_RGB]
            mat["emissiveFactor"] = emissive
        new_name = renames.get(name, name)
        if new_name != name:
            mat["name"] = new_name
        changed.append(
            {
                "index": index,
                "old_name": name,
                "new_name": new_name,
                "baseColorFactor": list(AMBER_RGBA),
                "emissiveFactor": emissive,
            }
        )
    return changed


def _recolor_images(gltf: dict, bin_payload):
    changed = []
    replacements = {}
    cache = {}
    blob = bin_payload or b""
    views = gltf.get("bufferViews") or []
    for index, image in enumerate(gltf.get("images") or []):
        if not isinstance(image, dict) or "bufferView" not in image:
            continue
        view_index = image["bufferView"]
        try:
            view = views[view_index]
        except (IndexError, TypeError, KeyError):
            _die(f"image {index} references missing bufferView {view_index}")
        if int(view.get("buffer", 0)) != 0:
            continue
        if view_index not in cache:
            raw = _view_bytes(blob, view)
            mime = _sniff_mime(raw)
            if mime is None:
                declared = (image.get("mimeType") or "").split(";", 1)[0].strip().lower()
                mime = declared if declared in ("image/png", "image/jpeg") else None
            if mime is None:
                cache[view_index] = None
            else:
                cache[view_index] = (mime, _recolor_image(raw, mime))
        cached = cache[view_index]
        if not cached:
            continue
        mime, (new_bytes, before, after) = cached
        if new_bytes is None:
            continue
        replacements[view_index] = new_bytes
        entry = {
            "index": index,
            "bufferView": view_index,
            "mimeType": mime,
            "teal_pixels_before": before,
            "teal_pixels_after": after,
        }
        if image.get("name"):
            entry["name"] = image["name"]
        changed.append(entry)
    return changed, replacements


def _repack_bin(gltf: dict, bin_payload: bytes, replacements: dict) -> bytes:
    """Pack buffer 0 in original offset order. Replaced views get new bytes."""
    views = gltf.get("bufferViews") or []
    order = sorted(
        (int(views[i].get("byteOffset", 0)), i)
        for i in range(len(views))
        if int(views[i].get("buffer", 0)) == 0
    )
    out = bytearray()
    for _old_offset, index in order:
        pad = (4 - (len(out) % 4)) % 4
        if pad:
            out += b"\x00" * pad
        view = views[index]
        if index in replacements:
            data = replacements[index]
            view["byteLength"] = len(data)
        else:
            data = _view_bytes(bin_payload, view)
        view["byteOffset"] = len(out)
        out += data
    packed = bytes(out)
    buffers = gltf.setdefault("buffers", [])
    if not buffers:
        buffers.append({})
    buffers[0]["byteLength"] = len(packed)
    return packed


def _pad4(data: bytes, pad_byte: int) -> bytes:
    extra = (4 - (len(data) % 4)) % 4
    if not extra:
        return data
    return data + bytes((pad_byte,)) * extra


def _build_glb(version: int, gltf: dict, bin_payload, extras, *, pad_bin: bool) -> bytes:
    raw_json = json.dumps(gltf, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    json_payload = _pad4(raw_json, 0x20)
    parts = [struct.pack("<II", len(json_payload), CHUNK_JSON) + json_payload]
    if bin_payload is not None:
        payload = _pad4(bin_payload, 0x00) if pad_bin else bin_payload
        parts.append(struct.pack("<II", len(payload), CHUNK_BIN) + payload)
    for chunk_type, payload in extras:
        parts.append(struct.pack("<II", len(payload), chunk_type) + payload)
    body = b"".join(parts)
    header = struct.pack("<III", GLB_MAGIC, version, 12 + len(body))
    return header + body


def _parse_renames(items: list) -> dict:
    renames = {}
    for item in items:
        if "=" not in item:
            _die(f"--rename-material expects OLD=NEW, got {item!r}")
        old, new = item.split("=", 1)
        if old == "":
            _die(f"--rename-material has an empty OLD name in {item!r}")
        renames[old] = new
    return renames


def convert(data: bytes, renames: dict | None = None):
    """Recolor one GLB blob. Returns (summary_dict, output_bytes)."""
    version, gltf, bin_payload, extras = _parse_glb(data)
    materials_changed = _recolor_materials(gltf, renames or {})
    images_changed, replacements = _recolor_images(gltf, bin_payload)
    if replacements:
        if bin_payload is None:
            _die("embedded images require a BIN chunk")
        packed = _repack_bin(gltf, bin_payload, replacements)
        output = _build_glb(version, gltf, packed, extras, pad_bin=True)
    else:
        output = _build_glb(version, gltf, bin_payload, extras, pad_bin=False)
    summary = {
        "materials_changed": materials_changed,
        "images_changed": images_changed,
        "input_bytes": len(data),
        "output_bytes": len(output),
    }
    return summary, output


def main(argv: list | None = None) -> None:
    parser = argparse.ArgumentParser(description="Recolor teal glTF glow to amber #e8a04a.")
    parser.add_argument("input", help="source .glb")
    parser.add_argument("output", help="destination .glb")
    parser.add_argument(
        "--rename-material",
        action="append",
        default=[],
        metavar="OLD=NEW",
        help="rename a teal material (repeatable)",
    )
    parser.add_argument("--dry-run", action="store_true", help="print the summary and write nothing")
    args = parser.parse_args(argv)

    if os.path.realpath(args.input) == os.path.realpath(args.output):
        _die("refusing to write: OUT and IN are the same path", 2)

    with open(args.input, "rb") as handle:
        data = handle.read()
    summary, output = convert(data, _parse_renames(args.rename_material))
    if not args.dry_run:
        with open(args.output, "wb") as handle:
            handle.write(output)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
