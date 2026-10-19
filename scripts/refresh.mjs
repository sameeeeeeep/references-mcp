#!/usr/bin/env node
// Rebuilds shelf/daily.json: what is trending right now for every medium. Two streams, round-robin so no
// one feed fills a shelf:
//   1. the latest uploads of brands and studios known for the craft, ranked by views
//   2. the live curations (Awwwards, Ads of the World, Staff Picks, Product Hunt, GitHub Trending...)
// (An open "this week, most viewed" YouTube search was tried and dropped: generic queries return news and
// tutorials, not craft. Intent-specific search happens per request instead, in references_suggest.)
// Run daily by .github/workflows/refresh.yml; every install reads the result, so people get what's new
// without yt-dlp or a dozen fetches of their own. Every stream fails soft.
import { writeFileSync, mkdirSync } from 'node:fs';
import { MEDIA } from '../src/catalog.mjs';
import { SOURCES, fetchLive, ytList } from '../src/sources.mjs';

const CHANNELS = {
  ad: ['apple', 'Nike', 'Spotify', 'Airbnb', 'duolingo'],
  video: ['apple', 'TheBrowserCompany', 'Figma', 'Notion', 'Stripe'],
  animation: ['kurzgesagt'],
  // Instagram serves nothing without a login, so social comes from the same brands' YouTube Shorts:
  // most post the same vertical cuts to both.
  social: ['duolingo', 'Spotify', 'Nike', 'apple', 'redbull', 'GoPro', 'Netflix', 'Ryanair', 'Wendys', 'Starbucks', 'Chipotle', 'Samsung', 'Airbnb'].map((h) => `${h}/shorts`),
};
const byViews = (a, b) => (b.views || 0) - (a.views || 0);

async function channelLatest(medium) {
  const lists = await Promise.all((CHANNELS[medium] || []).map((h) =>
    ytList(`https://www.youtube.com/@${h.includes('/') ? h : `${h}/videos`}`, 6).catch(() => [])));
  return lists.flat().sort(byViews).slice(0, medium === 'social' ? 12 : 8);
}

const shelf = { updated: new Date().toISOString(), media: {} };
const live = new Map();
for (const src of SOURCES.filter((s) => s.live && s.live !== 'shelf')) live.set(src.id, await fetchLive(src, {}));

for (const medium of MEDIA) {
  const groups = [
    { source: 'Latest from brands', kind: 'performance', items: await channelLatest(medium) },
    ...SOURCES.filter((s) => s.live && s.live !== 'shelf' && s.media.includes(medium))
      .map((s) => ({ source: s.name, kind: s.kind, items: live.get(s.id) || [] })),
  ].filter((g) => g.items.length);
  const out = [], seen = new Set();
  for (let i = 0; out.length < 12 && groups.some((g) => g.items[i]); i++) {
    for (const g of groups) {
      const it = g.items[i];
      if (it && !seen.has(it.url) && out.length < 12) {
        seen.add(it.url);
        const { views, duration, ...rest } = it;
        out.push({ ...rest, source: g.source, kind: g.kind });
      }
    }
  }
  shelf.media[medium] = out;
  console.log(`${medium}: ${out.length} (${groups.map((g) => `${g.source} ${g.items.length}`).join(', ')})`);
}

mkdirSync('shelf', { recursive: true });
writeFileSync('shelf/daily.json', JSON.stringify(shelf, null, 1) + '\n');
