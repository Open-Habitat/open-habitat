// Which model does background work: conversation recaps (recap-extension.mjs)
// and automatic titles (title-helper.mjs). Declared price cannot decide it, as
// a subscription provider declares every model free (pi-claude-bridge), so the
// cheapest-looking model was the Claude bridge's Fable. Jari's rule
// (2026-10-28): the provider's middle-tier model by alias or name family,
// newest first, the conversation's own model as the fallback, never a Fable or
// Opus class model.

// Middle-tier families in order of preference: Claude's Sonnet, OpenAI's Luna,
// Gemini's Flash, Mistral's Medium, then OpenAI's older Mini. A family matches
// a whole word of the model's id or name, so "mini" does not match "gemini".
export const BACKGROUND_FAMILIES = ['sonnet', 'luna', 'flash', 'medium', 'mini'];
// A smaller variant within a family ("gemini-2.5-flash-lite") ranks after it.
const SMALLER = ['lite', 'nano'];
// Classes too scarce or expensive for background work, even as the fallback.
export const EXCLUDED_FAMILIES = ['fable', 'opus'];

const words = (m) => `${m.id ?? ''} ${m.name ?? ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const family = (m, list) => { const w = words(m); return list.findIndex(f => w.includes(f)); };
// Version numbers in the id; four-digit and longer runs are snapshot dates.
const version = (m) => (String(m.id).match(/\d+/g) ?? []).map(Number).filter(n => n < 1000);
const preview = (m) => /\b(preview|exp|experimental)\b/i.test(String(m.id).replace(/[-_.]/g, ' '));
function newer(a, b) {
  const sa = family(a, SMALLER) >= 0, sb = family(b, SMALLER) >= 0;
  if (sa !== sb) return Number(sa) - Number(sb);
  if (preview(a) !== preview(b)) return Number(preview(a)) - Number(preview(b));
  const va = version(a), vb = version(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) if ((vb[i] ?? -1) !== (va[i] ?? -1)) return (vb[i] ?? -1) - (va[i] ?? -1);
  return String(a.id).length - String(b.id).length;
}

// `available` holds only models the caller may use (text input, configured
// auth). `conversation` is the conversation's model ({provider, id}), or
// undefined when it is not known. `preferred` ({provider, id}) is the
// person's own choice for the recap, tried first when it is available and
// not of an excluded class. Returns the models in the order to try: the
// preference, the provider's middle-tier model, then the conversation's own.
export function backgroundModels(available, conversation, preferred) {
  const auto = automatic(available, conversation);
  const first = preferred && available.find(m => m && m.provider === preferred.provider && m.id === preferred.id && family(m, EXCLUDED_FAMILIES) < 0);
  return first ? [first, ...auto.filter(m => m !== first)] : auto;
}

function automatic(available, conversation) {
  const allowed = available.filter(m => m && family(m, EXCLUDED_FAMILIES) < 0);
  const tier = (provider) => allowed.filter(m => family(m, BACKGROUND_FAMILIES) >= 0 && (!provider || m.provider === provider))
    .sort((a, b) => family(a, BACKGROUND_FAMILIES) - family(b, BACKGROUND_FAMILIES) || newer(a, b));
  // The conversation's provider demonstrably has the person's credentials.
  const out = tier(conversation?.provider).slice(0, 1);
  const own = allowed.find(m => conversation && m.provider === conversation.provider && m.id === conversation.id);
  if (own && !out.includes(own)) out.push(own);
  // Without a known conversation, or when this registry holds nothing of its
  // provider (for example, its extension failed to load), another
  // configured provider's middle tier does the work.
  return out.length ? out : tier().slice(0, 1);
}
