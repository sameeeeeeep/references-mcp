// The curations references come from: award shows, galleries and performance libraries, per medium.
// The point is that taste is already curated out there (Awwwards, Cannes Lions, Vimeo Staff Picks…);
// this server brings that to the user instead of making them go and search.
//
// kind: 'award' (judged winners) · 'gallery' (editor-picked) · 'performance' (what is actually running/winning).
// `live` names an adapter that pulls the current picks; the rest are pointers the agent can open (browser,
// or a dedicated tool such as the Meta Ad Library connector) when the user wants to go deeper.
// Live pulls are cached for 12h in the library dir so a suggest call costs at most a few small fetches per day.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCES = [
  // landing / ui
  { id: 'awwwards', name: 'Awwwards · Sites of the Day', kind: 'award', media: ['landing', 'ui'], url: 'https://www.awwwards.com/websites/sites_of_the_day/', live: 'awwwards' },
  { id: 'onepagelove', name: 'One Page Love', kind: 'gallery', media: ['landing'], url: 'https://onepagelove.com', live: 'onepagelove' },
  { id: 'godly', name: 'Godly', kind: 'gallery', media: ['landing', 'motion'], url: 'https://godly.website' },
  { id: 'land-book', name: 'Land-book', kind: 'gallery', media: ['landing'], url: 'https://land-book.com' },
  { id: 'saaslandingpage', name: 'SaaS Landing Page', kind: 'gallery', media: ['landing'], url: 'https://saaslandingpage.com' },
  { id: 'lapa', name: 'Lapa Ninja', kind: 'gallery', media: ['landing'], url: 'https://www.lapa.ninja' },
  { id: 'fwa', name: 'FWA', kind: 'award', media: ['landing', 'motion'], url: 'https://thefwa.com' },
  { id: 'cssda', name: 'CSS Design Awards', kind: 'award', media: ['landing', 'ui'], url: 'https://www.cssdesignawards.com' },
  { id: 'siteinspire', name: 'siteInspire', kind: 'gallery', media: ['landing'], url: 'https://www.siteinspire.com' },
  { id: 'webby', name: 'The Webby Awards', kind: 'award', media: ['landing', 'app', 'video', 'social'], url: 'https://www.webbyawards.com/winners/' },
  // app / ui
  { id: 'mobbin', name: 'Mobbin', kind: 'gallery', media: ['app', 'ui'], url: 'https://mobbin.com' },
  { id: 'screenlane', name: 'Screenlane', kind: 'gallery', media: ['app', 'ui'], url: 'https://screenlane.com' },
  { id: 'apple-design-awards', name: 'Apple Design Awards', kind: 'award', media: ['app', 'ui'], url: 'https://developer.apple.com/design/awards/' },
  // deck
  { id: 'pitchdeckhunt', name: 'Pitch Deck Hunt', kind: 'gallery', media: ['deck'], url: 'https://www.pitchdeckhunt.com' },
  { id: 'bestpitchdeck', name: 'Best Pitch Deck', kind: 'gallery', media: ['deck'], url: 'https://bestpitchdeck.com' },
  // video / animation / motion
  { id: 'vimeo-staffpicks', name: 'Vimeo Staff Picks', kind: 'gallery', media: ['video', 'animation'], url: 'https://vimeo.com/channels/staffpicks', live: 'vimeo' },
  { id: 'motionographer', name: 'Motionographer', kind: 'gallery', media: ['motion', 'animation'], url: 'https://motionographer.com', live: 'motionographer' },
  { id: 'stash', name: 'STASH', kind: 'gallery', media: ['motion', 'animation', 'video'], url: 'https://www.stashmedia.tv', live: 'stash' },
  { id: 'vimeo-motion', name: 'Vimeo · Motion Graphics', kind: 'gallery', media: ['motion'], url: 'https://vimeo.com/channels/motiongraphics', live: 'vimeomotion' },
  { id: 'annecy', name: 'Annecy Festival', kind: 'award', media: ['animation'], url: 'https://www.annecy.org' },
  { id: 'lottiefiles', name: 'LottieFiles · Featured', kind: 'gallery', media: ['motion'], url: 'https://lottiefiles.com/featured' },
  { id: 'rive', name: 'Rive Marketplace', kind: 'gallery', media: ['motion', 'animation'], url: 'https://rive.app/marketplace' },
  // ads
  { id: 'adsoftheworld', name: 'Ads of the World', kind: 'gallery', media: ['ad'], url: 'https://www.adsoftheworld.com', live: 'adsoftheworld' },
  { id: 'cannes-lions', name: 'Cannes Lions · Love the Work', kind: 'award', media: ['ad', 'social', 'video'], url: 'https://www.lovethework.com' },
  { id: 'dandad', name: 'D&AD Awards', kind: 'award', media: ['ad', 'landing', 'video'], url: 'https://www.dandad.org/awards' },
  { id: 'oneshow', name: 'The One Show', kind: 'award', media: ['ad', 'social'], url: 'https://www.oneclub.org/awards/theoneshow/' },
  { id: 'clios', name: 'Clio Awards', kind: 'award', media: ['ad', 'video', 'social'], url: 'https://clios.com' },
  { id: 'effie', name: 'Effie Awards (effectiveness)', kind: 'award', media: ['ad'], url: 'https://www.effie.org' },
  { id: 'meta-ad-library', name: 'Meta Ad Library', kind: 'performance', media: ['ad', 'social'], url: 'https://www.facebook.com/ads/library/', note: 'Long-running ads = ads that work. Use a Meta Ads connector (ads_library_search) if one is connected.' },
  { id: 'tiktok-top-ads', name: 'TikTok Creative Center · Top Ads', kind: 'performance', media: ['ad', 'social'], url: 'https://ads.tiktok.com/business/creativecenter/' },
  // social / post
  { id: 'shorty', name: 'Shorty Awards', kind: 'award', media: ['social', 'post'], url: 'https://shortyawards.com' },
  { id: 'hn-best', name: 'Hacker News · Best', kind: 'performance', media: ['post'], url: 'https://news.ycombinator.com/best', live: 'hnbest' },
];

// ── adapters: url → [{ title, url, image?, by?, note? }] ─────────────────────────────────────────
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const decode = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();

export function parseRss(xml, { strip } = {}) {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const tag = (t) => decode(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`).exec(it)?.[1]);
    const image = /<media:thumbnail[^>]*url="([^"]+)"/.exec(it)?.[1] || /(https?:\/\/[^"\s<>]+\.(?:jpe?g|png|webp))/.exec(it)?.[1];
    let title = tag('title');
    if (strip) title = title.replace(strip, '');
    return { title, url: tag('link'), image, note: tag('description').slice(0, 200) || undefined };
  }).filter((x) => x.title && x.url);
}

export function parseAdsOfTheWorld(html) {
  const out = new Map();
  for (const m of String(html).matchAll(/<a href="(\/campaigns\/[a-z0-9-]+)"><picture>[\s\S]*?<img alt="([^"]+)"[^>]*src="([^"]+)"[\s\S]*?<\/a>[\s\S]{0,400}?<a href="\1">([^<]+)<\/a>/g)) {
    const [, path, title, image, by] = m;
    if (!out.has(path)) out.set(path, { title: decode(title), url: `https://www.adsoftheworld.com${path}`, image, by: decode(by) });
  }
  return [...out.values()];
}

const ADAPTERS = {
  awwwards: { url: 'https://www.awwwards.com/feed/', parse: (s) => parseRss(s) },
  onepagelove: { url: 'https://onepagelove.com/feed', parse: (s) => parseRss(s, { strip: /^Website Inspiration:\s*/ }) },
  vimeo: { url: 'https://vimeo.com/channels/staffpicks/videos/rss', parse: (s) => parseRss(s) },
  adsoftheworld: { url: 'https://www.adsoftheworld.com', parse: parseAdsOfTheWorld },
  motionographer: { url: 'https://motionographer.com/feed/', parse: (s) => parseRss(s) },
  stash: { url: 'https://www.stashmedia.tv/feed/', parse: (s) => parseRss(s) },
  vimeomotion: { url: 'https://vimeo.com/channels/motiongraphics/videos/rss', parse: (s) => parseRss(s) },
  hnbest: { url: 'https://hnrss.org/best', parse: (s) => parseRss(s).map((x) => ({ ...x, note: undefined })) },
};

const TTL = 12 * 3600_000;

/** Current picks from a live source; cached, never throws (a dead source just yields nothing). */
export async function fetchLive(source, { cacheDir, fetchImpl = fetch, now = Date.now() } = {}) {
  const adapter = ADAPTERS[source.live];
  if (!adapter) return [];
  const file = cacheDir && join(cacheDir, 'references-cache.json');
  let cache = {};
  try { if (file && existsSync(file)) cache = JSON.parse(readFileSync(file, 'utf8')); } catch { cache = {}; }
  const hit = cache[source.id];
  if (hit && now - hit.at < TTL) return hit.items;
  try {
    const res = await fetchImpl(adapter.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const items = adapter.parse(await res.text()).slice(0, 12);
    if (file) {
      // Re-read before writing: other sources and previews fill the same file in parallel.
      try { const fresh = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; fresh[source.id] = { at: now, items }; mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(fresh)); } catch {}
    }
    return items;
  } catch {
    return hit?.items || [];
  }
}

const OG_TTL = 30 * 24 * 3600_000;

/** A page's preview image (og:image / twitter:image), cached for 30 days; null when there is none. */
export async function previewImage(url, { cacheDir, fetchImpl = fetch, now = Date.now() } = {}) {
  if (!/^https:\/\//.test(url || '')) return null;
  const yt = /youtube\.com\/watch\?v=([\w-]{11})|youtu\.be\/([\w-]{11})/.exec(url);
  if (yt) return `https://i.ytimg.com/vi/${yt[1] || yt[2]}/hqdefault.jpg`;
  const file = cacheDir && join(cacheDir, 'references-cache.json');
  let cache = {};
  try { if (file && existsSync(file)) cache = JSON.parse(readFileSync(file, 'utf8')); } catch { cache = {}; }
  const key = `og:${url}`;
  if (cache[key] && now - cache[key].at < OG_TTL) return cache[key].image;
  let image = null;
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(5000) });
    const html = (await res.text()).slice(0, 300_000);
    const m = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/i.exec(html)
      || /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i.exec(html);
    if (m) image = new URL(decode(m[1]), url).href;
    if (image && !/^https:\/\//.test(image)) image = null;
  } catch { return cache[key]?.image ?? null; }
  if (file) {
    try { const fresh = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; fresh[key] = { at: now, image }; mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(fresh)); } catch {}
  }
  return image;
}
