# Idle Obelisk Miner — Archaeology Optimizer

An intention-focused build optimizer for **Idle Obelisk Miner: Archaeology**.
Pick a goal, enter your current stats (manually or via screenshot OCR), and it
finds the strongest STR / AGI / PER / INT / Luck build for that goal, with
expected-value scoring plus Monte Carlo simulation to sanity-check it.

The app is one self-contained file, [`index.html`](index.html). A second page,
[`about.html`](about.html), is the "How it works" writeup (every formula, the data
sources, and the assumptions); the **?** at the top right of the app opens it.

## Open the app

**Live site (GitHub Pages):**

- ▶️ **https://caviarmy.github.io/archaeology-optimizer/**

  This serves the latest `main` and rebuilds automatically on every push/merge.
  Share this link. If you just deployed and see an old version, hard-refresh
  (Cmd/Ctrl+Shift+R) — GitHub purges its CDN on deploy, so first-time visitors
  always get the current build.

- 📄 [View the source on GitHub](https://github.com/caviarmy/archaeology-optimizer/blob/main/index.html)
- Rendered preview of any branch (fallback):
  `https://htmlpreview.github.io/?https://github.com/caviarmy/archaeology-optimizer/blob/main/index.html`

> Note: the plain `raw.githubusercontent.com` URL serves the file as text and
> will show source code, not the app — use a link above.

## Run locally

Because it's one HTML file, you can just open it — but a tiny local server
avoids browser file:// restrictions (and lets the OCR worker load):

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Or simply download `index.html` and double-click it.

## What's implemented

- Goal hierarchy: primary + secondary goal with a protection/tolerance band.
- Expected-value scoring across every legal build, with crit / super-crit
  breakpoints (not just average damage).
- Monte Carlo simulation to re-rank top candidates and estimate target-floor
  reach.
- Screenshot OCR import of base stats (Tesseract.js, loaded from CDN on first
  use — needs internet the first time).
- Node value table, node spawn-model toggle, and worthless-loot levers.
- **Ascension (A0 / A1 / A2)** with block-availability gating: A0 excludes
  divine and tier 4 blocks, A1 adds divine, A2 adds tier 4.
- Archaeology cards with normal / gilded / polychrome / infernal rarities and
  bulk set/clear controls. (Polychrome and infernal are recordable but neutral
  until their exact multipliers are confirmed.)

## Notes

- Optimization is in **tick-efficiency** terms (reward per attack tick); speed
  is intentionally excluded until a dedicated real-time mode is added.
- Loot is converted to an XP-equivalent value so mixed-reward goals share one
  score. Worthless-loot toggles change that baseline.
- Settings (stats, cards, ascension, goals) are saved to your browser's
  `localStorage` and restored on reload. Use **Reset all** to clear them. In
  sandboxed previews or private-browsing mode storage may be blocked; the app
  still works, it just won't remember between reloads.
</content>
</invoke>
