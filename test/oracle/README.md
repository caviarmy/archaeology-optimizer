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
  and compared on the stats it moves; plus a coefficient check that confirms our
  per-level value for the folded pool upgrades matches their `UPGRADE_DEF`.
- **Cards:** the HP and reward multipliers for each rarity (standard, gilded,
  polychrome, and polychrome with the +15% upgrade).
- **Blocks:** base HP and armor for every tier and rarity, scaled across floors
  1 to 300, which exercises the deep-floor scaling including the two game bugs
  their engine preserves (the floor-150 armor skip and the floor-300
  double-trigger).
- **Block rewards:** the per-block xp and fragment yield for every tier and
  rarity (zero cards, gain multipliers at 1), against their `Block.xp` /
  `Block.frag_amt`.

Current result: **137/137 stats, 3/3 pool-upgrade coefficients, 8/8 card
multipliers, 260/260 block hp/armor, and 26/26 per-block xp/fragment yields
within tolerance.** Our per-point math, skill-buff upgrades, pool-upgrade
coefficients, card multipliers, block model, and per-block rewards all match
their source-faithful engine.

### Block-spawn model (`bash test/oracle/spawn.sh`)

Their spawn model is a fixed 24-slot grid: each slot rolls top-down (divine to
dirt) a "1-in-X" chance per unlocked rarity and takes the first hit, else stays
empty, with no minimum. The marginal per-slot probability that falls out of that
sequential roll equals our percentage rate table. Our model rolls all 24 slots
the same way (no minimum), and the check confirms both sides agree: 42/42 per-slot
rarity probabilities and 6/6 average active-node counts match their sampled
distribution.

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

The damage% and armor-pen% pool upgrades are folded into the displayed base in
our model (`reverseBaseStats` divides them back out), so they cannot be set on a
clean base without double-applying, and a same-build round trip cancels the
coefficient. But they join the same pool as the per-point `strDamagePct` /
`intArmorPen` that the stat scenarios already validate, so the only thing left is
the per-level coefficient, which the coefficient check compares directly against
their `UPGRADE_DEF`. The flat-damage, gem, and max-stamina upgrades are pure base
passthrough (no per-level coefficient on our side; they live in the entered
stat), so there is nothing to diverge.

### Two documented, benign differences

- **Super-crit multiplier when its chance is 0.** Their property reports `0`
  (it can never fire); ours reports the latent base `2.0`. The term is gated by
  the chance in combat, so damage is identical. The comparison skips it when the
  chance is 0.
- **Base armor rounding.** Their `project_config` rounds base armor to an integer
  (com4 = 22 vs our precise 22.46). That sub-1 difference is amplified by the
  floor scaling, so the block armor tolerance is 3%, which still catches any
  structural scaling error (a missed bug would be a large factor).

## 4. Run-results comparison (Phase 2)

`bash test/oracle/phase2.sh`

Runs a full dig many times in both engines (their
`CombatSimulator(player).run_simulation()` vs our `simulateOneRun`) and compares
the **blocks mined per dig**. Scenarios use zero upgrades/cards and no Luck or
Divinity, so there are no stamina refunds, crosshairs, or auto-abilities, leaving
a clean stamina-limited dig. Their micro-tick simulation and our model agree in
expectation, not exactly, so this is a tolerance comparison on averages.

Current result: **all 4 scenarios agree on blocks mined** (within 6%), and
xp per block matches within a few percent.

- **Blocks mined is the gated metric.** It depends on the spawn model, the
  hits-to-kill, and stamina, and once the spawn model matched it converged.
- **Floor reached is informational.** Our `floorReached` counts empty slots as
  within-floor progress (a per-slot accounting choice), so on the sparse low
  floors used here it reads higher than their integer `highest_floor`; the gap
  shrinks toward deep floors where slots are nearly all filled. The actual work
  done (blocks, stamina, xp) agrees.

Adding upgrade/card/ability configurations to this phase is the natural next
extension.

## Provenance

Their engine is MIT licensed (`vendor/LICENSE` after fetch). `fetch-engine.sh`
pulls it on demand; set `LOBO_REF` to pin a commit. Their code is not committed
to this repo.
