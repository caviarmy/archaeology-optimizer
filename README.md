# Idle Obelisk Miner — Archaeology Optimizer

An intention-focused build optimizer for **Idle Obelisk Miner: Archaeology**.
Pick a goal, enter your current stats (manually or via screenshot OCR), and it
finds the strongest STR / AGI / PER / INT / Luck build for that goal, with
expected-value scoring plus Monte Carlo simulation to sanity-check it.

The entire app is a single self-contained file: [`index.html`](index.html).

## Test it in your browser

**Open the live app (no setup, current branch):**

- ▶️ **[Open `index.html` (rendered)](https://htmlpreview.github.io/?https://github.com/caviarmy/archeology-optimizer/blob/claude/html-repo-modernization-dea9nv/index.html)**

  This renders the file on the current development branch
  (`claude/html-repo-modernization-dea9nv`). After each push, refresh to get the
  latest version (you may need a hard refresh / cache bypass).

- 📄 [View the source on GitHub](https://github.com/caviarmy/archeology-optimizer/blob/claude/html-repo-modernization-dea9nv/index.html)

> Note: the plain `raw.githubusercontent.com` URL serves the file as text and
> will show source code, not the app — use the rendered link above.

### Durable URL via GitHub Pages (recommended)

For a stable link that always serves the latest on a branch:

1. Repo **Settings → Pages**.
2. **Build and deployment → Source:** *Deploy from a branch*.
3. Pick the branch (e.g. `main` or `claude/html-repo-modernization-dea9nv`) and
   folder `/ (root)`, then **Save**.
4. After it builds, the app is served at
   **`https://caviarmy.github.io/archeology-optimizer/`**.

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
- The app currently keeps no saved state — settings reset on reload.
</content>
</invoke>
