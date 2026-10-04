// The coach turns state into one clear next step. One message, never a lecture.
// It is a short list of rules checked in order: the first one that matches wins. No model, no network.
// Every message carries `rule` (which check fired) and `why` (the facts behind it), so the app can
// show its reasoning instead of asking for trust.
import { streak, consistency, pillars } from './tracker.js';

export const RULES = ['complete', 'gap', 'due-soon', 'overdue', 'streak', 'behind', 'today', 'steady'];

export function nudge(plan, state, today) {
  const s = streak(state.checkins, today), p = pillars(plan, state, today);
  const next = plan.milestones.find(m => !m.done);
  const daysToNext = next ? Math.round((new Date(next.due) - new Date(today)) / 86400000) : null;
  const doneToday = state.checkins.includes(today);
  const missed = !doneToday && !state.checkins.includes(prev(today)) && state.checkins.length > 0;
  const week = consistency(state.checkins, today, 7), hits = Math.round(week * 7);
  const total = plan.milestones.length, done = plan.milestones.filter(m => m.done).length;

  if (!next) return { tone: 'celebrate', rule: 'complete', why: `All ${total} milestones are marked done.`,
    text: `Every milestone is done. You became what you set out to become. Set the next horizon while the momentum is real.` };
  if (missed && week < .5)
    return { tone: 'reset', rule: 'gap', why: `No check-in today or yesterday, and only ${hits} of the last 7 days have one.`,
      text: `Two days off. Don't restart big, restart small: do five minutes of "${plan.habit.toLowerCase()}" today. The chain matters more than the size of the link.` };
  if (daysToNext !== null && daysToNext <= 3 && daysToNext >= 0)
    return { tone: 'focus', rule: 'due-soon', why: `The next milestone is due ${next.due}, which is within 3 days.`,
      text: `"${next.title}" is due in ${daysToNext === 0 ? 'less than a day' : daysToNext + ' day' + (daysToNext > 1 ? 's' : '')}. Point this week's actions at it.` };
  if (daysToNext !== null && daysToNext < 0)
    return { tone: 'focus', rule: 'overdue', why: `The next milestone was due ${next.due} and is not marked done.`,
      text: `"${next.title}" slipped ${-daysToNext} day(s). Either finish it this week or change the plan on purpose. Both are fine; drifting isn't.` };
  if (s >= 7 && s % 7 === 0 && doneToday)
    return { tone: 'raise', rule: 'streak', why: `Today is checked in and the streak is ${s} days, a multiple of 7.`,
      text: `${s} days straight. The habit is holding, so raise the bar a notch this week.` };
  if (p.pace < -.15) return { tone: 'focus', rule: 'behind', why: `${done} of ${total} milestones done with ${Math.round((p.progress - p.pace) * 100)}% of the time used: ${Math.round(-p.pace * 100)} points behind.`,
    text: `You're behind the plan's pace. Pick the one weekly action that moves "${next.title}" most and do it first.` };
  if (!doneToday) return { tone: 'start', rule: 'today', why: `Today is not checked in yet, and nothing more urgent applies.`,
    text: `Today's keystone: ${plan.habit.toLowerCase()}. Check in when it's done.` };
  return { tone: 'steady', rule: 'steady', why: `Today is checked in, the next milestone is ${daysToNext} days out and the pace is within 15 points of the plan.`,
    text: s > 1 ? `Checked in. ${s}-day streak. Next up: ${next.title.toLowerCase()}.` : `Checked in. That's the first link in the chain.` };
}

const prev = d => new Date(new Date(d + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
