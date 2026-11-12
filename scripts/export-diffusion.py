import argparse
import gzip
import hashlib
import json
import struct
from pathlib import Path

import numpy as np


def encode(frames):
    frames = np.asarray(frames, dtype=np.float32).reshape(-1, 5200, 3)
    output = bytearray(struct.pack("<4sII", b"DIF1", len(frames), frames.shape[1]))
    maximum_error = 0.0
    for frame in frames:
        scale = np.float32(max(float(np.abs(frame).max()), 1e-8) / 32767)
        packed = np.rint(frame / scale).astype("<i2")
        maximum_error = max(maximum_error, float(np.abs(packed * scale - frame).max()))
        output.extend(struct.pack("<f", scale))
        output.extend(packed.tobytes())
    return gzip.compress(bytes(output), compresslevel=9, mtime=0), maximum_error


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / "assets" / "diffusion" / "data"
    destination.mkdir(parents=True, exist_ok=True)
    source = args.source / "demo_cache.npz"
    manifest = json.loads((args.source / "demo_manifest.json").read_text())
    manifest["cache_sha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
    manifest["encoding"] = "DIF1: little-endian frame count and point count, then per-frame float32 scale and signed int16 XYZ; gzip compressed."
    manifest["training_intro"] = "Only the untrained first preview is scaled to fit; all later training frames retain their original scale."
    manifest["assets"] = {}
    with np.load(source, allow_pickle=False) as cache:
        for name in ("initial", "forward", "training", "reverse_0", "reverse_1", "reverse_2"):
            frames = cache[name].copy()
            if name == "training":
                frames[0] *= 3 / max(3, 0.82 * np.linalg.norm(frames[0], axis=1).max())
            data, error = encode(frames)
            filename = name.replace("_", "-") + ".bin.gz"
            (destination / filename).write_bytes(data)
            manifest["assets"][name] = {"file": filename, "bytes": len(data), "max_coordinate_error": error}
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest["assets"], indent=2))


if __name__ == "__main__":
    main()
