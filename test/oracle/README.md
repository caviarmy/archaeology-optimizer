# Cross-engine validation

A process for checking our math and results against lobogrande's
[IoM-Arch-Optimizer-Web](https://github.com/lobogrande/IoM-Arch-Optimizer-Web)
engine, which is a 1:1 re-implementation of the game's decompiled GameMaker
source. We don't have the source, so their engine is the closest thing to a
ground truth, and we use it as an oracle.

There are three layers, in increasing reliance on the oracle:

## 1. Unit tests (offline)

`node test/unit/formulas.mjs`

Self-contained assertions on our core math: damage pooling, the crit-damage
base, stamina, armor pen, and the hits-to-kill breakpoints and overkill that the
oracle's stat check does not reach. No network, no oracle. Good for fast CI.

## 2. Regression guard (offline)

`node test/oracle/regression.mjs`

Re-runs our engine over the scenarios and diffs against the committed
`golden_ours.json`. Any accidental change to our math (the kind that produced the
old crit-damage bug) fails here. Update the baseline on purpose with
`node test/oracle/regression.mjs --update`.

## 3. Oracle comparison vs their engine (needs network once)

`bash test/oracle/run.sh`

Fetches their pure-Python engine (MIT, fetched into `vendor/`, not committed),
runs every scenario through both engines, and diffs:

- **Stats:** for builds that exercise every per-point attribute and the
  ascension gating, compares damage, max stamina, crit chance, crit-damage
  multiplier, super-crit chance, and armor pen.
- **Upgrades:** the per-point skill buffs, each set to a level in both engines
  and compared on the stats it moves.
- **Cards:** the HP and reward multipliers for each rarity (standard, gilded,
  polychrome, and polychrome with the +15% upgrade).
- **Blocks:** base HP and armor for every tier and rarity, scaled across floors
  1 to 300, which exercises the deep-floor scaling including the two game bugs
  their engine preserves (the floor-150 armor skip and the floor-300
  double-trigger).

Current result: **137/137 stat checks (incl. skill-buff upgrades), 8/8 card
multiplier checks, and 260/260 block checks within tolerance.** Our per-point
math, skill-buff upgrades, card multipliers, and block model all match their
source-faithful engine.

### Coverage and mapping

The base scenarios use no upgrades, so the per-point base math is comparable
with no mapping. The upgrade scenarios then map one of our skill-buff fields to
one of their upgrade rows (verified one to one), so a divergence is a real math
difference, not a mapping guess:

| our field | their row | effect |
| --- | --- | --- |
| modStrA0 | 25 | Strength flat damage + damage% |
| modStrA1 | 47 | Strength damage% + crit damage% |
| modAgi | 26 | max stamina per Agility |
| modPer | 33 | armor pen per Perception |
| modInt | 35 | exp gain per Intellect |
| modDivA2 | 34 | Divinity flat damage + super-crit |
| modCorrA2 | 52 | Corruption damage% |

Still to add: the flat-damage and damage%/armor-pen pool upgrades, which our
model folds into the displayed base stat rather than computing from a level, so
they need the base walked out to compare apples to apples.

### Two documented, benign differences

- **Super-crit multiplier when its chance is 0.** Their property reports `0`
  (it can never fire); ours reports the latent base `2.0`. The term is gated by
  the chance in combat, so damage is identical. The comparison skips it when the
  chance is 0.
- **Base armor rounding.** Their `project_config` rounds base armor to an integer
  (com4 = 22 vs our precise 22.46). That sub-1 difference is amplified by the
  floor scaling, so the block armor tolerance is 3%, which still catches any
  structural scaling error (a missed bug would be a large factor).

## Phase 2: results (combat run) comparison

The layers above validate the inputs to a run (stats and block stats). The next
step is comparing run *results*: their `engine/combat_loop.py`
(`CombatSimulator(player).run_simulation()`) against our `aggregateBuildSim`, for
floor reached, rewards, and block counts. It is a separate phase because it needs
the full upgrade/card/RNG configuration mapped between the engines, and because
their micro-tick simulation and our expected-value-plus-Monte-Carlo model agree
in expectation rather than exactly, so it is a tolerance comparison on averages
rather than a near-equality check.

## Provenance

Their engine is MIT licensed (`vendor/LICENSE` after fetch). `fetch-engine.sh`
pulls it on demand; set `LOBO_REF` to pin a commit. Their code is not committed
to this repo.
