import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, parseHorizon, detectDomain } from '../src/planner.js';
import { streak, consistency, pillars, weekKey } from '../src/tracker.js';
import { nudge } from '../src/coach.js';

const today = new Date('2026-09-28T12:00:00Z');
const days = (end, n) => Array.from({ length: n }, (_, i) => new Date(new Date(end + 'T12:00:00Z') - i * 864e5).toISOString().slice(0, 10));

test('horizon: relative, by-month and default', () => {
  assert.equal(parseHorizon('run a 10k in 8 weeks', today), 56);
  assert.equal(parseHorizon('in six months', today), 183);
  assert.ok(Math.abs(parseHorizon('become a PM by May', today) - 245) <= 1);
  assert.equal(parseHorizon('get better at sleep', today), 90);
});

test('domain detection', () => {
  assert.equal(detectDomain('become an AI product manager'), 'career');
  assert.equal(detectDomain('run my first marathon'), 'fitness');
  assert.equal(detectDomain('learn SQL properly'), 'learning');
  assert.equal(detectDomain('write a short book'), 'creative');
  assert.equal(detectDomain('be kinder'), 'general');
});

test('plan turns an intention into a dated chain', () => {
  const p = plan('I want to become an AI product manager in 6 months', { today, why: 'I want to build what I used to design' });
  assert.equal(p.goal, 'Become an AI product manager in 6 months');
  assert.equal(p.milestones.length, 4);
  assert.ok(p.milestones.every((m, i, a) => i === 0 || m.due > a[i - 1].due));
  assert.equal(p.milestones.at(-1).due, '2027-03-30');
  assert.throws(() => plan('hi'));
});

test('streak survives an unfinished today, breaks on a gap', () => {
  assert.equal(streak(days('2026-09-27', 5), '2026-09-28'), 5);
  assert.equal(streak(['2026-09-28', '2026-09-26'], '2026-09-28'), 1);
  assert.equal(consistency(days('2026-09-28', 7), '2026-09-28', 14), .5);
});

test('pillars reflect milestones, actions and consistency', () => {
  const p = plan('learn SQL in 8 weeks', { today: new Date('2026-09-14T12:00:00Z'), why: 'analytics interviews' });
  p.milestones[0].done = true;
  const st = { checkins: days('2026-09-28', 10), weekly: { [weekKey('2026-09-28')]: ['w1', 'w2'] } };
  const pl = pillars(p, st, '2026-09-28');
  assert.equal(pl.progress, .25); assert.equal(pl.purpose, 1); assert.ok(pl.action > .6 && pl.consistency > .6);
});

test('coach: restart small after a gap, celebrate at the end', () => {
  const p = plan('run a 10k in 8 weeks', { today: new Date('2026-09-01T12:00:00Z') });
  assert.equal(nudge(p, { checkins: ['2026-09-20', '2026-09-19'] }, '2026-09-28').tone, 'reset');
  assert.equal(nudge(p, { checkins: [] }, '2026-09-02').tone, 'start');
  p.milestones.forEach(m => (m.done = true));
  assert.equal(nudge(p, { checkins: [] }, '2026-09-28').tone, 'celebrate');
});
