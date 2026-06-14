# Changelog

## 2026-06-14

### Added
- **Simulate a specific build.** A collapsed section at the bottom lets you enter an attribute distribution (STR/AGI/PER/INT/Luck, plus Divinity/Corruption when unlocked) and simulate it directly — no estimate or search needed. It uses your entered stats for everything else and reports the same metrics as the main simulation (rewards per real-time hour, per tick, expected floor, target hit %, and the full throughput breakdown). These fields are independent and never affect the estimate.
- **Real-time throughput metrics.** Both the estimate and the simulation now headline rewards per real-time hour and rewards per tick (a run restarts at floor 1 with full stamina when it empties, so the rate is one run's total over its elapsed seconds; attack speed, Flurry, and speed mods all raise it). The estimate ranks builds by rewards per real-time hour; the estimate's number is approximate (the simulation is exact). The simulation's results table is sortable by any column and defaults to rewards per real-time hour, and its expandable Throughput detail shows blocks per hour by tier and rarity, plus XP and loot value per hour.
- **How it works page** (`about.html`, opened with the `?` button). It explains each mechanic in plain language, gives worked numeric examples (damage, crit, armor, mods, gleaming, crosshairs), and includes a calculator to check the math.
- **Abilities in the build search.** Enrage uptime, Flurry stamina refund, and Quake area damage are now scored in Estimate best build as well as in the simulation.
- **Attribute modifier upgrades.** Per-stat upgrades that raise what each attribute point gives (Strength A0 and A1, Corruption A2, Divinity A2: extra flat damage, percent damage, crit and super crit, auto-tap, and speed mod chance per point). These feed both the search and the simulation.
- **Infernal cards.** Per-card buffs plus the Ascension 2 infernal multiplier.
- **Divinity and Corruption columns** in the top builds table.
- **+5 Stat Point Caps upgrade toggle**, and a warning when entered stats look inconsistent.

### Changed
- **Score is now reward per stamina spent** instead of per attack swing. Experience and loot share one scale: loot is valued at the block's own experience, with a loot weight setting.
- **Stamina refunds now pool into your budget and cannot exceed your max stamina.** Each block refunds up to 10, matching the game. Before, a refund was treated as a discount on a block's cost.
- **Removed the Max floor input.** A dig always runs until stamina is spent.
- **Damage is additive.** All percent sources (attributes, upgrades, bonus damage and armor pen percents) are pooled before they apply, rather than compounding.
- **Crosshairs run on the real-time clock** in the simulation: they spawn, fire, and can be gold, one per block, auto-tap only.
- **Speed mod attack rate** now reads from the actual stat in the simulation.
- Reorganized the settings panel. Stat fields stay visible instead of being hidden by ascension.
- Rewrote the How it works page for clearer flow, and split the assumptions into sourced, method, and estimated.
- Removed unused tools (floor-push, greedy path, manual build advisor, node table).

### Fixed
- **Simulate best build is disabled until a fresh estimate exists**, and re-disables whenever a setting changes, so you can't simulate stale builds.
- **+5 Stat Pt. Caps now defaults to off** and reliably applies/removes (the two linked checkboxes and the simulate gating stay in sync through the settings modal).
- **Throughput detail shows whole blocks per hour** ("<1" for rarer-than-hourly), since blocks are discrete.
- Renamed the estimate section to **"Estimated best build"** so it's clear it's the fast estimate to confirm with Simulate.
- **Agility no longer grants Stamina Mod Chance** (the game does not give it).
- **Instacharge** now shortens ability cooldowns, which raises uptime.
- Crit, super crit, and ultra crit now resolve the same way in the search and the simulation.
- Breaking a block counts whole hits instead of dividing HP by average damage.
- Added a floor-cap safety bound of 1000. Made the input reader free of side effects. Fixed the optimizer pairwise line search. Stopped the settings header from covering content.
