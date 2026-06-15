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
  "selectedLevel","baseDamage","baseStamina","baseCritChance","baseCritDamage",
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
Archaeology Level=selectedLevel, Damage=baseDamage, Max Stamina=baseStamina, Crit Chance=baseCritChance, Crit Damage=baseCritDamage, Super Crit Chance=baseSuperChance, Super Crit Damage=baseSuperDamage, Ultra Crit Chance=baseUltraChance, Ultra Crit Damage=baseUltraDamage, Atk Speed=baseAtkSpeed, Armor Penetration=baseArmorPenFlat, Ability Instacharge=baseInstacharge, Crosshair Auto-Tap=baseAutoTap, Gold Crosshair Chance=baseGoldCrosshairChance, Gold Crosshair Multi=baseGoldCrosshairMulti, Gleaming Floor Chance=baseGleamingChance, Gleaming Floor Multi=baseGleamingMulti, Exp Gain=baseXpGain, Fragment Gain=baseFragGain, Exp Mod Chance=baseXpMod, Exp Mod Gain=baseXpModGain, Loot Mod Chance=baseLootMod, Loot Mod Gain=baseLootModGain, Speed Mod Chance=baseSpeedMod, Speed Mod Gain=baseSpeedModGain, Speed Mod Atk Rate=baseSpeedModAtkRate, Stamina Mod Chance=baseStaminaMod, Stamina Mod Gain=staminaModGain.

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
const EXPLAIN_PROMPT = `You are explaining the output of an optimizer for the idle game "Obelisk Miner" Archaeology mode to a player.

How the optimizer works (so you can explain its reasoning):
- The player spends attribute points (e.g. Strength, Agility, Perception, Intelligence, Luck). The tool searches for the point distribution that maximises the player's chosen objective.
- It scores every candidate by running a Monte-Carlo SIMULATION of real archaeology runs (many runs, fixed seed) and reading the average result. A fast expected-value (EV) math model only seeds starting points; the final ranking always comes from the simulation, so it is not biased toward raw damage.
- The objective is one of: total rewards per hour (loot value + XP), XP only, or reaching a target floor. "rewardsPerHour" / "rewardsPerTick" / "floorReached" in the data are simulation outputs.
- Stats interact: damage and crit raise per-hit output, stamina and attack speed raise how many hits you get, armor penetration counters block scaling on higher floors and after ascension (Divinity/Corruption blocks), and XP/loot/fragment mods raise reward yield. Upgrades change how much each attribute point is worth.

You are given the player's parsed inputs, the chosen ("best") build, and the top few alternative builds the search compared.

Write a SHORT explanation (~4-6 sentences or tight lines) of WHY the recommended distribution scored best for THIS player: which attributes are carrying the result and the mechanism (e.g. "PER pushes armor pen so your hits stop getting blocked on deep floors"), and one notable trade-off vs the runner-up if visible. Speak to the player as "you". Use PLAIN TEXT only — no markdown, no asterisks for bold, no "#" headers; separate ideas with blank lines or "- " bullets. Do not dump raw numbers or restate the whole JSON; reference at most a few key figures. If the data shows no completed run/build, say so and suggest running the estimate first.`;

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
    generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
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
