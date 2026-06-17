// Obelisk Miner OCR proxy — Cloudflare Worker.
//
// Holds the Gemini API key (as a secret) and turns a stats-panel screenshot into
// the structured JSON the optimizer expects. The browser app POSTs:
//     { "image": "data:image/jpeg;base64,...." }
// and gets back:
//     { "stats": { "selectedLevel": 100, "baseDamage": 1396, ... } }
//
// Deploy: see README.md in this folder.

// Field keys returned to the app — these match the input element IDs in index.html.
const FIELDS = [
  "selectedLevel","highestFloor","baseDamage","baseStamina","baseCritChance","baseCritDamage",
  "baseSuperChance","baseSuperDamage","baseUltraChance","baseUltraDamage","baseAtkSpeed",
  "baseArmorPenFlat","baseInstacharge","baseAutoTap","baseGoldCrosshairChance","baseGoldCrosshairMulti",
  "baseGleamingChance","baseGleamingMulti","baseXpGain","baseFragGain","baseXpMod","baseXpModGain",
  "baseLootMod","baseLootModGain","baseSpeedMod","baseSpeedModGain","baseSpeedModAtkRate",
  "baseStaminaMod","staminaModGain",
  "enrageDmgPct","enrageCritDmgPct","enrageCharges","enrageCooldown",
  "flurryAtkSpeedPct","flurryStaminaOnCast","flurryCharges","flurryCooldown",
  "quakeDmgPct","quakeCharges","quakeCooldown"
];

// Gemini's responseSchema uses uppercase OpenAPI type enums (OBJECT/NUMBER).
const SCHEMA = {
  type: "OBJECT",
  properties: Object.fromEntries(FIELDS.map(f => [f, { type: "NUMBER", nullable: true }]))
};

const PROMPT = `You are reading a screenshot from the idle game "Obelisk Miner": its Archaeology "Stats" panel, and (if visible) the three ability cards below it (Enrage, Flurry, Quake). Extract the values into the provided JSON schema.

Formatting rules:
- Percentages: number only, drop the % (e.g. "66.25%" -> 66.25).
- Multipliers: number only, drop the x (e.g. "4.21x" -> 4.21).
- Flat/integer stats: the integer (e.g. "Damage: 1396" -> 1396; "+30" -> 30; "2/sec" -> 2).
- Read every value straight from its OWN row's printed digits. Never copy or reuse a number from another field — neighbouring rows like "Exp Mod Gain" and "Loot Mod Gain" are independent and usually DIFFER. Transcribe exactly what is shown on each line.
- If a field is NOT visible in the image, set it to null. Never guess or infer.

Stat panel mapping (label -> key):
Archaeology Level=selectedLevel, Highest Stage=highestFloor, Damage=baseDamage, Max Stamina=baseStamina, Crit Chance=baseCritChance, Crit Damage=baseCritDamage, Super Crit Chance=baseSuperChance, Super Crit Damage=baseSuperDamage, Ultra Crit Chance=baseUltraChance, Ultra Crit Damage=baseUltraDamage, Atk Speed=baseAtkSpeed, Armor Penetration=baseArmorPenFlat, Ability Instacharge=baseInstacharge, Crosshair Auto-Tap=baseAutoTap, Gold Crosshair Chance=baseGoldCrosshairChance, Gold Crosshair Multi=baseGoldCrosshairMulti, Gleaming Floor Chance=baseGleamingChance, Gleaming Floor Multi=baseGleamingMulti, Exp Gain=baseXpGain, Fragment Gain=baseFragGain, Exp Mod Chance=baseXpMod, Exp Mod Gain=baseXpModGain, Loot Mod Chance=baseLootMod, Loot Mod Gain=baseLootModGain, Speed Mod Chance=baseSpeedMod, Speed Mod Gain=baseSpeedModGain, Speed Mod Atk Rate=baseSpeedModAtkRate, Stamina Mod Chance=baseStaminaMod, Stamina Mod Gain=staminaModGain.

Ability cards (each card has a charges badge next to a sword/charge icon and a cooldown-in-seconds badge next to an hourglass icon, plus effect text):
Enrage "+N% Damage"=enrageDmgPct, Enrage "+N% Crit Damage"=enrageCritDmgPct, Enrage charges=enrageCharges, Enrage cooldown seconds=enrageCooldown,
Flurry "+N% Atk Speed"=flurryAtkSpeedPct, Flurry "+N Stamina On Cast"=flurryStaminaOnCast, Flurry charges=flurryCharges, Flurry cooldown seconds=flurryCooldown,
Quake "deal N% Damage"=quakeDmgPct, Quake charges=quakeCharges, Quake cooldown seconds=quakeCooldown.

The RIGHT column is dense and easy to misalign. Walk it strictly top-to-bottom and output a value for EVERY visible row without skipping any. Its order is:
Exp Gain, Fragment Gain, Exp Mod Chance, Exp Mod Gain, Loot Mod Chance, Loot Mod Gain, Speed Mod Chance, Speed Mod Gain, Speed Mod Atk Rate, Stamina Mod Chance, Stamina Mod Gain.
Each "... Mod Chance" is a % and the "... Mod Gain" beneath it is a SEPARATE value — read both from their own lines and never reuse one row's number for a neighbour. In particular Exp Mod Gain, Loot Mod Chance, and Loot Mod Gain are three different numbers on three different lines.

Return ONLY the JSON object.`;

// Text-only "diagnose" prompt. The app POSTs { action:"explain", debug:{...} }
// (a trimmed export from the optimizer) and gets back { explanation: "..." }.
const EXPLAIN_PROMPT = `You are explaining a build optimizer's result for the idle game "Idle Obelisk Miner: Archaeology" to a player. Reason from the data in front of you; derive the answer from how builds are scored and from the numbers given. Do not recite a fixed story or assume any stat is best or worst.

HOW BUILDS ARE SCORED (the value function)
- The player has a fixed pool of capped stat points (from their Archaeology Level) to spread across the stats below. The tool ran a Monte-Carlo SIMULATION of real runs for every distribution (shared random rolls) and ranked them. The ranking is the simulation's verdict, not a damage heuristic.
- Judge every build by the player's goal, read from the data: the primary goal is the metric being maximized; a secondary goal, if set, is a second metric protected within a tolerance (a build that wins on primary but drops the protected secondary past tolerance is penalized); "objective" can be total (loot value + XP per hour), xp (XP per hour), or target (chance to reach a target floor). Explain everything in terms of THESE goals.

WHAT EACH STAT POINT GIVES (base per point, before upgrades; cap in parentheses)
- Strength (50): +1 flat damage, +1% damage, +3% crit damage
- Agility (50): +5 max stamina, +1% crit chance, +0.20% speed-mod chance
- Perception (25): +4% fragment gain, +0.30% loot-mod chance, +2 flat armor penetration
- Intellect (25): +5% experience gain, +0.30% experience-mod chance, +3% armor penetration (percent)
- Luck (25): +2% crit chance, +0.20% to all mod chances, +0.50% gold-crosshair chance
- Divinity (needs Ascension 1; 10): +2 flat damage, +2% super-crit chance, +2% crosshair auto-tap
- Corruption (needs Ascension 2; 10): +6% damage, -3% max stamina, +1% to all mod multipliers
Upgrade levels can raise what a point of a stat gives. Caps mean the optimizer must spread a limited pool, so over-investing one stat means starving another.

SIM CONSTRAINTS BUILDS COMPETE UNDER
- Damage per hit = flat * (1 + sum of ALL damage %). Percents are pooled then applied once, so a Strength point's +1% is +1% of the flat, not of an inflated total.
- Stamina caps how many hits a run gets (Agility adds stamina; Corruption trades stamina for damage). Too little damage means you cannot break deep blocks before stamina runs out.
- Each block has armor that subtracts from every hit; armor penetration (Perception flat, Intellect percent) keeps hits landing on deeper and ascended (divine/corrupt) blocks. Without enough pen, extra damage is wasted against armor and deep floors stall.
- Rewards scale with mod chance/gain: XP via Intellect (+Luck), loot via Perception (+Luck); Corruption raises all mod-gain multipliers; crit/super-crit raise per-hit output; gleaming/gold-crosshair add reward multipliers.
- Reward over a run is, in effect, how many blocks you clear times how much each is worth. The per-build metrics expose both sides — blocksPerHour and floorReached (how many blocks, how deep) versus rewardsPerStam, xpPerHour and allLootPerHour (how much each block and each point of stamina yields), with rewardsPerHour combining them. Work out from the numbers which side is carrying each build; do not assume one matters more.
A high-scoring build is one whose qualities clear the hurdles that matter for the player's goal; a lower-scoring one falls short on at least one of them.

YOU ARE GIVEN: the player's parsed inputs, upgrades, and goals. "goals" includes primaryGoalLabel, secondaryGoalLabel (or "none"), and "protection" — a plain-English statement of how a secondary goal is weighed against the primary (strict, or "may reduce the primary by up to N%"). "simulation.heroCard" is the winning build and its scores; "simulation.topResults" is the winner, the HEAVIEST build the search tried for each stat (what each lever buys at its limit and how it actually scored), and other strategically different builds. Each result carries: stats, simRank, rewardsPerHour, rewardsPerStam, blocksPerHour, xpPerHour, allLootPerHour, floorReached; primaryGoalValue and (when a secondary is set) secondaryGoalValue — the per-hour amount of exactly the metric each goal maximizes; and the mechanistic levers damage, critChancePct and maxStamina (the build's derived per-hit damage, crit chance, and max stamina). "estimate.topBuilds" is the EV pre-ranking. Compare using the SIMULATED results.

YOUR TASK — solve for the why, from the data, not from a template:
- Never argue that a build is better merely because a number is higher. For every comparison, name the MECHANISM: which lever the build has more or less of (damage, crit, stamina, armor pen, a specific mod chance/gain — use the damage/critChancePct/maxStamina fields and the stat point effects above) and why that lever helps or hurts THIS goal given how rewards are produced (clearing more/deeper blocks before stamina runs out, versus extracting more reward per block).
- Anchor on the goal's own metric: cite primaryGoalValue for the primary, and when a secondary is set, compare secondaryGoalValue across builds too. Say explicitly whether the winner also serves the secondary, or whether the "protection" tolerance let the primary give up a little to gain on the secondary — quote the protection rule and the numbers.
- For each genuinely different candidate you discuss, reason from ITS stats, levers and goal values why it ranks where it does: which hurdle it clears better or worse, and how that nets out. Let the numbers decide whether a very different build is a near-equal alternative or clearly behind — do not pre-judge by which stat it favors.
- If a player might over-generalize that a stat is always best or always useless, correct it only by showing, from THIS run, why the outcome is situational; never make blanket claims.
- End with one concrete takeaway tied to the player's goal(s).

WRITE plain text only (no markdown, asterisks, or "#"), about 7-10 sentences or "- " bullets, addressed to the player as "you". Cite real numbers from the data; never dump the JSON. If there is no completed build or run, say so and tell them to run Estimate then Simulate first.`;

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  let allow = "*";
  if (env.ALLOWED_ORIGINS) {
    const list = env.ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
    allow = list.includes(origin) ? origin : list[0] || "*";
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

const RL_TTL = 172800; // 2-day TTL so yesterday's counters self-clean.
function ipOf(request) { return request.headers.get("CF-Connecting-IP") || "unknown"; }
function today() { return new Date().toISOString().slice(0, 10); }

// Lightweight per-IP daily cap for OCR. Only active if a KV namespace is bound as `RL`.
async function ocrRateLimited(env, request) {
  if (!env.RL) return false;
  const key = `rl:${today()}:${ipOf(request)}`;
  const limit = Number(env.DAILY_LIMIT || 100);
  const current = Number((await env.RL.get(key)) || 0);
  if (current >= limit) return true;
  await env.RL.put(key, String(current + 1), { expirationTtl: RL_TTL });
  return false;
}

// The per-day counters reset at the next UTC midnight (keys are keyed by UTC date).
function nextUtcMidnight() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0)).toISOString();
}

// Stricter gate for the AI "diagnose" call: a per-IP daily cap (default 1) AND a
// global daily ceiling (default 200) so total spend is bounded even under abuse.
// Both counters are read first and only incremented when the call is allowed.
// Returns the per-IP limit/used and the reset time so the client can show a count
// and a "resets in HH:MM:SS" countdown.
async function explainGate(env, request) {
  const ipLimit = Number(env.EXPLAIN_DAILY_LIMIT || 1);
  const resetsAt = nextUtcMidnight();
  if (!env.RL) return { ok: true, limit: ipLimit, used: 0, resetsAt };
  const day = today();
  const ipKey = `rlx:${day}:${ipOf(request)}`;
  const globKey = `rlxg:${day}`;
  const globLimit = Number(env.EXPLAIN_GLOBAL_LIMIT || 200);
  const ipCur = Number((await env.RL.get(ipKey)) || 0);
  if (ipCur >= ipLimit) return { ok: false, reason: "You have used today's AI diagnosis.", limit: ipLimit, used: ipCur, resetsAt };
  const globCur = Number((await env.RL.get(globKey)) || 0);
  if (globCur >= globLimit) return { ok: false, reason: "AI diagnosis is busy today. Try again tomorrow.", limit: ipLimit, used: ipCur, resetsAt };
  await env.RL.put(ipKey, String(ipCur + 1), { expirationTtl: RL_TTL });
  await env.RL.put(globKey, String(globCur + 1), { expirationTtl: RL_TTL });
  return { ok: true, limit: ipLimit, used: ipCur + 1, resetsAt };
}

// Text-only Gemini call that explains why a build scored well.
async function handleExplain(env, body, cors, gate) {
  let debugStr;
  try { debugStr = JSON.stringify(body.debug); } catch { return json({ error: "'debug' is not serialisable" }, 400, cors); }
  if (typeof debugStr !== "string" || debugStr.length < 2) return json({ error: "Missing 'debug' snapshot" }, 400, cors);
  if (debugStr.length > 120000) debugStr = debugStr.slice(0, 120000); // bound tokens/cost

  const model = env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: EXPLAIN_PROMPT + "\n\nBUILD DATA (JSON):\n" + debugStr }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 750 }
  };

  let gem;
  try {
    gem = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (e) {
    return json({ error: "Could not reach Gemini", detail: String(e) }, 502, cors);
  }
  if (!gem.ok) {
    const detail = (await gem.text()).slice(0, 600);
    return json({ error: "Gemini request failed", status: gem.status, detail }, 502, cors);
  }
  const out = await gem.json();
  const text = (out?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!text) return json({ error: "Model returned an empty explanation" }, 502, cors);
  const usage = gate ? { limit: gate.limit, used: gate.used, resetsAt: gate.resetsAt } : {};
  return json({ explanation: text, ...usage }, 200, cors);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (!env.GEMINI_API_KEY) return json({ error: "Worker is missing the GEMINI_API_KEY secret" }, 500, cors);

    if (env.ALLOWED_ORIGINS) {
      const list = env.ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
      const origin = request.headers.get("Origin") || "";
      if (origin && !list.includes(origin)) return json({ error: "Origin not allowed" }, 403, cors);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400, cors); }

    // Two actions share this worker: OCR (image -> stats) and the AI "diagnose"
    // explanation (debug snapshot -> text). They have separate daily caps.
    if (body && (body.action === "explain" || body.debug)) {
      const gate = await explainGate(env, request);
      if (!gate.ok) return json({ error: gate.reason, limit: gate.limit, used: gate.used, resetsAt: gate.resetsAt }, 429, cors);
      return handleExplain(env, body, cors, gate);
    }

    if (await ocrRateLimited(env, request)) return json({ error: "Daily limit reached, try again tomorrow" }, 429, cors);

    const dataUrl = body && body.image;
    if (typeof dataUrl !== "string") return json({ error: "Missing 'image' (base64 data URL)" }, 400, cors);
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
    if (!m) return json({ error: "'image' must be a base64 data URL" }, 400, cors);
    const mimeType = m[1], b64 = m[2];
    if (b64.length > 9_000_000) return json({ error: "Image too large (downscale before sending)" }, 413, cors);

    const model = env.GEMINI_MODEL || "gemini-2.0-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType, data: b64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA }
    };

    let gem;
    try {
      gem = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch (e) {
      return json({ error: "Could not reach Gemini", detail: String(e) }, 502, cors);
    }
    if (!gem.ok) {
      const detail = (await gem.text()).slice(0, 600);
      return json({ error: "Gemini request failed", status: gem.status, detail }, 502, cors);
    }

    const out = await gem.json();
    const text = out?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let stats;
    try { stats = JSON.parse(text); } catch { return json({ error: "Model returned non-JSON", raw: text.slice(0, 600) }, 502, cors); }

    // Keep only known numeric fields; drop nulls so the client doesn't overwrite with blanks.
    const clean = {};
    for (const f of FIELDS) {
      const v = stats[f];
      if (typeof v === "number" && isFinite(v)) clean[f] = v;
    }
    return json({ stats: clean }, 200, cors);
  }
};
