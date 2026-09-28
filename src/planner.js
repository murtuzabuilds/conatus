// Intention → structured plan. Conatus's core idea: progress starts from within, then becomes
// a chain of purpose, milestones, weekly actions and one daily keystone habit.
// Deterministic so it works offline; an LLM can replace `plan()` with the same output shape.

const DAY = 86400000;
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

export function parseHorizon(text, today = new Date()) {
  const t = text.toLowerCase();
  let m;
  if ((m = t.match(/in (\d+|a|one|two|three|six|twelve) (day|week|month|year)s?/))) {
    const words = { a: 1, one: 1, two: 2, three: 3, six: 6, twelve: 12 };
    const n = words[m[1]] ?? +m[1], unit = { day: 1, week: 7, month: 30.44, year: 365.25 }[m[2]];
    return Math.max(14, Math.round(n * unit));
  }
  if ((m = t.match(new RegExp(`by (${MONTHS.join('|')})(?: (\\d{4}))?`)))) {
    const mi = MONTHS.indexOf(m[1]);
    let y = m[2] ? +m[2] : today.getFullYear();
    let d = new Date(y, mi + 1, 0);
    if (d <= today) d = new Date(y + 1, mi + 1, 0);
    return Math.max(14, Math.round((d - today) / DAY));
  }
  if (/this year|end of (the )?year/.test(t)) return Math.max(14, Math.round((new Date(today.getFullYear(), 11, 31) - today) / DAY));
  return 90; // a quarter is a good default horizon for a personal goal
}

const DOMAINS = [
  { id: 'career', keys: ['job', 'role', 'career', 'pm', 'product manager', 'promotion', 'hired', 'interview', 'become a', 'professional', 'internship'],
    milestones: ['Define the target role and 10 companies', 'Build proof: one project or case study that shows the skill', 'Run 15 conversations with people in the role', 'Apply, interview and close'],
    weekly: ['Ship one visible piece of work', 'Have two conversations with people in the role', 'Apply to or research three target companies'],
    habit: 'Spend 30 focused minutes on your proof project' },
  { id: 'fitness', keys: ['run', 'marathon', '5k', '10k', 'fit', 'weight', 'gym', 'strength', 'health', 'sleep'],
    milestones: ['Baseline: measure where you start', 'Consistency block: train 3x a week for 4 weeks', 'Build: add volume or load by 10% a week', 'Test: race, lift or re-measure'],
    weekly: ['Three training sessions', 'One long or heavy session', 'Log sleep and recovery'],
    habit: 'Move for 20 minutes, even on rest days' },
  { id: 'learning', keys: ['learn', 'study', 'course', 'certification', 'language', 'code', 'python', 'sql', 'read', 'exam'],
    milestones: ['Pick one resource and a finish date', 'Fundamentals: finish the first third', 'Apply: build something small with it', 'Prove it: exam, project or teach it back'],
    weekly: ['Four study sessions', 'One practice problem set or mini project', 'Explain one concept in writing'],
    habit: 'Study for 25 minutes before anything else' },
  { id: 'creative', keys: ['write', 'book', 'paint', 'music', 'design', 'podcast', 'youtube', 'blog', 'portfolio', 'draw'],
    milestones: ['Define the body of work and its audience', 'Make a rough first version of everything', 'Refine with feedback from five people', 'Publish or show it'],
    weekly: ['Three making sessions', 'Share one work in progress', 'Study one piece you admire'],
    habit: 'Make something for 30 minutes, no editing' },
];

export function detectDomain(text) {
  const t = text.toLowerCase();
  let best = { id: 'general', score: 0 };
  for (const d of DOMAINS) {
    const s = d.keys.reduce((a, k) => a + (t.includes(k) ? k.length : 0), 0);
    if (s > best.score) best = { id: d.id, score: s };
  }
  return best.id;
}

const GENERAL = { milestones: ['Make the goal specific and measurable', 'First small win within two weeks', 'Halfway review: keep, cut or change', 'Finish and reflect'],
  weekly: ['Three focused sessions on the goal', 'One review of what worked'], habit: 'Do one small thing toward it every day' };

export function plan(intention, { today = new Date(), why = '' } = {}) {
  const text = intention.trim();
  if (text.length < 4) throw new Error('Tell me a little more about what you want.');
  const days = parseHorizon(text, today), domain = detectDomain(text);
  const tpl = DOMAINS.find(d => d.id === domain) || GENERAL;
  const goal = text.replace(/^i (want|would like|hope|plan) to /i, '').replace(/[.!]+$/, '');
  const milestones = tpl.milestones.map((title, i) => ({
    id: `m${i + 1}`, title, due: iso(new Date(today.getTime() + Math.round(days * (i + 1) / tpl.milestones.length) * DAY)), done: false,
  }));
  return {
    goal: goal[0].toUpperCase() + goal.slice(1), domain, days, created: iso(today),
    purpose: why.trim() || `Because becoming this is who you already are, just not yet in practice.`,
    milestones, weekly: tpl.weekly.map((title, i) => ({ id: `w${i + 1}`, title })), habit: tpl.habit,
  };
}

export const iso = d => d.toISOString().slice(0, 10);
