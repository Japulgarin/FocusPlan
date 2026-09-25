// USD per 1M tokens [input, output], plus free-tier flag. Taken from each provider's official
// pricing page on 2026-09-25; OpenRouter prices come live from its API instead.
export const PRICES_CHECKED = "2026-09-25";
// Curated on purpose: only current-generation, low-cost models; no "pro" or premium tiers.
const PRICES = {
  deepseek: {
    // Off-peak price; peak hours cost double.
    "deepseek-flash": [0.15, 0.6],
  },
  gemini: {
    "gemini-3.1-flash-lite": [0.25, 1.5, true],
    "gemini-3.5-flash-lite": [0.3, 2.5, true],
    "gemini-3.8-flash": [0.75, 3.75, true],
  },
  openai: {
    "gpt-6-luna": [0.1, 0.5],
    "gpt-5.6-luna": [0.2, 1.2],
    "gpt-5.4-nano": [0.2, 1.25],
    "gpt-5.4-mini": [0.75, 4.5],
    "gpt-6-sol": [2, 10],
  },
  anthropic: {
    "claude-haiku-4-5": [1, 5],
    "claude-sonnet-5": [2, 10],
  },
};

// OpenRouter is filtered live: no "pro" models, output at most this price, released within a
// year, only general chat models, and only the cheapest few.
const MAX_OUTPUT_PRICE = 12;
const MAX_AGE_DAYS = 365;
const OPENROUTER_LIMIT = 30;
const NOT_A_PLANNER = /batch|safety|safeguard|guard|router|lyria|music|embed|vision|\bvl\b|omni|tts|audio|image|coder|code|translat|\bmt\d|schematron|ocr/i;
const isPro = id => /(^|[-_/.:])pro($|[-_/.:])/i.test(id);

function fmt(n) {
  return n < 1 ? n.toFixed(2).replace(/0$/, "") : String(+n.toFixed(2));
}

function priceTag(provider, [pin, pout, free]) {
  if (pin === 0 && pout === 0) return "FREE";
  const peak = provider === "deepseek" ? " (off-peak)" : "";
  return `${free ? "FREE tier · then " : ""}$${fmt(pin)} in / $${fmt(pout)} out per 1M${peak}`;
}

// Free tiers first, then cheapest (input + output), then unpriced models newest-first.
function sortCheapestFirst(provider, models) {
  const table = PRICES[provider] || {};
  return models
    .map(m => {
      const p = m.price || table[m.id];
      return {
        ...m,
        label: p ? `${m.name || m.id} — ${priceTag(provider, p)}` : (m.name || m.id),
        rank: p ? [p[2] || (p[0] === 0 && p[1] === 0) ? 0 : 1, p[0] + p[1]] : [2, m.age || 0],
      };
    })
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.id.localeCompare(b.id));
}

// Keeps only the curated models the key can actually use; if the provider names them
// differently, the curated list is shown as-is so there's always something to pick.
function curated(provider, available) {
  const ids = new Set(available.map(m => m.id));
  const mine = presetsFor(provider).filter(m => ids.has(m.id));
  return mine.length ? mine : presetsFor(provider);
}

function presetsFor(provider) {
  return sortCheapestFirst(provider, Object.keys(PRICES[provider] || {}).map(id => ({ id })));
}

export const DEFAULT_PROVIDER = "deepseek";

export const PROVIDERS = {
  deepseek: { label: "DeepSeek", envVar: "DEEPSEEK_API_KEY", keyUrl: "https://platform.deepseek.com/api_keys", base: "https://api.deepseek.com" },
  gemini: { label: "Google Gemini", envVar: "GEMINI_API_KEY", keyUrl: "https://aistudio.google.com/apikey" },
  openai: { label: "OpenAI (ChatGPT)", envVar: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys", base: "https://api.openai.com/v1" },
  anthropic: { label: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY", keyUrl: "https://console.anthropic.com/settings/keys" },
  openrouter: { label: "OpenRouter (many models)", envVar: "OPENROUTER_API_KEY", keyUrl: "https://openrouter.ai/keys", base: "https://openrouter.ai/api/v1" },
};
for (const [id, p] of Object.entries(PROVIDERS)) {
  p.presets = presetsFor(id);
  p.defaultModel = p.presets.length ? p.presets[0].id : "";
}

export class ProviderError extends Error {
  constructor(message, { status = null, network = false, detail = "" } = {}) {
    super(message);
    this.status = status;
    this.network = network;
    this.detail = detail;
  }
}

function friendly(err, provider) {
  if (err instanceof ProviderError && !err.status && !err.network) return err;
  const label = PROVIDERS[provider].label;
  const status = err.status || null;
  const detail = err.detail || err.message || "";
  const isNetwork = err.network || (!status && (err.name === "TypeError" || err.name === "APIConnectionError"));
  if (isNetwork) {
    return new ProviderError(
      `Couldn't reach ${label} from the browser (network problem, or the provider blocks direct browser calls). ` +
      `Check your connection, or use the same model through OpenRouter.`, { network: true, detail });
  }
  if (status === 401 || status === 403) return new ProviderError(`${label} rejected the API key. Check that it's correct and has access to this model.`, { status, detail });
  if (status === 404) return new ProviderError(`${label} couldn't find that model, or your key can't use it. Pick another model.`, { status, detail });
  if (status === 429) return new ProviderError(`${label} rate limit or quota reached. Wait a minute, or check your credits/billing.`, { status, detail });
  if (status === 402) return new ProviderError(`${label} says the account has no credits left.`, { status, detail });
  if (status && status >= 500) return new ProviderError(`${label} had a server error (${status}). Try again in a moment.`, { status, detail });
  return new ProviderError(`${label}: ${detail || "request failed"}`, { status, detail });
}

async function http(url, { method = "GET", headers = {}, body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json", ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ProviderError("network", { network: true, detail: e.message });
  }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) {}
  if (!res.ok) {
    const detail = (data && data.error && (data.error.message || data.error)) || (data && data.message) || text.slice(0, 300) || res.statusText;
    const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    err.status = res.status;
    err.detail = err.message;
    throw err;
  }
  return data;
}

// ---------- Anthropic (official SDK, loaded on demand) ----------
let AnthropicSDK = null;
async function anthropicClient(key) {
  if (!AnthropicSDK) {
    try {
      AnthropicSDK = (await import("https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm")).default;
    } catch (e) {
      throw new ProviderError("Couldn't load the Anthropic SDK from the CDN. Check your internet connection.", { network: true, detail: e.message });
    }
  }
  return new AnthropicSDK({ apiKey: key, dangerouslyAllowBrowser: true });
}

// Of the curated Claude models, Sonnet 5 supports adaptive thinking; Haiku 4.5 does not.
const ADAPTIVE_THINKING = /sonnet-5/;

async function anthropicModels(key) {
  const client = await anthropicClient(key);
  const out = [];
  for await (const m of client.models.list()) out.push({ id: m.id });
  return curated("anthropic", out);
}

async function anthropicGenerate(key, model, { system, user, schema, useSchema, maxTokens = 32000 }) {
  const client = await anthropicClient(key);
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  };
  if (ADAPTIVE_THINKING.test(model)) params.thinking = { type: "adaptive" };
  if (useSchema) params.output_config = { format: { type: "json_schema", schema } };

  const message = await client.messages.stream(params).finalMessage();

  if (message.stop_reason === "refusal") {
    throw new ProviderError("Claude declined this request. Try rephrasing the goal.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ProviderError("The plan was too long for one reply. Shorten the date range or simplify the goal.");
  }
  return {
    text: message.content.filter(b => b.type === "text").map(b => b.text).join(""),
    usage: { input: message.usage.input_tokens || 0, output: message.usage.output_tokens || 0 },
  };
}

// ---------- OpenAI-compatible (OpenAI, DeepSeek, OpenRouter) ----------
const NON_CHAT = /embedding|whisper|tts|dall-e|moderation|audio|realtime|image|transcribe|search|davinci|babbage|computer-use/i;

function authHeaders(provider, key) {
  const h = key ? { Authorization: `Bearer ${key}` } : {};
  if (provider === "openrouter") h["X-Title"] = "FocusPlan";
  return h;
}

async function compatModels(provider, key) {
  const { base } = PROVIDERS[provider];
  const data = await http(`${base}/models`, { headers: authHeaders(provider, key) });
  const list = (data && data.data) || [];
  if (provider === "openrouter") {
    const cutoff = Date.now() / 1000 - MAX_AGE_DAYS * 86400;
    return sortCheapestFirst("openrouter", list
      .map(m => ({ m, pin: Number(m.pricing && m.pricing.prompt) * 1e6, pout: Number(m.pricing && m.pricing.completion) * 1e6 }))
      .filter(({ m, pin, pout }) => Number.isFinite(pin) && Number.isFinite(pout) && pin >= 0 && pout >= 0
        && pout <= MAX_OUTPUT_PRICE && !isPro(m.id) && !NON_CHAT.test(m.id)
        && !NOT_A_PLANNER.test(`${m.id} ${m.name || ""}`) && (!m.created || m.created >= cutoff))
      .map(({ m, pin, pout }) => ({ id: m.id, name: m.name || m.id, price: [pin, pout] })))
      .slice(0, OPENROUTER_LIMIT);
  }
  return curated(provider, list.map(m => ({ id: m.id })));
}

async function compatGenerate(provider, key, model, { system, user, schema, useSchema }) {
  const { base } = PROVIDERS[provider];
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (useSchema) {
    body.response_format = provider === "deepseek"
      ? { type: "json_object" }
      : { type: "json_schema", json_schema: { name: "focus_plan", strict: true, schema } };
  }
  const data = await http(`${base}/chat/completions`, { method: "POST", headers: authHeaders(provider, key), body });
  const choice = data && data.choices && data.choices[0];
  if (!choice) throw new ProviderError("The model returned no answer. Try again or pick another model.");
  if (choice.finish_reason === "length") throw new ProviderError("The plan was too long for one reply. Shorten the date range or pick a model with a larger output limit.");
  if (choice.finish_reason === "content_filter") throw new ProviderError("The model's safety filter blocked this request. Try rephrasing the goal.");
  const content = choice.message && choice.message.content;
  if (!content) throw new ProviderError("The model returned an empty answer. Try again or pick another model.");
  const u = data.usage || {};
  return { text: content, usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } };
}

// ---------- Google Gemini (REST) ----------
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Gemini's responseSchema is an OpenAPI subset: uppercase types, no additionalProperties.
function toGeminiSchema(node) {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "additionalProperties") continue;
    out[k] = k === "type" && typeof v === "string" ? v.toUpperCase() : toGeminiSchema(v);
  }
  return out;
}

async function geminiModels(key) {
  const data = await http(`${GEMINI_BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
  return curated("gemini", ((data && data.models) || [])
    .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map(m => ({ id: m.name.replace(/^models\//, "") })));
}

async function geminiGenerate(key, model, { system, user, schema, useSchema }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { responseMimeType: "application/json" },
  };
  if (useSchema) body.generationConfig.responseSchema = toGeminiSchema(schema);
  const data = await http(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key },
    body,
  });
  const cand = data && data.candidates && data.candidates[0];
  if (!cand) {
    const reason = data && data.promptFeedback && data.promptFeedback.blockReason;
    throw new ProviderError(reason ? `Gemini blocked this request (${reason}). Try rephrasing the goal.` : "Gemini returned no answer.");
  }
  if (cand.finishReason === "MAX_TOKENS") throw new ProviderError("The plan was too long for one reply. Shorten the date range.");
  if (cand.finishReason === "SAFETY") throw new ProviderError("Gemini's safety filter blocked this request. Try rephrasing the goal.");
  const text = ((cand.content && cand.content.parts) || []).map(p => p.text || "").join("");
  if (!text) throw new ProviderError("Gemini returned an empty answer.");
  const u = data.usageMetadata || {};
  return { text, usage: { input: u.promptTokenCount || 0, output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
}

// ---------- Public API ----------
export async function listModels(provider, key) {
  try {
    if (provider === "anthropic") return await anthropicModels(key);
    if (provider === "gemini") return await geminiModels(key);
    return await compatModels(provider, key);
  } catch (e) {
    throw friendly(e, provider);
  }
}

// Sends a plain "hi" and returns the reply and round-trip time, to prove key + model work.
export async function testConnection(provider, key, model) {
  const started = performance.now();
  const { text } = await generate(provider, key, model, {
    system: "You are a connection test. Reply with one short friendly sentence.",
    user: "hi",
    useSchema: false,
    maxTokens: 2000,
  });
  return { reply: text.trim().slice(0, 200), ms: Math.round(performance.now() - started) };
}

// Estimated USD cost from the built-in price table; null when the model isn't in it.
// DeepSeek charges double at peak hours, so it gets a low–high range.
export function estimateCost(provider, model, usage) {
  const p = (PRICES[provider] || {})[model];
  if (!p || !usage) return null;
  const low = (usage.input * p[0] + usage.output * p[1]) / 1e6;
  return { low, high: provider === "deepseek" ? low * 2 : low };
}

// Returns { text, usage: { input, output } } (token counts as reported by the provider).
export async function generate(provider, key, model, request) {
  try {
    if (provider === "anthropic") return await anthropicGenerate(key, model, request);
    if (provider === "gemini") return await geminiGenerate(key, model, request);
    return await compatGenerate(provider, key, model, request);
  } catch (e) {
    throw friendly(e, provider);
  }
}
