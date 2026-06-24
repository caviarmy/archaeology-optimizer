#!/usr/bin/env python3

import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "vendor"))
try:
    from core.player import Player
except Exception as e:
    sys.stderr.write("Could not import vendored engine. Run ./fetch-engine.sh first.\n%s\n" % e)
    sys.exit(2)

with open(os.path.join(HERE, "scenarios.json")) as f:
    spec = json.load(f)

def stats_for(sc):
    p = Player()
    p.base_damage_const = spec["baseDamageConst"]
    p.arch_level = 100
    p.asc1_unlocked = sc["asc"] >= 1
    p.asc2_unlocked = sc["asc"] >= 2
    for row, lvl in (sc.get("theirs") or {}).items():
        p.set_upgrade_level(int(row), lvl)
    b = sc["build"]
    p.base_stats = {"Str": b["S"], "Agi": b["A"], "Per": b["P"], "Int": b["I"],
                    "Luck": b["L"], "Div": b["D"], "Corr": b["C"]}
    return {
        "damage":          float(p.damage),
        "maxSta":          float(p.max_sta),
        "armorPen":        float(p.armor_pen),
        "critChance":      float(p.crit_chance),
        "critDmgMult":     float(p.crit_dmg_mult),
        "superCritChance": float(p.super_crit_chance),
        "superCritMult":   float(p.super_crit_dmg_mult),
        "ultraCritChance": float(p.ultra_crit_chance),
    }

out = {}
for sc in spec["scenarios"] + spec.get("upgradeScenarios", []):
    out[sc["name"]] = stats_for(sc)

upgrade_defs = {}
for cc in spec.get("coefficientChecks", []):
    row = cc["row"]
    upgrade_defs[str(row)] = Player.UPGRADE_DEF[row][1]

cards_out = {}
for c in spec.get("cardChecks", []):
    p = Player(); p.asc2_unlocked = True
    if c.get("theirPoly"): p.set_upgrade_level(41, c["theirPoly"])
    p.set_card_level("com1", c["theirLevel"])
    hp, exp, loot = p.get_card_bonuses("com1")
    cards_out[c["name"]] = {"hpMult": float(hp), "rewardMult": float(exp), "lootMult": float(loot)}

blocks_out = {}
bc = spec.get("blockChecks")
if bc:
    from core.block import Block
    pp = Player()
    for bid in bc["ids"]:
        entry = {"byFloor": {}}
        for fl in bc["floors"]:
            blk = Block(bid, fl, pp)
            entry["byFloor"][str(fl)] = {"hp": float(blk.hp), "armor": float(blk.armor)}

        blk0 = Block(bid, bc["floors"][0], pp)
        entry["xp"] = float(blk0.xp)
        entry["frag"] = float(blk0.frag_amt)
        blocks_out[bid] = entry

with open(os.path.join(HERE, "theirs.json"), "w") as f:
    json.dump({"stats": out, "cards": cards_out, "blocks": blocks_out, "upgradeDefs": upgrade_defs}, f, indent=2)
print("wrote theirs.json (%d stat scenarios, %d cards, %d block ids, %d coeffs)" % (len(out), len(cards_out), len(blocks_out), len(upgrade_defs)))
