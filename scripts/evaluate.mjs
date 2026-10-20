#!/usr/bin/env node
// Thorough evaluation across media and very different projects: is every set pictured, on-brief, junk-free and
// different from other projects' sets? Uses the local catalog (shelf/index) and live YouTube (needs yt-dlp).
//   node scripts/evaluate.mjs            all media
//   node scripts/evaluate.mjs video ad   some media
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReferences } from '../src/references.mjs';

// Each project: what it is, its context, and words an on-brief reference would carry (in tags or title).
const P = (name, intent, context, terms) => ({ name, intent, context, terms });
const PLAN = {
  landing: [
    P('fintech', 'landing page for a fintech startup', 'b2b payments, fintech, trust', ['fintech', 'payments', 'finance', 'banking', 'business', 'trading', 'data visualization']),
    P('kids edtech', 'landing page for a kids math learning app', 'playful, colorful, education, children', ['education', 'kids', 'illustration', 'colorful', 'edtech', 'learning']),
    P('luxury perfume', 'landing page for a luxury perfume brand', 'luxury, fashion, elegant', ['luxury', 'fashion', 'beauty', 'minimal', 'photography']),
    P('dev tool', 'landing page for an AI developer tool', 'developer tools, AI, technical', ['developer tools', 'technology', 'artificial intelligence', 'ai', 'startups', 'saas', 'devops']),
    P('restaurant', 'website for a neighbourhood restaurant', 'food, drink, warm, local', ['food', 'restaurant', 'drink', 'hospitality']),
    P('climate nonprofit', 'landing page for a climate nonprofit', 'climate, social responsibility, storytelling', ['climate', 'social responsibility', 'storytelling', 'sustainability', 'energy']),
    P('health app', 'landing page for a consumer health app', 'healthcare, wellness, calm', ['health', 'healthcare', 'wellness', 'medical']),
    P('real estate', 'site for a luxury real estate developer', 'real estate, architecture, luxury', ['real estate', 'architecture', 'luxury', 'proptech']),
  ],
  ui: [
    P('analytics dashboard', 'dashboard UI for product analytics', 'data visualization, saas, dense', ['data visualization', 'ui design', 'saas', 'analytics', 'interaction design']),
    P('banking app ui', 'mobile banking app UI', 'fintech, clean, trust', ['fintech', 'banking', 'clean', 'ui design', 'app style']),
    P('creative tool', 'UI for a design tool', 'design tools, creative, playful', ['design', 'interaction design', 'ui design', 'microinteractions']),
  ],
  video: [
    P('fintech launch', 'launch video for our fintech app', 'b2b payments, finance teams', ['fintech', 'finance', 'payment', 'bank', 'card', 'money', 'launch', 'introducing']),
    P('perfume film', 'launch film for a luxury perfume brand', 'luxury fragrance', ['parfum', 'perfume', 'fragrance', 'film', 'campaign']),
    P('dev tool launch', 'launch video for an AI developer tool', 'developer tools, AI', ['launch', 'introducing', 'ai', 'developer', 'code', 'demo']),
    P('health campaign', 'launch film for a consumer health app', 'healthcare, wellness', ['health', 'care', 'wellness', 'medical', 'campaign', 'commercial']),
    P('game trailer', 'launch trailer for an indie game', 'games, cinematic', ['trailer', 'game', 'launch']),
    P('mac app', 'launch film for a macOS app', 'mac app, design, minimal', ['mac', 'app', 'introducing', 'launch', 'apple']),
  ],
  ad: [
    P('snack brand', 'ad for a snack brand', 'food, playful, bold', ['commercial', 'ad', 'snack', 'chips', 'cookies', 'food', 'campaign']),
    P('sneakers', 'launch ad for running shoes', 'sport, running, energetic', ['running', 'run', 'nike', 'adidas', 'shoe', 'sneaker', 'commercial', 'ad']),
    P('bank', 'ad campaign for a neobank', 'fintech, trust, modern', ['bank', 'money', 'finance', 'card', 'commercial', 'ad', 'campaign']),
    P('car', 'commercial for an electric car', 'automotive, premium, cinematic', ['car', 'electric', 'ev', 'commercial', 'film', 'drive']),
  ],
  motion: [
    P('app promo', 'motion graphics promo for my app', 'saas, product, clean', ['motion', 'animation', 'promo', 'app', 'product', 'launch']),
    P('brand reel', 'motion design reel for a brand refresh', 'brand, bold, typography', ['motion', 'reel', 'brand', 'design', 'showreel']),
  ],
  animation: [
    P('explainer', 'animated explainer for a startup', 'friendly, simple', ['animated', 'animation', 'explainer', 'short film']),
    P('short film', 'animated short film style', 'cinematic, emotional', ['animated', 'animation', 'short film', 'film']),
  ],
  social: [
    P('brand shorts', 'social reels for a coffee brand', 'coffee, cozy, playful', ['coffee', 'shorts', 'reel', 'brand', 'campaign']),
  ],
};

const JUNK = /\b(official trailer|trailer \(|hindi|telugu|tamil|malayalam|kannada|bollywood|tutorial|how to|reaction|recap|lyrics|music video|full movie|example|sample|course|vs\.?|top \d+|\d+ best|podcast|interview|review)\b/i;

const only = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), 'refs-eval-'));
const fetchImpl = async (u) => {
  const m = /shelf\/index\/(\w+)\.json/.exec(String(u));
  if (m) return { ok: true, status: 200, text: async () => readFileSync(`shelf/index/${m[1]}.json`, 'utf8'), headers: { get: () => null } };
  return fetch(u);
};
const refs = createReferences({ dir, fetchImpl });
const report = {};
for (const [medium, projects] of Object.entries(PLAN)) {
  if (only.length && !only.includes(medium)) continue;
  console.log(`\n=== ${medium}`);
  const sets = [];
  for (const p of projects) {
    const t0 = Date.now();
    const out = await refs.suggest({ intent: p.intent, medium, context: p.context, count: 8 });
    const d = out.directions || [];
    const pictured = d.filter((x) => x.image || x.gallery?.length).length;
    const junk = d.filter((x) => JUNK.test(x.title) && !(p.terms.includes('trailer') && /trailer/i.test(x.title))).map((x) => x.title);
    const onBrief = d.filter((x) => p.terms.some((w) => [...(x.tags || []), x.title].join(' ').toLowerCase().includes(w))).length;
    const canon = d.filter((x) => x.source === 'curated').length;
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    sets.push(d.map((x) => x.id));
    report[`${medium}/${p.name}`] = { cards: d.length, pictured, onBrief, junk: junk.length, canon, secs, titles: d.map((x) => `${x.source}: ${x.title}`) };
    const flag = d.length < 6 || pictured < d.length || onBrief < 5 || junk.length || canon > 1 ? '  ⚠' : '';
    console.log(`${p.name.padEnd(20)} cards ${d.length}  pictured ${pictured}/${d.length}  on-brief ${onBrief}/${d.length}  junk ${junk.length}  canon ${canon}  ${secs}s${flag}`);
    for (const x of d.slice(0, 8)) console.log(`     ${(x.source || '').padEnd(10)} ${x.title.slice(0, 84)}`);
    if (junk.length) console.log(`     junk: ${junk.join(' | ')}`);
  }
  let pairs = 0, shared = 0;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    pairs++; shared += sets[i].filter((id) => sets[j].includes(id)).length / Math.max(1, Math.min(sets[i].length, sets[j].length));
  }
  console.log(`overlap between ${medium} projects: ${pairs ? Math.round(100 * shared / pairs) : 0}%`);
}
writeFileSync('scripts/evaluate-report.json', JSON.stringify(report, null, 1));
const all = Object.values(report);
const sum = (k) => all.reduce((a, r) => a + r[k], 0), cards = sum('cards');
console.log(`\nTOTAL ${all.length} projects · ${cards} cards · pictured ${Math.round(100 * sum('pictured') / cards)}% · on-brief ${Math.round(100 * sum('onBrief') / cards)}% · junk ${sum('junk')} · canon ${sum('canon')} · thin sets ${all.filter((r) => r.cards < 6).length}`);
rmSync(dir, { recursive: true, force: true });
