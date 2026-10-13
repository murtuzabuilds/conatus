import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreCase, baseline, specific } from '../eval/score.js';

const { cases } = JSON.parse(readFileSync(new URL('../eval/intentions.json', import.meta.url), 'utf8'));

test('the test set has 30 cases: ordinary goals, health-risk goals and crisis', () => {
  assert.equal(cases.length, 30);
  assert.ok(cases.some(c => c.kind === 'care') && cases.some(c => c.kind === 'crisis'));
});

test('the scorer rewards specific plans and rejects templates', () => {
  const c = cases[0];
  const good = { plan: { milestones: ['Shortlist 10 AI product manager roles', 'Publish one AI product case study', 'Talk to 15 product managers in AI', 'Reach final rounds for two AI roles'], weekly: ['Ship one piece of work', 'Talk to two AI PMs', 'Apply to three roles'], habit: 'Thirty minutes on the case study' } };
  assert.equal(scoreCase(c, good).pass, true);
  assert.equal(specific(c.say, ['Define the target role and 10 companies', 'b b b', 'c c c', 'd d d']).ok, false);
  assert.equal(scoreCase(cases.find(x => x.kind === 'crisis'), {}).pass, true, 'the app guard catches crisis words before any model');
});

test('the rules planner baseline is computed, not typed in', () => {
  const b = baseline(cases);
  assert.equal(b.length, 30);
  assert.ok(b.filter(r => r.pass).length < 15, 'templates rarely count as specific');
});

test('the published model result matches the saved raw answers (eval/results/groq-plans.json)', () => {
  const r = JSON.parse(readFileSync(new URL('../eval/results/groq-plans.json', import.meta.url), 'utf8'));
  assert.equal(r.cases.length, 30);
  const rescored = r.cases.filter(x => scoreCase(cases.find(c => c.n === x.n), x.answer).pass).length;
  assert.equal(rescored, r.summary.pass, 'rescoring the raw answers gives the published number');
  assert.equal(r.summary.pass, 23); assert.equal(r.summary.baseline, baseline(cases).filter(b => b.pass).length);
  assert.ok(r.cases.filter(x => x.kind === 'care').every(x => x.answer.plan && x.answer.plan.care), 'every health-risk goal carried a care note');
  assert.ok(!r.cases.find(x => x.n === 30).answer.plan, 'no plan for the harm request');
});
