#!/usr/bin/env node
// Stress test for personalisation: many different projects, same medium. Measures whether the sets actually
// differ by project (overlap), how often the hand-picked canon wins, award share, and whether each set
// reflects its project's context (tag hit-rate). Uses the local catalog in shelf/index; no network.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReferences } from '../src/references.mjs';

const PROJECTS = [
  { name: 'fintech dashboard', intent: 'landing page for a fintech trading dashboard', context: 'serious, data-dense, dark, trust, technology, charts', expect: ['Technology', 'Business & Corporate', 'Data Visualization', 'Clean', 'Fintech', 'Trading', 'Finance'] },
  { name: 'kids education app', intent: 'landing page for a kids math learning app', context: 'playful, colorful, illustration, friendly, children, education', expect: ['Illustration', 'Colorful', 'Culture & Education', 'Art & Illustration', 'Education', 'Kids', 'Edtech'] },
  { name: 'luxury perfume', intent: 'landing page for a luxury perfume brand', context: 'luxury, elegant, minimal, fashion, photography, premium', expect: ['Luxury', 'Fashion', 'Photography', 'Minimal'] },
  { name: 'dev tool', intent: 'landing page for a developer CLI tool', context: 'developer, technical, minimal, typography, black and white, startup', expect: ['Technology', 'Startups', 'Typography', 'Minimal', 'Developer Tools', 'B2B'] },
  { name: 'restaurant', intent: 'website for a neighbourhood restaurant', context: 'food, drink, warm, photography, local, hospitality', expect: ['Food & Drink', 'Hotel / Restaurant', 'Photography', 'Restaurant Tech', 'Food and Beverage', 'Food Tech'] },
  { name: 'architecture studio', intent: 'portfolio site for an architecture studio', context: 'architecture, portfolio, minimal, grid, photography, clean', expect: ['Architecture', 'Portfolio', 'Minimal', 'Photography'] },
  { name: 'music festival', intent: 'landing page for a music festival', context: 'events, music, loud, colorful, experimental, energetic', expect: ['Events', 'Music & Sound', 'Experimental', 'Colorful', 'Music', 'Entertainment'] },
  { name: 'mac wallpaper app', intent: 'landing page for wallpap, a macOS live wallpaper app', context: 'macOS app, live wallpapers, dark, lime accent, pixel type, scenic, 3D', expect: ['3D', 'Technology', 'Experimental', 'Animation', 'Big Background Images', 'Photo & Video', 'Consumer', 'Design Tools'] },
  { name: 'web3 game', intent: 'site for a web3 game launch', context: 'games, entertainment, 3D, webgl, dark, futuristic', expect: ['Games & Entertainment', '3D', 'WebGL', 'Gaming', 'Crypto / Web3', 'Cryptocurrency', 'Web3'] },
  { name: 'nonprofit', intent: 'landing page for a climate nonprofit', context: 'social responsibility, storytelling, scrolling, nature, institutions', expect: ['Social Responsibility', 'Storytelling', 'Institutions'] },
  { name: 'fashion ecommerce', intent: 'ecommerce site for a streetwear label', context: 'fashion, e-commerce, bold, typography, photography', expect: ['Fashion', 'E-Commerce', 'Typography', 'Retail', 'Apparel'] },
  { name: 'real estate', intent: 'site for a luxury real estate developer', context: 'real estate, luxury, architecture, big background images, elegant', expect: ['Real Estate', 'Luxury', 'Architecture', 'Proptech', 'Real Estate and Construction'] },
];

const medium = process.argv[2] || 'landing';
const dir = mkdtempSync(join(tmpdir(), 'refs-stress-'));
const fetchImpl = async (u) => {
  const m = /shelf\/index\/(\w+)\.json/.exec(String(u));
  if (m) return { ok: true, status: 200, text: async () => readFileSync(`shelf/index/${m[1]}.json`, 'utf8'), headers: { get: () => null } };
  return { ok: false, status: 404, text: async () => '', headers: { get: () => null } };
};
const refs = createReferences({ dir, fetchImpl, youtube: async () => [] });
const sets = [];
for (const p of PROJECTS) {
  const out = await refs.suggest({ intent: p.intent, medium, ...(process.env.NOCTX ? {} : { context: p.context }), count: 8 });
  const ids = out.directions.map((d) => d.id);
  const canon = out.directions.filter((d) => d.source === 'curated').map((d) => d.title);
  const hits = out.directions.filter((d) => (d.tags || []).some((t) => p.expect.includes(t))).length;
  const awards = out.directions.filter((d) => d.award === 'Site of the Day' || d.source === 'YC').length; // judged winners or YC companies
  sets.push({ p, ids });
  console.log(`${p.name.padEnd(20)} fit ${hits}/8  SOTD+YC ${awards}/8  canon [${canon.join(', ')}]`);
  console.log(`   ${out.directions.slice(0, 5).map((d) => d.title).join(' · ')}`);
}
// Overlap between different projects: a personal system keeps this near zero.
let pairs = 0, shared = 0;
const freq = new Map();
for (const s of sets) for (const id of s.ids) freq.set(id, (freq.get(id) || 0) + 1);
for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
  pairs++; shared += sets[i].ids.filter((id) => sets[j].ids.includes(id)).length / 8;
}
console.log(`\nmean overlap between different projects: ${(100 * shared / pairs).toFixed(0)}%`);
console.log('appears in most projects:', [...freq].filter(([, n]) => n >= 4).map(([id, n]) => `${id}×${n}`).join(', ') || 'none');
rmSync(dir, { recursive: true, force: true });
