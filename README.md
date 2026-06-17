# Idle Obelisk Miner: Archaeology Optimizer

A build optimizer for the Archaeology mode in Idle Obelisk Miner. You give it your
current stats and the reward you want more of, and it returns the attribute spread
(Strength, Agility, Perception, Intellect, Luck, and Divinity/Corruption once
unlocked) that produces the most of it, along with the numbers behind the answer.

The app is one self-contained file, [`index.html`](index.html). A second page,
[`about.html`](about.html), is the "How it works" writeup with every formula, the
data sources, and the assumptions. The **?** at the top right of the app opens it.

## What it is for

Archaeology gives you a fixed pool of attribute points and several stats to spend
them on, each with its own cap. The best split changes with your stats, upgrades,
cards, ascension, and which reward you are chasing, so working it out by hand means
guessing. This tool searches the build space and shows the result.

It is built to be quick to use and easy to read. The default path is a short
guided setup: choose a goal, set your ascension, upload one stat screenshot, and
read the recommended build. The full interface is one click away for anyone who
wants to set every field themselves.

## Goals

- Answer one question well: given these stats and this goal, how should you spend
  attribute points.
- Score builds honestly. Candidates are ranked by a Monte Carlo simulation of real
  runs, not a damage shortcut, and the about page documents the method.
- Be usable on a phone in about a minute, without reading a manual.
- Keep the math visible. Every input the optimizer uses is shown, the recommended
  build comes with its supporting tables, and an optional AI explanation reasons
  from the same numbers.

## Scope

In scope: optimizing the attribute spread for a chosen reward goal at your current
level, ascension, upgrades, and cards; importing stats from a screenshot;
simulating and comparing the top builds; targeting a specific block tier and
rarity, or a target floor.

Out of scope: planning upgrade purchase order, modeling progression across game
modes, and connecting to your account. If you want heavier modeling and planning,
[lobogrande's calculator](https://iom-arch-optimizer-web.vercel.app/) goes deeper.

## Open the app

Live site (GitHub Pages), serving the latest `main`:

- https://caviarmy.github.io/archaeology-optimizer/

If you just deployed and see an old version, hard-refresh (Cmd/Ctrl+Shift+R).
[View the source on GitHub](https://github.com/caviarmy/archaeology-optimizer/blob/main/index.html).

## Run locally

It is one HTML file, so you can open it directly, but a small local server avoids
browser file:// restrictions and lets the screenshot OCR worker load:

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## How it works (short version)

- Goals: a primary goal plus an optional secondary goal with a protection
  tolerance, so you can favor one reward while keeping a floor under another.
- Search: an expected-value pass proposes starting points, then a guided search
  hill-climbs directly on the simulation, which is the unbiased measure of a build.
- Simulation: top candidates are replayed on shared random rolls (common random
  numbers) so the better build wins on merit, not luck.
- Inputs: stats can be typed in or read from a screenshot (Tesseract plus an AI
  pass, loaded on first use, so the first import needs internet). Ascension gates
  which blocks and stats exist (A0 base, A1 adds divine, A2 adds tier 4). Cards,
  upgrades, and infernal multipliers are walked out of your shown stats and
  re-applied so the optimizer reasons about your true base.

Full detail, including the formulas and the accuracy testing, is in
[`about.html`](about.html).

## Notes

- Settings are saved to your browser's `localStorage` and restored on reload. Use
  Reset all to clear them. In sandboxed previews or private browsing, storage may
  be blocked; the app still works, it just will not remember between reloads.
- The screenshot OCR and the AI build explanation call a Cloudflare Worker
  (`worker/worker.js`). Prompt or field changes there only take effect after the
  worker is redeployed with `wrangler deploy`.
