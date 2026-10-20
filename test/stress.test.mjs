import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Personalisation must hold across very different projects: sets barely overlap, and each fits its brief.
test('stress: 12 different projects get their own on-brief, award-winning landing pages', () => {
  const out = execFileSync(process.execPath, ['scripts/stress.mjs', 'landing'], { encoding: 'utf8' });
  const overlap = Number(/mean overlap between different projects: (\d+)%/.exec(out)[1]);
  assert.ok(overlap <= 5, `projects share too much: ${overlap}%`);
  const fits = [...out.matchAll(/fit (\d)\/8/g)].map((m) => Number(m[1]));
  assert.equal(fits.length, 12);
  assert.ok(fits.every((f) => f >= 6), `a project got an off-brief set: ${fits.join(',')}`);
  const canon = [...out.matchAll(/canon \[([^\]]*)\]/g)].map((m) => (m[1] ? m[1].split(', ').length : 0));
  assert.ok(canon.every((n) => n <= 1), `the hand-picked canon crowds out the catalog: ${canon.join(',')}`);
});
