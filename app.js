import { plan, reading, iso } from './src/planner.js';
import { streak, consistency, pillars, weekKey } from './src/tracker.js';
import { nudge } from './src/coach.js';
import { draftPlan, REFUSE_NOTE } from './src/model.js';

const $ = id => document.getElementById(id);
const KEY = 'conatus.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
const today = () => iso(new Date());
const day = d => new Date(d + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
const pc = x => Math.round(x * 100);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const quote = s => `“${s}”`;
const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a.at(-1)}` : a[0];
const use = id => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
let S = load();

const DEMO = { goal: 'Become an AI product manager by May', why: 'Because I want to build what I used to only design' };
// "Grow Your career": the word after "Grow Your" follows the kind of plan.
const WORD = { career: 'career', fitness: 'fitness', learning: 'skills', creative: 'craft', general: 'potential' };
// What each pillar measures, in the tracker's own terms.
const PILLARS = {
  growth: 'Milestones done count for 70 points, the daily streak (up to 21 days) for 30.',
  purpose: '100 when you wrote down why it matters. 50 without a reason.',
  action: "The share of this week's actions you have ticked.",
  consistency: 'The share of days with a check-in over the last 14, or since you started.',
  progress: 'Milestones done out of the plan total.',
};
let pillarSel = 'growth';

function start(goal, why, history = 0, chosen = null) {
  const created = new Date(Date.now() - history * 864e5);
  /* the plan the person just saw (model-written or rules), or, for the sample history, a rules plan back-dated */
  const p = chosen && !history ? JSON.parse(JSON.stringify(chosen)) : plan(goal, { today: created, why });
  const checkins = [];
  for (let i = history; i >= 1; i--) if (i !== 4) checkins.push(iso(new Date(Date.now() - i * 864e5))); // one honest miss
  if (history) p.milestones[0].done = true;
  S = { plan: p, intent: goal.trim(), sample: !!history, checkins, weekly: history ? { [weekKey(today())]: ['w1'] } : {} };
  save(S); render(); window.scrollTo(0, 0);
}

/* How the planner read the words: the horizon phrase and the keywords that picked the kind of plan. */
function readingOf(text, p) {
  const r = reading(text, new Date(p.created + 'T12:00:00Z'));
  const gap = Math.round(p.days / p.milestones.length);
  return {
    horizon: r.phrase ? `${quote(r.phrase)} set a ${p.days}-day horizon.` : `No time frame found, so it runs the default ${p.days} days.`,
    domain: r.matched.length ? `${list(r.matched.map(quote))} made it a ${p.domain} plan.` : `No keyword matched, so it uses the general plan.`,
    spacing: `${plural(p.milestones.length, 'milestone')}, one about every ${plural(gap, 'day')}, the last on ${day(p.milestones.at(-1).due)}.`,
    short: `Read from ${[r.phrase, ...r.matched.slice(0, 2)].filter(Boolean).map(quote).join(', ') || 'your words, with the default 90 days'}.`,
  };
}

/* ---------- onboarding: three story screens ---------- */
let step = 1, draft = null;
function showStep(n) {
  step = n;
  document.querySelectorAll('.step').forEach(el => (el.hidden = +el.dataset.step !== n));
  [...$('segs').children].forEach((el, i) => el.classList.toggle('on', i < n));
  $('goal').hidden = n !== 1; $('why').hidden = n !== 2; $('go').hidden = n !== 3; $('back').hidden = n === 1;
  $('form').classList.toggle('confirm', n === 3);
  $('sendBtn').setAttribute('aria-label', n === 3 ? 'Start my plan' : 'Send');
  $('err').textContent = '';
}
function preview() {
  const p = draft, r = readingOf($('goal').value, p);
  $('pvLabel').textContent = `${p.domain} plan`;
  $('pvDays').textContent = p.days;
  $('pvDots').innerHTML = p.milestones.map(m => `<li>${day(m.due)}</li>`).join('');
  $('pvNext').textContent = p.milestones[0].title;
  $('pvHabit').textContent = p.habit;
  const care = p.care ? ` ${p.careNote}` : '';
  $('pvRead').textContent = p.source === 'model'
    ? `Written for your words by a model (${p.model}). Conatus's rules set the ${p.days}-day calendar.${care}`
    : `${r.short} Built by rules, in your browser.${draftNote ? ' ' + draftNote : ''}${care}`;
  $('sendBtn').disabled = false;
}
/* Someone who may be going through something hard gets a pause and a pointer to support, not a plan. */
function crisisView() {
  $('pvLabel').textContent = 'A pause first'; $('pvDays').textContent = ''; $('pvDots').innerHTML = '';
  $('pvNext').textContent = "It sounds like things might be heavy right now. You don't have to work through this alone. Please reach out to someone you trust, or in the US call or text 988 to talk with someone now.";
  $('pvHabit').textContent = ''; $('pvRead').textContent = 'Conatus does not make a plan for this. A person can help more than an app here.';
  $('sendBtn').disabled = true;
}
/* A request to harm or intrude on someone else gets a plain no, not the crisis message. */
function refusedView() {
  $('pvLabel').textContent = 'Not this one'; $('pvDays').textContent = ''; $('pvDots').innerHTML = '';
  $('pvNext').textContent = REFUSE_NOTE;
  $('pvHabit').textContent = ''; $('pvRead').textContent = 'Conatus does not make a plan for this.';
  $('sendBtn').disabled = true;
}
let asked = 0, draftNote = '';
function advance() {
  if (step === 3) { if (!draft || draft.crisis || draft.refused) return; return start($('goal').value, $('why').value, 0, draft); }
  try { draft = { ...plan($('goal').value, { why: $('why').value }), source: 'rules' }; } catch (e) { $('err').textContent = e.message; $('goal').focus(); return; }
  const toPreview = step === 2;
  if (toPreview) { draftNote = ''; preview(); }
  showStep(step + 1);
  if (step === 2) $('why').focus({ preventScroll: true });
  if (toPreview) {
    /* the rules plan shows at once; a model-written plan replaces it when it arrives, or the rules plan stays and says why */
    const n = ++asked, goal = $('goal').value, why = $('why').value;
    $('pvRead').textContent = 'Writing your plan with a model...';
    draftPlan(goal, { why }).then(r => {
      if (n !== asked || step !== 3) return;
      if (r.crisis) { draft = { crisis: true }; return crisisView(); }
      if (r.refused) { draft = { refused: true }; return refusedView(); }
      draft = r.plan; draftNote = r.note || ''; preview();
    });
  }
}
$('form').addEventListener('submit', e => { e.preventDefault(); advance(); });
$('go').parentElement.addEventListener('click', e => { if (step === 3 && !e.target.closest('button')) advance(); });
$('back').addEventListener('click', () => { asked++; $('sendBtn').disabled = false; showStep(step - 1); (step === 1 ? $('goal') : $('why')).focus({ preventScroll: true }); });
$('examples').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { $('goal').value = e.target.textContent; $('goal').focus({ preventScroll: true }); } });
const toStory = () => { $('form').scrollIntoView({ block: 'center' }); showStep(1); $('goal').focus({ preventScroll: true }); };
['navStart', 'startBtn', 'startBtn2'].forEach(id => $(id).addEventListener('click', toStory));
$('demo').addEventListener('click', () => start($('goal').value.trim().length > 3 ? $('goal').value : DEMO.goal, $('why').value || DEMO.why, 12));
document.querySelectorAll('.feat').forEach(f => {
  const flip = () => f.classList.toggle('open');
  f.addEventListener('click', flip);
  f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
});

/* ---------- dashboard ---------- */
function render() {
  const on = !!S;
  $('landing').hidden = on; $('dash').hidden = !on; $('reset').hidden = !on; $('navStart').hidden = on;
  document.querySelectorAll('.links a').forEach(a => (a.hidden = (a.dataset.on === 'dash') !== on));
  if (!on) return;
  const { plan: p } = S, t = today(), pl = pillars(p, S, t), st = streak(S.checkins, t);
  const next = p.milestones.find(m => !m.done), done = p.milestones.filter(m => m.done).length;
  const daysLeft = Math.max(0, p.days - Math.round((new Date(t) - new Date(p.created)) / 864e5));

  // Current goal, as on the career growth board
  $('sample').hidden = !S.sample;
  $('domainWord').textContent = WORD[p.domain] || WORD.general;
  $('goalT').textContent = p.goal; $('purpose').textContent = p.purpose;
  $('pct').textContent = `${pc(pl.progress)}%`; $('goalBar').style.width = `${pc(pl.progress)}%`;
  $('goalBarWrap').setAttribute('aria-label', `${done} of ${p.milestones.length} milestones done`);
  $('daysLeft').textContent = daysLeft;
  const r = readingOf(S.intent || p.goal, p);
  $('readLine').textContent = p.source === 'model'
    ? `A model wrote your ${p.days}-day ${p.domain} plan. Conatus's rules set the calendar and do the tracking.`
    : `Conatus read your words as a ${p.days}-day ${p.domain} plan.`;
  if (p.care) $('readLine').textContent += ` ${p.careNote}`;
  const lines = [r.horizon, p.source === 'model' ? `The milestones, weekly actions and habit were written for your words by a model (${p.model}), then checked by Conatus.` : r.domain, r.spacing];
  if (p.care) lines.unshift(p.careNote);
  $('readMore').innerHTML = lines.map(() => '<li></li>').join('');
  lines.forEach((txt, i) => ($('readMore').children[i].textContent = txt));

  // Growth card over the photo. The desk photo suits career, learning and creative plans; others get the drawn ground.
  $('photo').classList.toggle('drawn', !['career', 'learning', 'creative'].includes(p.domain));
  $('growL').textContent = `${p.domain === 'general' ? 'Personal' : p.domain} Growth`;
  $('growN').textContent = `${pc(pl.growth)}%`;
  $('growRing').style.strokeDasharray = `${pc(pl.growth)} 100`;
  $('nextT').textContent = next ? next.title : 'Set the next horizon';

  // Today
  const cons = consistency(S.checkins, t, 14, p.created), doneToday = S.checkins.includes(t);
  $('habit').textContent = p.habit;
  $('consN').textContent = `${pc(cons)}%`; $('consBar').style.width = `${pc(cons)}%`; $('consKnob').style.left = `${pc(cons)}%`;
  $('consWrap').setAttribute('aria-label', `Consistency ${pc(cons)} percent`);
  $('streak').textContent = st; $('total').textContent = S.checkins.length; $('totalL').textContent = S.checkins.length === 1 ? 'check-in' : 'check-ins';
  $('check').setAttribute('aria-pressed', doneToday);
  $('check').querySelector('use').setAttribute('href', doneToday ? '#i-check' : '#i-arrow');
  $('checkLbl').textContent = doneToday ? 'Checked in today. Tap to undo' : 'Check in for today';

  // Coach: the message, the rule that fired and the numbers behind it
  const n = nudge(p, S, t), toNext = next ? Math.round((new Date(next.due) - new Date(t)) / 864e5) : null;
  $('nudge').textContent = n.text; $('whyT').textContent = n.why;
  $('coachRule').textContent = `Rule: ${n.rule.replace('-', ' ')}`;
  const facts = [['Streak', plural(st, 'day')], ['Last 7 days', `${Math.round(consistency(S.checkins, t, 7) * 7)} of 7`],
    ['Next milestone', toNext === null ? 'none left' : toNext < 0 ? `${plural(-toNext, 'day')} late` : `in ${plural(toNext, 'day')}`],
    ['Pace', `${pl.pace > 0 ? '+' : ''}${pc(pl.pace)} points`]];
  $('facts').innerHTML = facts.map(([k, v]) => `<li>${k} <b>${v}</b></li>`).join('');

  // Five pillars
  const keys = Object.keys(PILLARS);
  $('pillarList').innerHTML = keys.map(k => `<li class="${k === pillarSel ? 'sel' : ''}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49.5" pathLength="100" stroke-dasharray="${pc(pl[k])} 100" vector-effect="non-scaling-stroke"/></svg><button type="button" data-p="${k}" aria-pressed="${k === pillarSel}"><b>${pc(pl[k])}</b><span>${k[0].toUpperCase() + k.slice(1)}</span></button></li>`).join('');
  $('pillarD').innerHTML = `<b>${pillarSel[0].toUpperCase() + pillarSel.slice(1)} ${pc(pl[pillarSel])}.</b> ${PILLARS[pillarSel]}${pillarSel === 'progress' ? ` Pace is ${pl.pace >= 0 ? `${pc(pl.pace)} points ahead of` : `${pc(-pl.pace)} points behind`} the time used.` : ''}`;

  // Plan
  $('milestones').innerHTML = p.milestones.map(m =>
    `<li class="${m.done ? 'done' : ''}"><button type="button" class="tick" data-m="${m.id}" aria-pressed="${m.done}" aria-label="Mark milestone done">${use('i-check')}</button><div><strong></strong><small>${m === next ? '<b>Next:</b> ' : ''}Due ${day(m.due)}</small></div></li>`).join('');
  [...$('milestones').querySelectorAll('strong')].forEach((b, i) => (b.textContent = p.milestones[i].title));
  const wk = S.weekly[weekKey(t)] || [];
  $('weekly').innerHTML = p.weekly.map(w => `<li><label class="${wk.includes(w.id) ? 'on' : ''}"><input type="checkbox" data-w="${w.id}" ${wk.includes(w.id) ? 'checked' : ''}>${use('i-check')}<span></span></label></li>`).join('');
  [...$('weekly').querySelectorAll('span')].forEach((s, i) => (s.textContent = p.weekly[i].title));
  $('wkNote').textContent = `${wk.length} of ${p.weekly.length} done this week. That is the Action pillar. It resets every Monday.`;
}

$('check').addEventListener('click', () => { const t = today(); S.checkins = S.checkins.includes(t) ? S.checkins.filter(d => d !== t) : [...S.checkins, t]; save(S); render(); });
$('milestones').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; const m = S.plan.milestones.find(x => x.id === b.dataset.m); m.done = !m.done; save(S); render(); });
$('weekly').addEventListener('change', e => { const k = weekKey(today()), id = e.target.dataset.w, cur = new Set(S.weekly[k] || []); e.target.checked ? cur.add(id) : cur.delete(id); S.weekly[k] = [...cur]; save(S); render(); });
$('pillarList').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; pillarSel = b.dataset.p; render(); $('pillarList').querySelector(`[data-p="${pillarSel}"]`).focus(); });
$('readBtn').addEventListener('click', () => { const open = $('readMore').hidden; $('readMore').hidden = !open; $('readBtn').setAttribute('aria-expanded', open); });
$('reset').addEventListener('click', () => { S = null; save(null); $('goal').value = ''; $('why').value = ''; showStep(1); render(); window.scrollTo(0, 0); });
$('home').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
showStep(1);
render();
