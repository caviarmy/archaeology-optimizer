# Changelog

## 2026-06-14

### Added
- **"How it works" page** (`about.html`, opened with the `?` button) — plain-language explanations, worked numeric examples (damage, crit/super/ultra, armor, mods, gleaming, crosshairs), and an interactive "test the math" calculator.
- **Abilities in the build search** — Enrage uptime, Flurry's stamina refund, and Quake's AoE damage are now credited in *Estimate best build*, not just the simulation.
- **Attribute-modifier "Skill Buff" upgrades** — per-stat upgrades that raise what each attribute point gives (Strength A0/A1, Corruption A2, Divinity A2: extra flat damage, %damage, crit/super-crit, auto-tap, and speed-mod chance per point), factored into both the search and the simulation.
- **Infernal cards** — per-card buffs plus the Ascension-2 infernal multiplier.
- **Divinity / Corruption columns** in the top-builds table.
- **"+5 Stat Point Caps" toggle** (All Stat Point Caps idol) and an inconsistent-input warning.

### Changed
- **Scoring is now reward per stamina spent** (was per attack swing), with experience and loot on one neutral scale (loot valued at the block's own XP, plus a loot-weight setting).
- **Stamina refunds pool into your budget and cap at max stamina**, with the per-block refund capped at 10 — matching the game (was a per-block cost discount).
- **Removed the Max floor input** — a dig always runs until stamina is spent.
- **Additive damage model** — all percent sources (attributes, upgrades, bonus damage% / armor-pen%) pool before they apply, instead of compounding.
- **Crosshairs modeled in real time** — spawn / fire / gold, one per block, auto-tap only.
- **Speed-mod attack rate** now uses the actual stat in the simulation.
- Settings panel restructured; stat fields shown flat instead of hidden by ascension.
- Docs overhauled for flow and clarity; assumptions split into sourced / method / estimated.
- Removed dead tools (floor-push, greedy path, manual-build advisor, node table).

### Fixed
- **Agility no longer grants Stamina Mod Chance** (wiki mismatch).
- **Instacharge** now shortens ability cooldowns, raising uptime.
- Crit / super / ultra ladder made consistent between the search and the simulation.
- "Breaking a block" uses the exact whole-hit count, not HP ÷ average.
- Floor-cap safety bound (1000); `getInputs` made side-effect-free; optimizer pairwise line-search fix; settings header no longer covers content.
