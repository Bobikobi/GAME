#!/usr/bin/env python3
"""World positions of a glb skeleton's bones for each frame of one animation: forward kinematics in numpy, no Blender.

  python3 glbjoints.py GLB ACTION N OUT.json     N frames spread evenly over the action (a loop: the end is not repeated)

The out file: {"action", "fps", "frames": N, "bones": [names], "pos": [[ [x,y,z] per bone ] per frame]} in metres, y up, the
character facing +z (glTF). Only translation, rotation and scale channels with linear or step sampling are read, which is what
the Quaternius libraries hold. Pure functions (`quat_to_mat`, `sample`, `world_positions`) are tested in test_glbjoints.py."""
from __future__ import annotations
import json
import struct
import sys

import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path: str):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack("<I", b[off:off + 4])[0]
    return j, b[off + 8:off + 8 + bl]


def accessor(j, blob, i):
    a = j["accessors"][i]
    v = j["bufferViews"][a["bufferView"]]
    n = NCOMP[a["type"]]
    dt = np.dtype(COMP[a["componentType"]])
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride", n * dt.itemsize)
    if stride == n * dt.itemsize:
        arr = np.frombuffer(blob, dtype=dt, count=a["count"] * n, offset=start).reshape(a["count"], n)
    else:
        arr = np.stack([np.frombuffer(blob, dtype=dt, count=n, offset=start + k * stride) for k in range(a["count"])])
    return arr.astype(np.float64)


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def slerp(a, b, t):
    d = float(np.dot(a, b))
    if d < 0:
        b, d = -b, -d
    if d > 0.9995:
        r = a + t * (b - a)
        return r / np.linalg.norm(r)
    th = np.arccos(d)
    return (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)


def sample(times, values, t, path, step=False):
    """The channel's value at time t (clamped to its ends)."""
    if t <= times[0]:
        return values[0]
    if t >= times[-1]:
        return values[-1]
    i = int(np.searchsorted(times, t, side="right") - 1)
    u = (t - times[i]) / (times[i + 1] - times[i])
    if step:
        return values[i]
    if path == "rotation":
        return slerp(values[i], values[i + 1], u)
    return values[i] + u * (values[i + 1] - values[i])


def world_positions(j, blob, action: str, n: int):
    nodes = j["nodes"]
    parent = {c: i for i, nd in enumerate(nodes) for c in nd.get("children", [])}
    anim = next(a for a in j["animations"] if a["name"] == action)
    chans = {}
    end = 0.0
    for c in anim["channels"]:
        s = anim["samplers"][c["sampler"]]
        t, v = accessor(j, blob, s["input"]), accessor(j, blob, s["output"])
        chans[(c["target"]["node"], c["target"]["path"])] = (t[:, 0] if t.ndim > 1 else t, v, s.get("interpolation", "LINEAR") == "STEP")
        end = max(end, float(t.max()))
    order = []

    def depth(i):
        return 0 if i not in parent else 1 + depth(parent[i])
    order = sorted(range(len(nodes)), key=depth)
    frames = []
    for k in range(n):
        t = end * k / n
        world = {}
        for i in order:
            nd = nodes[i]
            tr = np.array(nd.get("translation", [0, 0, 0]), float)
            ro = np.array(nd.get("rotation", [0, 0, 0, 1]), float)
            sc = np.array(nd.get("scale", [1, 1, 1]), float)
            for path in ("translation", "rotation", "scale"):
                if (i, path) in chans:
                    ts, vs, st = chans[(i, path)]
                    val = sample(ts, vs, t, path, st)
                    tr, ro, sc = (val, ro, sc) if path == "translation" else ((tr, val, sc) if path == "rotation" else (tr, ro, val))
            m = np.eye(4)
            m[:3, :3] = quat_to_mat(ro / np.linalg.norm(ro)) * sc
            m[:3, 3] = tr
            world[i] = (world[parent[i]] @ m) if i in parent else m
        frames.append(world)
    names = [nd.get("name", f"n{i}") for i, nd in enumerate(nodes)]
    return names, np.array([[w[i][:3, 3] for i in range(len(nodes))] for w in frames]), end


def main():
    glb, action, n, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    j, blob = read_glb(glb)
    names, pos, end = world_positions(j, blob, action, n)
    json.dump({"action": action, "seconds": end, "frames": n, "bones": names, "pos": np.round(pos, 5).tolist()}, open(out, "w"))
    print(f"{action}: {n} frames over {end:.3f} s, {len(names)} bones -> {out}")


if __name__ == "__main__":
    main()
