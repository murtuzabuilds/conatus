// The coach turns state into one clear next step. One message, never a lecture.
import { streak, consistency, pillars } from './tracker.js';

export function nudge(plan, state, today) {
  const s = streak(state.checkins, today), p = pillars(plan, state, today);
  const next = plan.milestones.find(m => !m.done);
  const daysToNext = next ? Math.round((new Date(next.due) - new Date(today)) / 86400000) : null;
  const doneToday = state.checkins.includes(today);
  const missed = !doneToday && !state.checkins.includes(prev(today)) && state.checkins.length > 0;

  if (!next) return { tone: 'celebrate', text: `Every milestone is done. You became what you set out to become. Set the next horizon while the momentum is real.` };
  if (missed && consistency(state.checkins, today, 7) < .5)
    return { tone: 'reset', text: `Two days off. Don't restart big, restart small: do five minutes of "${plan.habit.toLowerCase()}" today. The chain matters more than the size of the link.` };
  if (daysToNext !== null && daysToNext <= 3 && daysToNext >= 0)
    return { tone: 'focus', text: `"${next.title}" is due in ${daysToNext === 0 ? 'less than a day' : daysToNext + ' day' + (daysToNext > 1 ? 's' : '')}. Point this week's actions at it.` };
  if (daysToNext !== null && daysToNext < 0)
    return { tone: 'focus', text: `"${next.title}" slipped ${-daysToNext} day(s). Either finish it this week or change the plan on purpose. Both are fine; drifting isn't.` };
  if (s >= 7 && s % 7 === 0 && doneToday)
    return { tone: 'raise', text: `${s} days straight. The habit is holding, so raise the bar a notch this week.` };
  if (p.pace < -.15) return { tone: 'focus', text: `You're behind the plan's pace. Pick the one weekly action that moves "${next.title}" most and do it first.` };
  if (!doneToday) return { tone: 'start', text: `Today's keystone: ${plan.habit.toLowerCase()}. Check in when it's done.` };
  return { tone: 'steady', text: s > 1 ? `Checked in. ${s}-day streak. Next up: ${next.title.toLowerCase()}.` : `Checked in. That's the first link in the chain.` };
}

const prev = d => new Date(new Date(d + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
