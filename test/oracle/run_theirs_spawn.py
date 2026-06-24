#!/usr/bin/env python3

import json, os, sys, random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "vendor"))
from core.player import Player
from engine.floor_map import FloorGenerator

spec = json.load(open(os.path.join(HERE, "scenarios.json")))
sc = spec["spawnComparison"]
M = sc["samples"]
RARITY = {"dirt": "dirt", "com": "common", "rare": "rare", "epic": "epic", "leg": "legendary", "myth": "mythic", "div": "divine"}

p = Player(); p.asc1_unlocked = True; p.asc2_unlocked = True; p.arch_level = 200
gen = FloorGenerator()
out = {}
for fl in sc["floors"]:
    active = 0
    rar = {v: 0 for v in RARITY.values()}
    for _ in range(M):
        random.seed(None)
        floor = gen.generate_floor(fl, p)
        for blk in floor.grid:
            if blk is None:
                continue
            active += 1
            pre = "".join(ch for ch in blk.block_id if not ch.isdigit())
            rar[RARITY[pre]] += 1
    out[str(fl)] = {
        "activeAvg": active / M,
        "rarityProb": {k: rar[k] / (24.0 * M) for k in rar},
    }

json.dump(out, open(os.path.join(HERE, "spawn_theirs.json"), "w"), indent=2)
print("wrote spawn_theirs.json (%d floors x %d samples)" % (len(out), M))
