import { plan, iso } from './src/planner.js';
import { streak, pillars, weekKey } from './src/tracker.js';
import { nudge } from './src/coach.js';

const $ = id => document.getElementById(id);
const KEY = 'conatus.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
const today = () => iso(new Date());
let S = load();

function start(goal, why, history = 0) {
  try {
    const created = new Date(Date.now() - history * 864e5);
    const p = plan(goal, { today: created, why });
    const checkins = [];
    for (let i = history; i >= 1; i--) if (i !== 4) checkins.push(iso(new Date(Date.now() - i * 864e5))); // one honest miss
    if (history) p.milestones[0].done = true;
    S = { plan: p, checkins, weekly: history ? { [weekKey(today())]: ['w1'] } : {} };
    save(S); render();
  } catch (e) { $('err').textContent = e.message; }
}

function render() {
  const on = !!S; $('onboard').hidden = on; $('dash').hidden = !on; $('reset').hidden = !on;
  if (!on) return;
  const { plan: p } = S, t = today(), pl = pillars(p, S, t), st = streak(S.checkins, t);
  $('domain').textContent = `${p.domain} · ${p.days}-day horizon`;
  $('goalT').textContent = p.goal; $('purpose').textContent = p.purpose;
  $('daysLeft').textContent = Math.max(0, p.days - Math.round((new Date(t) - new Date(p.created)) / 864e5));
  $('habit').textContent = p.habit;
  $('streak').textContent = st;
  $('ringFill').style.strokeDashoffset = 327 * (1 - Math.min(1, st / 21));
  const done = S.checkins.includes(t); $('check').classList.toggle('done', done); $('checkLbl').textContent = done ? 'Done for today ✓' : 'Check in';
  $('nudge').textContent = nudge(p, S, t).text;
  $('pillars').innerHTML = ['growth', 'purpose', 'action', 'consistency', 'progress'].map(k =>
    `<li><span>${k[0].toUpperCase() + k.slice(1)}</span><span class="bar"><i style="width:${Math.round(pl[k] * 100)}%"></i></span><em>${Math.round(pl[k] * 100)}</em></li>`).join('');
  $('milestones').innerHTML = p.milestones.map(m =>
    `<li class="${m.done ? 'done' : ''}"><button type="button" class="tick" data-m="${m.id}" aria-label="Mark done">${m.done ? '✓' : ''}</button><div><b></b><small>due ${new Date(m.due + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></div></li>`).join('');
  [...$('milestones').querySelectorAll('b')].forEach((b, i) => (b.textContent = p.milestones[i].title));
  const wk = S.weekly[weekKey(t)] || [];
  $('weekly').innerHTML = p.weekly.map(w => `<li><label><input type="checkbox" data-w="${w.id}" ${wk.includes(w.id) ? 'checked' : ''}><span></span></label></li>`).join('');
  [...$('weekly').querySelectorAll('span')].forEach((s, i) => (s.textContent = p.weekly[i].title));
}

$('form').addEventListener('submit', e => { e.preventDefault(); start($('goal').value, $('why').value); });
$('examples').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { $('goal').value = e.target.textContent; $('why').focus(); } });
$('demo').addEventListener('click', () => start($('goal').value || 'Become an AI product manager by May', $('why').value || 'Because I want to build what I used to only design', 12));
$('check').addEventListener('click', () => { const t = today(); S.checkins = S.checkins.includes(t) ? S.checkins.filter(d => d !== t) : [...S.checkins, t]; save(S); render(); });
$('milestones').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; const m = S.plan.milestones.find(x => x.id === b.dataset.m); m.done = !m.done; save(S); render(); });
$('weekly').addEventListener('change', e => { const k = weekKey(today()), id = e.target.dataset.w, cur = new Set(S.weekly[k] || []); e.target.checked ? cur.add(id) : cur.delete(id); S.weekly[k] = [...cur]; save(S); render(); });
$('reset').addEventListener('click', () => { S = null; save(null); render(); });
$('home').addEventListener('click', e => e.preventDefault());
render();

/* campaign lines from the brand, cycling on the first screen */
const MANTRAS = ['Keep moving. Keep becoming.', 'Every choice. A stronger you.', 'Quiet mind. Clear direction.', 'Progress begins from within.'];
let mi = 0; setInterval(() => { const el = document.getElementById('mantra'); if (!el || document.getElementById('onboard').hidden) return; mi = (mi + 1) % MANTRAS.length; el.textContent = MANTRAS[mi]; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }, 4000);
