// Check-ins, streaks and the five pillars: Growth, Purpose, Action, Consistency, Progress.
import { iso } from './planner.js';

const DAY = 86400000;
const addDays = (s, n) => iso(new Date(new Date(s + 'T12:00:00Z').getTime() + n * DAY));

export function streak(checkins, today) {
  const set = new Set(checkins);
  let d = set.has(today) ? today : addDays(today, -1), n = 0; // today not done yet doesn't break a streak
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function consistency(checkins, today, window = 14, since = null) {
  const set = new Set(checkins);
  let days = window, hit = 0;
  if (since) days = Math.min(window, Math.round((new Date(today) - new Date(since)) / DAY) + 1);
  for (let i = 0; i < days; i++) if (set.has(addDays(today, -i))) hit++;
  return days ? hit / days : 0;
}

export function pillars(plan, state, today) {
  const ms = plan.milestones, done = ms.filter(m => m.done).length;
  const week = weekKey(today), actionsDone = (state.weekly?.[week] || []).length;
  const elapsed = Math.min(1, (new Date(today) - new Date(plan.created)) / DAY / plan.days);
  const progress = ms.length ? done / ms.length : 0;
  return {
    growth: round(progress * .7 + Math.min(1, streak(state.checkins, today) / 21) * .3),
    purpose: plan.purpose && !plan.purpose.startsWith('Because becoming') ? 1 : .5,
    action: round(Math.min(1, actionsDone / plan.weekly.length)),
    consistency: round(consistency(state.checkins, today, 14, plan.created)),
    progress: round(progress),
    pace: round(progress - elapsed), // > 0 ahead of schedule, < 0 behind
  };
}

export function weekKey(dayIso) {
  const d = new Date(dayIso + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return iso(new Date(d.getTime() - day * DAY));
}
const round = x => Math.round(x * 100) / 100;
