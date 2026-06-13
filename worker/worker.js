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

Return ONLY the JSON object.`;

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

// Lightweight per-IP daily cap. Only active if a KV namespace is bound as `RL`.
async function rateLimited(env, request) {
  if (!env.RL) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:${day}:${ip}`;
  const limit = Number(env.DAILY_LIMIT || 100);
  const current = Number((await env.RL.get(key)) || 0);
  if (current >= limit) return true;
  // 2-day TTL so yesterday's keys self-clean.
  await env.RL.put(key, String(current + 1), { expirationTtl: 172800 });
  return false;
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

    if (await rateLimited(env, request)) return json({ error: "Daily limit reached, try again tomorrow" }, 429, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400, cors); }

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
