# Changelog

## 2026-06-27

### Fixed
- Speed-mod gain now scales with Corruption (the All-Mod Multiplier), matching the other mod gains. The imported speed-mod gain has the player's current Corruption backed out, and each candidate build re-applies its own Corruption — so the optimizer can correctly evaluate builds that distribute Corruption points. (Speed-mod chance and rate were already Corruption-aware; only the gain was missing.)
- Average floor was over-estimated (e.g. ~60 reported where the true value is ~54). Two causes: (1) the simulation modeled a Speed Mod as a one-block speedup instead of the in-game pool of extra fast attacks carried across blocks, which made each run take ~2x the in-game time and therefore triggered Flurry's cooldown-based stamina refund about twice as often, pushing runs deeper; (2) avg floor counted partial-floor credit for the floor a run died on. Speed Mod now banks a pool of fast attacks, and floor reached is reported as the integer "highest floor entered," matching the game. Validated against an independent reference simulator (now agree to within Monte-Carlo noise).

## 2026-06-26

### Added
- Save / load to a human-readable text file, so stats survive a cache clear. Export writes one "Setting: value" line per field (and one per card), grouped by section; load reads the same format back, and values can be hand-edited. Available from a Save / Load button in the header, a dismissible tip on the full app, and the guided stats step.

### Changed
- Result tables now show the actual XP and loot earned per hour; loot columns are real fragment amounts, not an XP-equivalent value. The blended XP-plus-loot figure is relabeled "Rewards Score" (it is a ranking number, not a quantity), and remains the optimizer's objective for the "all rewards" goal.

## 2026-06-24

### Changed
- One Run Simulation button replaces the separate Estimate and Simulate steps.
- Removed the Thorough search toggle; the search scores every build, then simulates the top candidates.
- Estimate and simulation share one goal-driven result card and table (Est. rank column kept).
- Result hero stats follow your goal; per-stamina tiles dropped; avg floor sits after the goal metric.
- Default candidate builds to simulate raised from 25 to 50.
- Run Simulation scrolls to the result and shows a loading state.

### Fixed
- Result ranking no longer places a build above others that beat it on both primary and secondary.
- Build search calibrated to the simulation (Enrage hits, attack speed), so the best build surfaces without a large candidate count.

## 2026-06-19

### Added
- Automatic build stamp in the footer (version and last updated).

### Fixed
- Screenshot stat import no longer fails intermittently.

## 2026-06-17

### Added
- Secondary-goal search sweeps the whole build space to find the secondary-best build family.

### Changed
- AI analysis contrasts genuinely different builds, briefly.
- "Find my best build" shows a progress bar.

### Fixed
- Near-tied top builds ordered by the noise-free model for a stable pick.
- Builds simulated on common random numbers, so close rankings are stable.
- Best build no longer dropped before simulation with a secondary goal; simulation honors the secondary goal.
- AI analysis retries once on a transient error.

## 2026-06-16

### Added
- Guided setup: a step-by-step flow, now the default landing.

### Changed
- Simulation table shows columns relevant to your goal, including the secondary; removed P10/P50/P90.
- Guided result keeps your simulation on Back; Start over resets cleanly.
- "Something not look right?" on the result is a small link, not a card, and opens the AI analyzer via the checklist.
- Cards are compact and shown directly in guided setup.
- Result tables open inside the guided flow.
- "All loot" goal relabeled "Loot only (no XP)".
- Simulate a specific build scores under your chosen goal.
- One Rewards / stamina metric instead of two.

### Fixed
- Higher-ascension upgrades no longer affect the sim after dropping ascension (values kept).
- Highest Stage imports from the screenshot and drives Block Bonker only when enabled.
- Crit damage from Strength valued correctly.
- Infernal cards selectable at any ascension.
- Target-floor goal optimizes for the chance of reaching the floor, not the average floor.

## 2026-06-15

### Added
- Target a specific block goal (max count per hour of a chosen tier and rarity).
- Block Bonker skill; per-upgrade Max button; Agility, Perception, Intellect skill-buff upgrades; Max all / Clear all.
- Divinity and Corruption columns in the simulation table.
- Ascension-mismatch warning.
- AI Diagnose this build, and a "Something not look right?" checklist.

### Changed
- Card menu grouped by tier.
- Estimate finds the best build without a large Top builds to keep.

### Fixed
- Locked tiers fall back to the highest unlocked tier instead of leaving empty floors.
- Quake AoE benefits from Enrage during overlap.

## 2026-06-14

### Added
- Export debug (download JSON).
- Simulate a specific build.
- Real-time throughput metrics (rewards/hr, per tick, floor, throughput breakdown).
- How it works page (about.html).
- Abilities in the build search (Enrage, Flurry, Quake).
- Attribute modifier upgrades; Infernal cards; +5 Stat Caps toggle.

### Changed
- Score is reward per stamina spent; XP and loot share one scale.
- Stamina refunds pool into your budget, capped at max stamina.
- Removed the Max floor input.
- Damage is additive across percent sources.
- Crosshairs run on the real-time clock; speed-mod attack rate from the stat.
- Settings panel reorganized; removed unused tools.

### Fixed
- Live search progress and button spinners.
- Simulation table sorting (fixed ranks, sort arrows).
- Upgrade fields are steppers; primary protection only with a secondary goal.
- Simulate disabled until a fresh estimate; +5 Stat Caps defaults off.
- Whole blocks per hour; whole-hit block breaking.
- Agility no longer grants Stamina Mod Chance; Instacharge shortens cooldowns.
