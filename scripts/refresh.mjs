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
import { SOURCES, fetchLive, ytList, parseAwwwardsList, parseImages } from '../src/sources.mjs';
import { existsSync, readFileSync } from 'node:fs';

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

// ── The tagged catalog: only judged winners. Awwwards' Site of the Day and Honorable Mention listings (each card
// carries its style tags) → shelf/index/<medium>.json. Nominees never get in: references must be the best, not average.
const AWARDS = [['sites_of_the_day', 'Site of the Day', 40], ['honorable', 'Honorable Mention', 30]];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const UI_TAGS = new Set(['UI design', 'Interaction Design', 'Microinteractions', 'Navigation', 'Navigation Menu', 'Header Design', 'Footer Design',
  'Forms and Input', 'Forms & Input', 'Data Visualization', 'App Style', 'Gestures / Interaction', 'Menu Horizontal', 'Menu Vertical', 'Icons']);
const APP_TAGS = new Set(['Mobile Apps', 'App Style']);

const sites = new Map();
for (const [path, award, pages] of AWARDS) {
  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetch(`https://www.awwwards.com/websites/${path}/${page > 1 ? `?page=${page}` : ''}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) break;
      const found = parseAwwwardsList(await res.text());
      if (!found.length) break;
      for (const it of found) {
        const prev = sites.get(it.url);
        // A site that won Site of the Day keeps that, even if it also shows up among Honorable Mentions.
        sites.set(it.url, prev ? { ...prev, tags: [...new Set([...prev.tags, ...it.tags])] } : { ...it, award, rank: sites.size });
      }
    } catch { break; }
    await new Promise((r) => setTimeout(r, 400)); // be a polite crawler
  }
}
// ── Every active YC company: its site joins the landing catalog (tagged by industry, tags, batch), and the list
// itself (shelf/index/yc.json) lets a video ask find the launch films of YC companies in the same space.
const yc = [];
try {
  const res = await fetch('https://yc-oss.github.io/api/companies/all.json', { signal: AbortSignal.timeout(60000) });
  const list = (s) => (Array.isArray(s) ? s : String(s || '').match(/'([^']+)'/g)?.map((x) => x.slice(1, -1)) || []);
  for (const c of await res.json()) {
    // Active, public and acquired companies all keep live sites; only inactive ones are dropped. http → https.
    if (c.status === 'Inactive' || !/^https?:\/\//.test(c.website || '') || !c.slug) continue;
    c.website = c.website.replace(/^http:/, 'https:');
    yc.push({
      id: `yc:${c.slug}`, title: c.name, url: c.website.replace(/\/$/, ''), source: 'YC', batch: c.batch,
      top: String(c.top_company) === 'True', team: Number(c.team_size) || 0, note: String(c.one_liner || '').slice(0, 140),
      tags: [...new Set([c.industry, ...list(c.industries), ...list(c.tags), 'YC'].filter(Boolean))].slice(0, 12),
    });
  }
} catch (e) { console.log('yc: skipped', e.message); }
// Every YC site's picture, checked once and remembered (shelf/yc-pictures.json): the page's preview image, and only
// if that image really loads. Sites without a working picture stay out of the catalog. Misses are retried monthly.
const PIC_FILE = 'shelf/yc-pictures.json';
const pics = existsSync(PIC_FILE) ? JSON.parse(readFileSync(PIC_FILE, 'utf8')) : {};
const MONTH = 30 * 24 * 3600_000;
const due = yc.filter((c) => !pics[c.url] || (!pics[c.url].image && Date.now() - pics[c.url].at > MONTH));
async function pictureOf(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000), redirect: 'follow' });
    const imgs = parseImages((await res.text()).slice(0, 1_000_000), res.url || url);
    for (const img of imgs.slice(0, 2)) {
      // A HEAD (or a one-byte range GET where HEAD is refused) says whether the picture is real, without downloading it.
      let r = await fetch(img, { method: 'HEAD', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!r || r.status === 405 || r.status === 403) {
        r = await fetch(img, { headers: { 'user-agent': UA, range: 'bytes=0-0' }, signal: AbortSignal.timeout(8000) }).catch(() => null);
        if (r) await r.arrayBuffer().catch(() => {});
      }
      const type = r?.headers.get('content-type') || '';
      const size = Number(r?.headers.get('content-length') || 0);
      if (r && (r.ok || r.status === 206) && /^image\/(jpe?g|png|webp|gif)/.test(type) && (!size || size > 4000 || r.status === 206)) return img;
    }
  } catch {}
  return null;
}
// A stray fetch error deep in the HTTP client must not kill a 5,000-site run: log it and carry on.
process.on('uncaughtException', (e) => console.log('ignored:', e.code || e.message));
process.on('unhandledRejection', (e) => console.log('ignored:', e?.code || e?.message || e));
mkdirSync('shelf', { recursive: true });
for (let i = 0; i < due.length; i += 24) {
  // A hard cap per site: a response body that stalls can leave a fetch unsettled, and Node then quietly exits mid-run.
  const capped = (u) => Promise.race([pictureOf(u).catch(() => null), new Promise((r) => setTimeout(() => r(null), 30_000))]);
  await Promise.all(due.slice(i, i + 24).map(async (c) => { pics[c.url] = { image: await capped(c.url), at: Date.now() }; }));
  writeFileSync(PIC_FILE, JSON.stringify(pics) + '\n'); // progress survives a crash; the next run resumes
  if (i % 480 === 0) console.log(`yc pictures: ${Math.min(i + 24, due.length)}/${due.length}`);
}
for (const c of yc) c.image = pics[c.url]?.image || null;
const ycShown = yc.filter((c) => c.image);
console.log(`yc with a working picture: ${ycShown.length}/${yc.length}`);
mkdirSync('shelf/index', { recursive: true });
writeFileSync('shelf/index/yc.json', JSON.stringify({ updated: new Date().toISOString(), items: yc }) + '\n');
console.log(`index/yc: ${yc.length}`);

const toItem = (x) => ({ id: `aw:${x.url.split('/').pop()}`, title: x.title, url: x.url, image: x.image, tags: x.tags, source: 'Awwwards', award: x.award, rank: x.rank });
const all = [...sites.values()];
const index = {
  landing: [...all, ...ycShown], // only YC sites whose picture really loads
  ui: all.filter((x) => x.tags.some((t) => UI_TAGS.has(t))),
  app: all.filter((x) => x.tags.some((t) => APP_TAGS.has(t))),
};
mkdirSync('shelf/index', { recursive: true });


for (const [medium, items] of Object.entries(index)) {
  writeFileSync(`shelf/index/${medium}.json`, JSON.stringify({ updated: shelf.updated, items: items.map((x) => (x.source === 'YC' ? x : toItem(x))) }) + '\n');
  console.log(`index/${medium}: ${items.length}`);
}
