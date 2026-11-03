"""Export FIRST_MAP plan A2 to the declarative runtime map and its nine 64-tile chunks.

Run from the repository root after changing plan.py:
    python3 docs/design/first-map/export.py

plan.py remains the geometry source of truth. The exporter only translates its raster and
annotations into the existing map/chunk schemas and moves the authored valley records.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLAN_PATH = Path(__file__).with_name("plan.py")
MAP_PATH = ROOT / "content/core/map.json"
CHUNKS = ROOT / "content/core/chunks"
SHIFT = (66, 84)


def load_plan_module():
    spec = importlib.util.spec_from_file_location("first_map_plan", PLAN_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def corners(path):
    """Reduce a unit four-way route to its axis-aligned corners."""
    if len(path) < 2:
        return path
    out = [path[0]]
    old = (path[1][0] - path[0][0], path[1][1] - path[0][1])
    for i in range(2, len(path)):
        new = (path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
        if new != old:
            out.append(path[i - 1])
            old = new
    out.append(path[-1])
    return out


def plan_paths(paths):
    result = []
    for name, route in sorted(paths.items()):
        name = name.lower()
        via = corners(route)
        if len(via) < 2:
            continue
        # The schema caps one authored path at 32 corners. Parts overlap at one corner.
        part = 1
        while len(via) > 1:
            section = via[:32]
            result.append({"id": f"core/{name}" + (f"-{part}" if len(via) > 32 or part > 1 else ""), "width": 1, "via": section})
            if len(via) <= 32:
                break
            via = via[31:]
            part += 1
    return result


def crossing_props(plan):
    return [
        {
            "sprite": "core/base-kit:props/pebbles",
            "x": x,
            "y": y,
            "w": 1,
            "h": 1,
            "solid": False,
            "crossing": True,
        }
        for x, y in sorted(plan.stairs, key=lambda p: (p[1], p[0]))
    ]


def shifted(records):
    out = []
    for record in records:
        moved = dict(record)
        moved["x"] += SHIFT[0]
        moved["y"] += SHIFT[1]
        if moved.get("hazard", {}).get("round"):
            moved["hazard"] = dict(moved["hazard"])
            moved["hazard"]["round"] = [[x + SHIFT[0], y + SHIFT[1]] for x, y in moved["hazard"]["round"]]
        out.append(moved)
    return out


def unshifted(records):
    out = []
    for record in records:
        moved = dict(record)
        moved["x"] -= SHIFT[0]
        moved["y"] -= SHIFT[1]
        if moved.get("hazard", {}).get("round"):
            moved["hazard"] = dict(moved["hazard"])
            moved["hazard"]["round"] = [[x - SHIFT[0], y - SHIFT[1]] for x, y in moved["hazard"]["round"]]
        out.append(moved)
    return out


def legend(old):
    result = dict(old)
    terrain = {
        "S": ("tiles/sand", False, "riverbank"),
        "r": ("tiles/grass", False, "riverbank"),
        "f": ("tiles/grove", False, "grove"),
        "h": ("tiles/grass", False, "meadow"),
        "x": ("tiles/sand_ruin", False, "ruin"),
        "k": ("tiles/grass", False, "meadow"),
        "F": ("tiles/rubble", True, "town"),
        "P": ("tiles/forest", True, "grove"),
        "W": ("tiles/rubble", True, "town"),
        "R": ("tiles/rubble", True, "town"),
        "O": ("tiles/rubble", True, "ruin"),
        "M": ("tiles/rubble", True, "ruin"),
        "D": ("tiles/rubble", True, "ruin"),
        "c": ("tiles/cobble", False, "town"),
        "d": ("tiles/planks", False, "riverbank"),
        "w": ("tiles/grass_flowers", False, "meadow"),
    }
    for char, (sprite, solid, tag) in terrain.items():
        result[char] = {"sprite": f"core/base-kit:{sprite}", "solid": solid, "tag": tag}
    return result


def runtime_regions():
    return [
        {"id": "far-bank", "x": 0, "y": 150, "w": 31, "h": 42, "world": "city", "card": "far-bank", "title": "The far bank"},
        {"id": "elf-wood", "x": 36, "y": 0, "w": 83, "h": 49, "world": "north", "card": "elf-wood", "title": "The north wood"},
        {"id": "east-highland", "x": 144, "y": 48, "w": 48, "h": 96, "card": "east-highland", "title": "The east highland"},
        {"id": "undead-south", "x": 70, "y": 152, "w": 62, "h": 40, "world": "south", "card": "undead-south", "title": "The southern hollow"},
        {"id": "bay-coast", "x": 25, "y": 118, "w": 76, "h": 74, "card": "bay-coast", "title": "The bay coast"},
        {"id": "valley-floor", "x": 48, "y": 48, "w": 96, "h": 96, "card": "valley-floor", "title": "The valley floor"},
    ]


def plan_regions():
    return [
        {"id": "core/first-map", "purpose": "passage", "cells": [[0, 0, 192, 192]], "tags": ["frame"], "opens_by": "wake"},
        {"id": "core/valley-floor", "purpose": "stop", "cells": [[48, 48, 96, 96]], "height": 0, "tags": ["meadow"]},
        {"id": "core/elf-wood", "purpose": "stop", "cells": [[36, 6, 83, 43]], "height": 1, "tags": ["forest", "world:elf"]},
        {"id": "core/east-highland", "purpose": "stop", "cells": [[144, 48, 48, 96]], "height": 3, "tags": ["highland"]},
        {"id": "core/bay-coast", "purpose": "passage", "cells": [[25, 118, 76, 74]], "height": 0, "tags": ["water", "riverbank"]},
        {"id": "core/far-bank", "purpose": "passage", "cells": [[0, 150, 31, 42]], "height": 0, "tags": ["world:human"]},
        {"id": "core/undead-south", "purpose": "stop", "cells": [[70, 152, 62, 40]], "height": 0, "tags": ["ruin", "world:skeleton"]},
    ]


def stamp_for(mark_id, mark, plan, ox, oy):
    x, y = mark["at"]
    local_x, local_y = x - ox, y - oy
    char = str(plan.g[y, x])
    return {
        "id": f"core/a2-{mark_id.lower()}",
        "x": local_x,
        "y": local_y,
        "height": int(plan.lv[y, x]),
        "grounds": [char],
    }


def write_chunks(plan):
    CHUNKS.mkdir(parents=True, exist_ok=True)
    expected = set()
    for cy in range(3):
        for cx in range(3):
            ox, oy = cx * 64, cy * 64
            path = CHUNKS / f"first-map-{cx}-{cy}.json"
            expected.add(path)
            stamps = [stamp_for(key, mark, plan, ox, oy) for key, mark in sorted(plan.marks.items()) if ox <= mark["at"][0] < ox + 64 and oy <= mark["at"][1] < oy + 64]
            props = []
            for x, y in sorted(plan.stairs, key=lambda p: (p[1], p[0])):
                if ox <= x < ox + 64 and oy <= y < oy + 64:
                    props.append({"sprite": "core/base-kit:props/pebbles", "x": x - ox, "y": y - oy, "w": 1, "h": 1, "solid": False, "crossing": True})
            doc = {
                "$schema": "../../../schema/json/chunk.schema.json",
                "format": 1,
                "type": "chunk",
                "id": f"core/first-map-{cx}-{cy}",
                "title": f"First map chunk {cx},{cy}",
                "creator": "core",
                "description": "Plan A2, exported from docs/design/first-map/plan.py.",
                "chunk": {
                    "x": ox,
                    "y": oy,
                    "grounds": ["".join(plan.g[y, ox:ox + 64]) for y in range(oy, oy + 64)],
                    "levels": ["".join(str(int(v)) for v in plan.lv[y, ox:ox + 64]) for y in range(oy, oy + 64)],
                    "props": props,
                    "stamps": stamps,
                },
            }
            path.write_text(json.dumps(doc, indent=2) + "\n")
    for path in CHUNKS.glob("first-map-*.json"):
        if path not in expected:
            path.unlink()


def move_wakes(plan):
    files = {
        "N": ROOT / "content/core/pockets/north-meadow.json",
        "W": ROOT / "content/core/pockets/west-bank.json",
        "S": ROOT / "content/core/pockets/slid-bank.json",
    }
    # The opening legs move rigidly with the authored valley. A2's three wider-area marks are not a licence to rewrite
    # their pays or relative walking effort (the task's explicit boundary and GAME_RULES section 6).
    old_wakes = {"N": (7, 6), "W": (6, 17), "S": (9, 23)}
    for key, path in files.items():
        doc = json.loads(path.read_text())
        x, y = old_wakes[key]
        x += SHIFT[0]
        y += SHIFT[1]
        doc["pocket"]["wake"] = {"x": x, "y": y}
        path.write_text(json.dumps(doc, indent=2) + "\n")


def main():
    module = load_plan_module()
    plan = module.build("A2")
    measured, _ = module.measure(plan)
    old_doc = json.loads(MAP_PATH.read_text())
    old = old_doc["map"]
    old_doc["title"] = "The first map"
    old_doc["description"] = "Plan A2: the authored valley inside the first 192 by 192 tile mountain ring."
    old["width"] = 192
    old["height"] = 192
    old["legend"] = legend(old["legend"])
    old["ground"] = ["".join(row) for row in plan.g]
    old["levels"] = ["".join(str(int(v)) for v in row) for row in plan.lv]
    already_moved = old.get("frame", 1) >= 2
    base_props = [p for p in old["props"] if p.get("id") is not None or p.get("crossing") is not True]
    if already_moved:
        base_props = unshifted(base_props)
        base_slots = unshifted(old["slots"])
        base_spawn = {"x": old["spawn"]["x"] - SHIFT[0], "y": old["spawn"]["y"] - SHIFT[1]}
    else:
        base_slots = old["slots"]
        base_spawn = old["spawn"]
    old["props"] = shifted(base_props) + crossing_props(plan)
    old["slots"] = shifted(base_slots)
    old["spawn"] = {"x": base_spawn["x"] + SHIFT[0], "y": base_spawn["y"] + SHIFT[1]}
    old["frame"] = 2
    old["moved"] = {"dx": SHIFT[0], "dy": SHIFT[1]}
    old["regions"] = runtime_regions()
    if old.get("creatures"):
        spots = old["creatures"]["spots"]
        # Recover from the first draft exporter, which set frame 2 before moving these points.
        creatures_already_moved = any(s["x"] >= SHIFT[0] or s["y"] >= SHIFT[1] for s in spots)
        if creatures_already_moved:
            spots = [{**s, "x": s["x"] - SHIFT[0], "y": s["y"] - SHIFT[1]} for s in spots]
        old["creatures"]["spots"] = [{**s, "x": s["x"] + SHIFT[0], "y": s["y"] + SHIFT[1]} for s in spots]
    old_plan = old.get("plan", {})
    old["plan"] = {
        "regions": plan_regions(),
        "paths": plan_paths(plan.paths),
        "wakes": old_plan.get("wakes", []),
        "exits": [{"id": "core/ferry", "at": [74, 120], "to": "core/bay-coast", "min_road_steps": 2102}],
    }
    MAP_PATH.write_text(json.dumps(old_doc, indent=2) + "\n")
    write_chunks(plan)
    move_wakes(plan)
    print(json.dumps({"A2": measured}, indent=2))


if __name__ == "__main__":
    main()
