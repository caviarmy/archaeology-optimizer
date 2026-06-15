# Changelog

## 2026-06-15

### Fixed
- **Locked tiers now fall back instead of leaving empty floors.** Tier-4 blocks need Ascension 2 and divine blocks need Ascension 1. Previously, on deep floors where a block type's only variant was a locked tier (e.g. dirt past floor 80 at A1), that type produced no block — its spawn slots silently contributed nothing, and a floor 150+ at A1 could resolve to no blocks at all, under-counting rewards. Now the type keeps spawning its highest unlocked tier (tier 3), scaled for depth, so floors stay populated and the spawn distribution is correct at every ascension.

### Added
- **Ascension-mismatch warning.** Some stats can't exist below a given ascension (per the game wiki): Crosshair Auto-Tap and Divinity need A1; Gleaming Floor Chance and Corruption need A2. If one is present while Ascension is set lower, the app now warns hard — a red banner on the result, a red border on the Ascension selector, and a red note in the help bubble — while still running. Because Crosshair Auto-Tap is read from the stat screenshot, this catches the common blunder of importing an ascended account but leaving Ascension at A0.
- **AI "Diagnose this build" in the checklist bubble.** A button at the bottom of the help bubble sends a trimmed snapshot of your build (parsed inputs, chosen build, and the top alternatives — not your account, and not the heavy per-row sim data) to the existing Cloudflare worker, which asks Google Gemini for a short plain-language reason the recommended distribution scored well. The worker enforces the cap server-side: one diagnosis per visitor per day, plus a global daily ceiling so worst-case spend stays bounded; cost is well under 1¢ per call. Requires the worker to be redeployed (`wrangler deploy`) to activate.
- **"Something not look right?" checklist.** A help link under the estimate and the simulation opens a short bubble of the usual setup gaps: ascension, attributes at 0 vs spent points, the +5 stat-cap upgrade, attribute and damage upgrades, cards, the infernal multiplier, and the Polychrome bonus. It reads your current inputs and flags the ones that look unset (for example all upgrade levels at 0, or no cards set), shows each item's current state, and tapping an item jumps straight to that setting and highlights it.

### Changed
- **Simulation now models Instacharge as an explicit proc with stacking charges.** When an ability is cast, each use has the Instacharge chance to instantly reset its cooldown and recast on the spot, and the charges accumulate (a 5-charge ability that double-casts grants 10), chaining while it keeps procing. Previously the simulation approximated this as a flat shortened cooldown (`cooldown × (1 − instacharge)`). The average cast rate is identical, so the estimate and simulation stay consistent (EV↔sim ratio unchanged), but the simulation now reflects the real stacking behavior. The fast estimate keeps the analytic average.
- **Default block-spawn model now honors the per-slot empty chance.** A non-boss floor lays out 24 slots: the first 6 always fill (their type drawn from the wiki rates renormalized to drop the empty chance), and the remaining 18 fill per-slot at the raw wiki rate — so the leftover (100 − sum of rates) is a genuine empty slot. This replaces the old approach, which rolled a uniform 6–24 "active node count" and discarded the empty chance entirely. The estimate and the simulation use the same model (verified consistent), and both now reflect ~19 active blocks on a deep floor instead of a flat 15. Boss floors (fixed 24-block layouts) and the optional per-slot model are unchanged.
- **The estimate now searches on the simulation itself, not on the math model.** Before, the fast math model (EV) ranked builds and only its top picks were ever simulated. That model over-credited damage-heavy builds, so a genuinely better build could be filtered out before the simulation ever saw it. Now the math model only suggests starting points, and the optimizer hill-climbs directly on the simulation (the unbiased measure of a build). On real configs this finds builds a few percent better than even an exhaustive scan of the old model, while staying anti-bias: it picks heavy Strength when Strength upgrades make it genuinely best, and Intelligence/Luck when they do.
- **Fair, fast build comparisons.** Every build in a comparison is simulated on the same random rolls (common random numbers), so the better build wins on merit, not luck. The number of runs per build adapts to the level (more runs where each run is cheap, fewer where runs are deep), and a time budget keeps the search responsive: it always covers the promising builds and pure-stat extremes, then explores random restarts until the budget is spent. Live progress shows the runs-per-build and how many builds have been tried.
- **The estimate table shows as many builds as you keep.** It used to show a fixed 10 rows. Now it shows the full "Top builds to keep" count, the same builds that Simulate re-ranks. Its rewards-per-hour column is relabeled from "EV" to "Est." since the value now comes from the simulation.
- **"Top builds to keep" now goes up to 1000** (was capped at 100), and the setting is renamed from "Top reward builds to rerank" to make clear it controls both what the estimate shows and what Simulate re-ranks.
- **New How it works section, "Finding the best build."** It leads with the punchline (how often the workflow returns the best build and the average gap when it does not), then explains why the optimum cannot be brute-forced (84M builds at level 100 A2, about 39 years to simulate), how the guided search and common random numbers work, the plateau and the simulation noise floor, the measured accuracy at low levels (provable) and at end-game (a best-known reference), and why this is as close as is feasible. The optimizer and assumptions sections were updated to match.

## 2026-06-14

### Added
- **Export debug (download JSON).** A button at the very bottom downloads a full snapshot (every input value, the parsed inputs, the estimate and simulation result tables, the manual-build simulation, and the app version/environment) as a single JSON file for review and analysis.
- **Simulate a specific build.** A collapsed section at the bottom lets you enter an attribute distribution (STR/AGI/PER/INT/Luck, plus Divinity/Corruption when unlocked) and simulate it directly, with no estimate or search needed. It uses your entered stats for everything else and reports the same metrics as the main simulation (rewards per real-time hour, per tick, expected floor, target hit %, and the full throughput breakdown). These fields are independent and never affect the estimate.
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
- **Live search progress + spinners.** Thorough search now reports "Searching every build… X / Y (Z%)" as it goes, and the Estimate / Simulate / Simulate-this-build buttons show a spinner while running.
- **Sim table sorting fixed.** Sim Rank is now a fixed property of each build (ranked by rewards per real-time hour), so sorting by another column reorders rows without changing ranks; headers show a ▲/▼ sort arrow; and the hero card always shows the rank-1 build regardless of how you sort.
- **Upgrade-level fields are now −/+ steppers** (Attribute modifiers and damage/armor-pen bonuses), so it's clear you enter a whole level, not a free value.
- **Primary protection only appears when a secondary goal is set** (it has no effect without one).
- **Simulate best build is disabled until a fresh estimate exists**, and re-disables whenever a setting changes, so you can't simulate stale builds.
- **+5 Stat Pt. Caps now defaults to off** and reliably applies/removes (the two linked checkboxes and the simulate gating stay in sync through the settings modal).
- **Throughput detail shows whole blocks per hour** ("<1" for rarer-than-hourly), since blocks are discrete.
- Renamed the estimate section to **"Estimated best build"** so it's clear it's the fast estimate to confirm with Simulate.
- **Agility no longer grants Stamina Mod Chance** (the game does not give it).
- **Instacharge** now shortens ability cooldowns, which raises uptime.
- Crit, super crit, and ultra crit now resolve the same way in the search and the simulation.
- Breaking a block counts whole hits instead of dividing HP by average damage.
- Added a floor-cap safety bound of 1000. Made the input reader free of side effects. Fixed the optimizer pairwise line search. Stopped the settings header from covering content.
