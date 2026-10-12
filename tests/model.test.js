import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftPlan, checkPlan, isCrisis, isRisky } from '../src/model.js';

const today = new Date('2026-10-12T12:00:00Z');
const good = { domain: 'career', milestones: ['Pick 10 target AI PM roles', 'Publish one AI case study', 'Hold 15 conversations with AI PMs', 'Land two final rounds'], weekly: ['Ship one visible piece', 'Talk to two AI PMs', 'Apply to three roles'], habit: 'Thirty minutes on the case study', care: false, careNote: '' };
const answer = body => async () => new Response(JSON.stringify(body), { status: 200 });

test('the model writes the words, the rules keep the calendar', async () => {
  const r = await draftPlan('Become an AI product manager by May', { today, fetchImpl: answer({ plan: good, model: 'openai/gpt-oss-120b' }) });
  assert.equal(r.source, 'model'); assert.equal(r.plan.source, 'model');
  assert.deepEqual(r.plan.milestones.map(m => m.title), good.milestones);
  const dues = r.plan.milestones.map(m => m.due);
  assert.deepEqual([...dues].sort(), dues, 'due dates in order');
  assert.ok(dues.at(-1) <= '2027-05-31' && dues[0] > '2026-10-12', 'every date inside the horizon the rules read');
  assert.equal(r.plan.weekly.length, 3); assert.equal(r.plan.habit, good.habit);
});

test('anything malformed, slow or down falls back to the rules planner', async () => {
  for (const f of [answer({ plan: { ...good, milestones: good.milestones.slice(0, 2) } }), answer({ plan: { ...good, habit: '<script>' } }), async () => new Response('{}', { status: 502 }), async () => { throw new Error('offline'); }]) {
    const r = await draftPlan('Run a half marathon in 12 weeks', { today, fetchImpl: f });
    assert.equal(r.source, 'rules'); assert.equal(r.plan.milestones.length, 4); assert.ok(r.note);
  }
  assert.equal(checkPlan({ ...good, weekly: ['a', 'b', 'c'] }), null);
});

test('health-risk goals always carry a care note, even if the model forgets', async () => {
  assert.ok(isRisky('Lose 20 pounds in a month'));
  const r = await draftPlan('Lose 20 pounds in a month', { today, fetchImpl: answer({ plan: { ...good, domain: 'fitness' }, model: 'm' }) });
  assert.equal(r.plan.care, true); assert.match(r.plan.careNote, /doctor|professional/);
  const r2 = await draftPlan('Lose 20 pounds in a month', { today, url: '' });
  assert.equal(r2.plan.care, true, 'the rules plan carries it too');
});

test('a person who may be in crisis gets support, not a plan, and the model is never called', async () => {
  let called = false; const spy = async () => { called = true; return new Response('{}'); };
  for (const t of ['I want to end my life', "I don't want to be here anymore", 'stop self-harm']) {
    assert.ok(isCrisis(t), t);
    const r = await draftPlan(t, { today, fetchImpl: spy });
    assert.equal(r.crisis, true); assert.equal(r.plan, null);
  }
  assert.equal(called, false);
  const r = await draftPlan('Become a calmer person this year', { today, fetchImpl: answer({ crisis: true }) });
  assert.equal(r.crisis, true, 'the model can raise it too');
  for (const ok of ['Run a 5k and end the year strong', 'End my procrastination habit', 'Get better at self-care']) assert.ok(!isCrisis(ok), ok);
});
