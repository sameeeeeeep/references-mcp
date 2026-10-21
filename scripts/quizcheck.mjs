#!/usr/bin/env node
// Does each quiz pick actually narrow the results? For every medium and option, ask as the band does after the
// quiz (filters + style + styleWords) and report: how much of the set changed, and how many cards carry the pick.
import { mkdtempSync, readFileSync } from 'node:fs';
import { createReferences } from '../src/references.mjs';
import { QUIZZES } from '../src/quiz.mjs';

const ASK = { video: 'launch video for my mac app', ad: 'ad for a snack brand', social: 'social posts for a coffee brand', motion: 'motion promo for my app', animation: 'animated explainer for a startup', landing: 'landing page for a fintech startup', ui: 'dashboard UI for analytics', app: 'app screens for a habit tracker', deck: 'pitch deck for a seed round', post: 'launch post for my startup' };
const only = process.argv.slice(2);
const fetchImpl = async (u) => { const m = /shelf\/index\/(\w+)\.json/.exec(String(u)); return m ? { ok: true, status: 200, text: async () => readFileSync(`shelf/index/${m[1]}.json`, 'utf8'), headers: { get: () => null } } : fetch(u); };
const refs = createReferences({ dir: mkdtempSync('/tmp/quizcheck-'), fetchImpl });
const bad = [];
for (const [medium, intent] of Object.entries(ASK)) {
  if (only.length && !only.includes(medium)) continue;
  const base = (await refs.suggest({ intent, medium, count: 12 })).directions.map((d) => d.id);
  for (const st of QUIZZES[medium]) for (const o of st.options) {
    const out = await refs.suggest({ intent, medium, count: 12, filters: o.filters || [], style: o.tags, ...(o.words ? { styleWords: o.words } : {}) });
    const d = out.directions || [];
    const changed = d.filter((x) => !base.includes(x.id)).length;
    const words = String(o.words || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 4).map((w) => w.replace(/s$/, ''));
    const carries = d.filter((x) => (o.filters || []).some((f) => (x.tags || []).includes(f)) || o.tags.some((t) => (x.tags || []).includes(t))
      || x.via === 'style' || words.some((w) => String(x.title).toLowerCase().includes(w))).length;
    const ok = d.length && carries >= Math.ceil(d.length / 2);
    if (!ok) bad.push(`${medium}/${o.id}`);
    console.log(`${ok ? '✓' : '✗'} ${medium.padEnd(9)} ${o.label.padEnd(26)} cards ${String(d.length).padStart(2)} · new ${String(changed).padStart(2)} · carry the pick ${carries}/${d.length}${out.loosened?.length ? ' · loosened ' + out.loosened.join(',') : ''}`);
  }
}
console.log(bad.length ? `\n${bad.length} picks that don't narrow: ${bad.join(', ')}` : '\nevery pick narrows');
