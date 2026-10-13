// Conatus's one use of a model: writing the words of a plan for one person's intention.
// The model writes four milestones, three weekly actions and one daily habit. Conatus's own rules
// still set the horizon and every due date, and still do all the tracking and coaching, so the
// calendar and the daily experience never depend on a model. The call goes to the same small server
// as Umbra and CardRight, which holds the key. If it is slow, down or returns anything malformed,
// Conatus uses its rule-based planner and says so.
import { plan } from './planner.js';

export const MODEL_URL = 'https://umbra-drafter.murtuzabuilds.workers.dev';
export const DOMAINS = ['career', 'fitness', 'learning', 'creative', 'general'];

/** Words that suggest someone may be in crisis: no plan, a gentle pointer to support instead. Checked before any model call. */
const CRISIS = /\b(kill myself|end (it all|my life)|suicid|self[- ]?harm|hurt myself|don'?t want to (live|be here|exist)|disappear forever|no reason to live)\b/i;
/** Goals with health risk: the plan stays gentle and always carries a note to involve a professional, whatever the model says. */
const RISKY = /\b(lose \d+\s?(lbs?|pounds?|kg|kilos?)|crash diet|stop eating|starv|fasting|fast for \d+|extreme|steroid|medication|meds\b|injur|rehab|eating disorder)\b/i;
/** Requests to harm or intrude on someone else: no plan and a plain refusal (not the crisis message). Checked before any model call. */
const HARM = /\b(hack(ing)? (into|someone|somebody|my ex|his|her|their)|break(ing)? into (someone|somebody|my ex|his|her|their)|stalk(ing)?|spy(ing)? on|steal(ing)? (from|someone|somebody|his|her|their)|get(ting)? revenge|revenge on|blackmail|harass(ing)?|poison(ing)? (someone|somebody|him|her|them)|hurt (someone|somebody|him|her|them|my (ex|boss|wife|husband|partner|brother|sister|mom|dad)))\b/i;
export const REFUSE_NOTE = 'Conatus helps you grow into who you want to be. It will not plan something that could harm or intrude on someone else. Try a goal about your own growth.';
export const CARE_NOTE = 'Goals that touch your health are best shaped with a doctor or qualified professional. Keep every step gentle.';

export const isCrisis = t => CRISIS.test(String(t || ''));
export const isRisky = t => RISKY.test(String(t || ''));
export const isHarm = t => HARM.test(String(t || ''));

const line = (v, max = 80) => typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= max && !/https?:|<|>/.test(v) ? v.trim().replace(/\s+/g, ' ') : null;
/** The model's plan, checked again here: exactly 4 milestones, 3 weekly actions, 1 habit, short plain lines. Anything else gives null. */
export function checkPlan(p) {
  if (!p || typeof p !== 'object') return null;
  const milestones = Array.isArray(p.milestones) ? p.milestones.map(x => line(x)) : [];
  const weekly = Array.isArray(p.weekly) ? p.weekly.map(x => line(x)) : [];
  const habit = line(p.habit);
  if (milestones.length !== 4 || milestones.includes(null) || weekly.length !== 3 || weekly.includes(null) || !habit) return null;
  return { domain: DOMAINS.includes(p.domain) ? p.domain : 'general', milestones, weekly, habit, care: p.care === true, careNote: p.care === true ? line(p.careNote, 160) || '' : '' };
}

/** The rules plan with the model's words laid onto the rules' calendar. */
export function merge(base, m, model) {
  return {
    ...base, domain: m.domain,
    milestones: base.milestones.map((x, i) => ({ ...x, title: m.milestones[i] })),
    weekly: m.weekly.map((title, i) => ({ id: `w${i + 1}`, title })), habit: m.habit,
    source: 'model', model, care: m.care, careNote: m.careNote,
  };
}

/**
 * A plan for one intention. Returns { plan, crisis, source, note }.
 * crisis: true means no plan is offered, only support. refused: true means the request would harm someone else, so no plan. source is 'model' or 'rules'.
 */
export async function draftPlan(intention, { why = '', today = new Date(), url = MODEL_URL, fetchImpl = globalThis.fetch, timeoutMs = 9000 } = {}) {
  if (isCrisis(intention) || isCrisis(why)) return { plan: null, crisis: true };
  if (isHarm(intention) || isHarm(why)) return { plan: null, refused: true };
  const base = { ...plan(intention, { today, why }), source: 'rules' };
  const risky = isRisky(intention) || isRisky(why);
  const finish = p => (risky ? { ...p, care: true, careNote: p.careNote || CARE_NOTE } : p);
  const fallback = note => ({ plan: finish(base), crisis: false, source: 'rules', note });
  if (!url || !fetchImpl) return fallback('');
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetchImpl(url.replace(/\/$/, '') + '/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intention: intention.slice(0, 200), why: why.slice(0, 200), days: base.days }), signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return fallback('The model is unavailable right now, so Conatus planned this with its rules.');
    const j = await res.json();
    if (j && j.crisis === true) return { plan: null, crisis: true };
    if (j && j.refuse === true) return { plan: null, refused: true };
    const m = checkPlan(j && j.plan);
    if (!m) return fallback('The model\'s plan did not pass Conatus\'s checks, so its rules planned this instead.');
    return { plan: finish(merge(base, m, String(j.model || 'model').slice(0, 60))), crisis: false, source: 'model', note: '' };
  } catch {
    return fallback('The model did not answer in time, so Conatus planned this with its rules.');
  }
}
