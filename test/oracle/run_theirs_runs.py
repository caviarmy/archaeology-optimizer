#!/usr/bin/env python3
# Phase 2 (their side): run a full dig many times per scenario in lobogrande's
# combat_loop and report the average floor reached (and blocks mined). Zero
# upgrades/cards and no Luck/Div, so there are no refunds, crosshairs, or
# auto-abilities. Writes run_theirs.json.
import json, os, sys, random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "vendor"))
try:
    from core.player import Player
    from engine.combat_loop import CombatSimulator
except Exception as e:
    sys.stderr.write("Could not import vendored engine. Run ./fetch-engine.sh first.\n%s\n" % e)
    sys.exit(2)

spec = json.load(open(os.path.join(HERE, "scenarios.json")))
rc = spec["runComparison"]; N = rc["N"]
out = {}
for sc in rc["scenarios"]:
    p = Player()
    p.base_damage_const = spec["baseDamageConst"]
    p.arch_level = sc["level"]
    p.asc1_unlocked = sc["asc"] >= 1
    p.asc2_unlocked = sc["asc"] >= 2
    b = sc["build"]
    p.base_stats = {"Str": b["S"], "Agi": b["A"], "Per": b["P"], "Int": b["I"],
                    "Luck": b["L"], "Div": b["D"], "Corr": b["C"]}
    fl = blk = xp = 0.0
    for s in range(N):
        random.seed(1000 + s)
        st = CombatSimulator(p).run_simulation()
        fl += st.highest_floor
        blk += st.blocks_mined
        xp += st.total_xp
    out[sc["name"]] = {"floor": fl / N, "blocks": blk / N, "xp": xp / N}

json.dump(out, open(os.path.join(HERE, "run_theirs.json"), "w"), indent=2)
print("wrote run_theirs.json (%d scenarios x %d runs)" % (len(out), N))
