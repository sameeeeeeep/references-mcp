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
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';

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
  // the daily shelf this repo rebuilds itself (scripts/refresh.mjs): what is trending per medium
  { id: 'shelf', name: 'Daily shelf · trending', kind: 'trending', media: ['ui', 'landing', 'app', 'deck', 'video', 'motion', 'animation', 'social', 'post', 'ad'], url: 'https://github.com/sameeeeeeep/references-mcp/blob/main/shelf/daily.json', live: 'shelf' },
  // viral projects (what launched and took off)
  { id: 'producthunt', name: 'Product Hunt · Today', kind: 'trending', media: ['app', 'landing', 'ui'], url: 'https://www.producthunt.com', live: 'producthunt' },
  { id: 'github-trending', name: 'GitHub Trending', kind: 'trending', media: ['app', 'ui'], url: 'https://github.com/trending', live: 'githubtrending' },
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

export function parseAtom(xml) {
  return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, it]) => {
    const link = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(it)?.[1];
    const content = decode(decode(/<content[^>]*>([\s\S]*?)<\/content>/.exec(it)?.[1] || '')).replace(/\s+/g, ' ').replace(/Discussion \| Link\s*$/, '').trim();
    return { title: decode(/<title>([\s\S]*?)<\/title>/.exec(it)?.[1]), url: link, note: content.slice(0, 200) || undefined };
  }).filter((x) => x.title && x.url);
}

export function parseGitHubTrending(html) {
  return [...String(html).matchAll(/<article class="Box-row">([\s\S]*?)<\/article>/g)].map(([, a]) => {
    const path = /<h2[^>]*>\s*<a[^>]*href="(\/[^"/]+\/[^"/]+)"/.exec(a)?.[1];
    if (!path) return null;
    const stars = /([\d,]+) stars today/.exec(a)?.[1];
    return {
      title: path.slice(1), url: `https://github.com${path}`, image: `https://opengraph.githubassets.com/1${path}`,
      by: stars ? `★ ${stars} today` : undefined, note: decode(/<p class="[^"]*">([\s\S]*?)<\/p>/.exec(a)?.[1]).replace(/\s+/g, ' ').slice(0, 200) || undefined,
    };
  }).filter(Boolean);
}

// An Awwwards listing page (a category, a tag, Sites of the Day): each card carries its own JSON with the
// site's title, slug, thumbnail and style tags (Scrolling, Storytelling, WebGL, Minimal...).
export function parseAwwwardsList(html) {
  const out = [];
  for (const m of String(html).matchAll(/data-collectable-model-value="([^"]+)"/g)) {
    let d;
    try { d = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'")); } catch { continue; }
    const thumb = d.images?.thumbnail || d.collectableImage;
    if (!d.slug || !thumb || !/^[a-z0-9-]+$/.test(d.slug)) continue;
    out.push({
      title: decode(d.title || d.collectableTitle || d.slug), url: `https://www.awwwards.com/sites/${d.slug}`,
      image: `https://assets.awwwards.com/awards/media/cache/thumb_880_660/${String(thumb).replace(/^\/+/, '')}`,
      tags: (d.tags || []).map((t) => decode(String(t))).filter(Boolean).slice(0, 20),
    });
  }
  return out;
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
  producthunt: { url: 'https://www.producthunt.com/feed', parse: (s) => parseAtom(s) },
  githubtrending: { url: 'https://github.com/trending', parse: (s) => parseGitHubTrending(s) },
  // One JSON for all media; fetchLive caches it per medium id (shelf:<medium>), see shelfFor().
  shelf: { url: 'https://raw.githubusercontent.com/sameeeeeeep/references-mcp/main/shelf/daily.json', parse: (s) => JSON.parse(s) },
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
    const items = adapter.parse(await res.text(), source).slice(0, 12);
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
export async function previewImage(url, { cacheDir, fetchImpl = pinnedFetch, now = Date.now(), check = resolvesPublic } = {}) {
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
    const res = await safeFetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(5000) }, fetchImpl, check);
    const html = (await res.text()).slice(0, 300_000);
    const m = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/i.exec(html)
      || /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i.exec(html);
    if (m) image = new URL(decode(m[1]), url).href;
    if (image && !isPublicHttpsUrl(image)) image = null;
  } catch { return cache[key]?.image ?? null; }
  if (file) {
    try { const fresh = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; fresh[key] = { at: now, image }; mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(fresh)); } catch {}
  }
  return image;
}

// ── YouTube, searched by intent and ranked by views: what people actually watched ───────────────────
// Needs yt-dlp on PATH (no download; metadata only). Absent or failing, it yields nothing.
const YT_TTL = 24 * 3600_000;
const YT_HINT = { video: '', motion: 'motion design', animation: 'animation', ad: 'ad commercial', social: 'shorts', deck: 'keynote presentation', landing: 'website design', ui: 'ui design', app: 'app design', post: '' };
export const YT_MEDIA = ['video', 'motion', 'animation', 'ad', 'social'];
const fmtViews = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n)) + ' views';

export function parseYtLines(text) {
  return String(text).split('\n').map((l) => {
    const [views, dur, id, ...t] = l.split('\t');
    if (!/^[\w-]{11}$/.test(id || '')) return null;
    return { title: t.join(' ').trim(), url: `https://www.youtube.com/watch?v=${id}`, image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, views: Number(views) || 0, duration: Number(dur) || 0 };
  }).filter(Boolean);
}

// Searching the person's own words ("launch film for wallpap") hits whatever is popular for the unknown name;
// search the craft instead, and keep only results whose titles share a craft word with it.
const CRAFT = new Set('launch film video trailer teaser product reveal ad ads commercial campaign explainer demo promo motion animation animated brand reel shorts short story app website site ui ux keynote intro title sequence cinematic 3d logo unboxing announcement spot tvc music saas startup iphone mac android game wallpaper typography kinetic'.split(' '));
export function craftQuery(intent, medium) {
  const words = String(intent).toLowerCase().split(/[^a-z0-9]+/).filter((w) => CRAFT.has(w));
  const base = [...new Set(words)];
  if (base.includes('launch') && !base.includes('product')) base.unshift('product');
  const hint = (YT_HINT[medium] || '').split(' ').filter((w) => w && !base.includes(w));
  return { query: [...base, ...hint].join(' ') || (YT_HINT[medium] || 'product launch video'), words: base.length ? base.filter((w) => w !== 'video') : hint };
}

export async function searchYouTube(intent, medium, { cacheDir, now = Date.now(), run = ytdlp, search = 'ytsearch15', style = '' } = {}) {
  const crafted = craftQuery(intent, medium);
  const extra = String(style).toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter((w) => w && !crafted.query.split(' ').includes(w)).slice(0, 4);
  const { words } = crafted;
  const query = [...crafted.query.split(' '), ...extra].join(' ');
  const file = cacheDir && join(cacheDir, 'references-cache.json');
  const key = `yt:${search}:${query.toLowerCase()}`;
  let cache = {};
  try { if (file && existsSync(file)) cache = JSON.parse(readFileSync(file, 'utf8')); } catch { cache = {}; }
  if (cache[key] && now - cache[key].at < YT_TTL) return cache[key].items;
  let items = [];
  try {
    items = parseYtLines(await run(['--flat-playlist', '--no-warnings', '--print', '%(view_count)s\t%(duration)s\t%(id)s\t%(title)s', `${search}:${query}`]))
      .filter((x) => x.duration && x.duration < 1200) // films and ads, not livestreams or hour-long talks
      .filter((x) => !words.length || words.some((w) => x.title.toLowerCase().includes(w)))
      .sort((a, b) => b.views - a.views)
      .filter((x, i, all) => all.findIndex((y) => y.title.toLowerCase() === x.title.toLowerCase()) === i)
      .slice(0, 8)
      .map(({ views, duration, ...x }) => ({ ...x, by: fmtViews(views) }));
  } catch { return cache[key]?.items || []; }
  if (file) {
    try { const fresh = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; fresh[key] = { at: now, items }; mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(fresh)); } catch {}
  }
  return items;
}

/** Any YouTube list (a channel tab, a filtered search URL), newest-first as YouTube gives it, with views. */
export async function ytList(url, n = 10, run = ytdlp) {
  return parseYtLines(await run(['--flat-playlist', '--no-warnings', '--playlist-end', String(n), '--print', '%(view_count)s\t%(duration)s\t%(id)s\t%(title)s', url]))
    .map(({ views, ...x }) => ({ ...x, views, by: fmtViews(views) }));
}

function ytdlp(args) {
  const PATH = ['/opt/homebrew/bin', '/usr/local/bin', process.env.PATH].filter(Boolean).join(':');
  return new Promise((resolve, reject) => execFile('yt-dlp', args, { timeout: 15_000, env: { ...process.env, PATH }, maxBuffer: 4 << 20 }, (err, out) => (err ? reject(err) : resolve(out))));
}

/** Today's shelf for one medium (from the repo's daily.json), cached like any live source. */
export async function shelfFor(medium, { cacheDir, fetchImpl = fetch, now = Date.now() } = {}) {
  const src = { id: `shelf:${medium}`, live: 'shelfmedium', medium };
  return fetchLive(src, { cacheDir, fetchImpl, now });
}
ADAPTERS.shelfmedium = { url: ADAPTERS.shelf.url, parse: (s, src) => (JSON.parse(s).media?.[src.medium] || []).map(({ title, url, image, by, note, source }) => ({ title, url, image, by: by || source, note })) };

// ── A reference's own pictures: the og image plus the real gallery on its page, for the carousel ──────────
const NOT_A_PICTURE = /\.(svg|gif|ico)(\?|$)|logo|icon|avatar|sprite|favicon|badge|emoji|pixel|spacer|placeholder|1x1|gravatar|profile/i;
// Where a site keeps the work itself, so its page chrome stays out of the carousel.
const SITE_IMAGES = [
  [/awwwards\.com/, /\/awards\/(submissions|sites_of_the_day)\//],
  [/adsoftheworld\.com/, /image\.adsoftheworld\.com\//],
  [/producthunt\.com/, /ph-files\.imgix\.net\//],
  [/onepagelove\.com/, /assets\.onepagelove\.com\/.*opl-screenshot/],
  [/motionographer\.com/, /motionographer\.com\/wp-content\/uploads\//],
];

export function parseImages(html, pageUrl, max = 6) {
  const out = [], seen = new Set();
  const add = (raw) => {
    if (!raw || out.length >= max) return;
    let u;
    try { u = new URL(decode(raw.trim().split(/\s+/)[0]), pageUrl); } catch { return; }
    if (!isPublicHttpsUrl(u.href) || NOT_A_PICTURE.test(u.pathname)) return;
    const site = SITE_IMAGES.find(([host]) => host.test(pageUrl));
    if (site && out.length && !site[1].test(u.href)) return; // after the og image, only the site's own work
    // WordPress sidebars show other posts: keep uploads from the same month as the lead image.
    const month = (x) => /\/uploads\/(\d{4}\/\d{2})\//.exec(x)?.[1];
    if (out.length && month(out[0]) && month(u.href) && month(u.href) !== month(out[0])) return;
    // One picture at several sizes (desktop/tablet/mobile, 1x/2x) is one slide.
    const key = (/imgix|cdn-cgi/.test(u.href) ? u.href : u.origin + u.pathname).replace(/[-_.@](desktop|tablet|mobile|[123]x)(?=[-_.@]|$)/gi, '').replace(/\.[0-9a-f]{8}(?=\.\w+$)/, '');
    if (seen.has(key)) return;
    seen.add(key); out.push(u.href);
  };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    const w = Number(/\bwidth=["']?(\d+)/i.exec(tag)?.[1] || 0), h = Number(/\bheight=["']?(\d+)/i.exec(tag)?.[1] || 0);
    if ((w && w < 300) || (h && h < 200)) continue;
    const srcset = /\b(?:data-)?srcset=["']([^"']+)["']/i.exec(tag)?.[1];
    const best = srcset && srcset.split(',').map((x) => x.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1] || 0) - parseFloat(a[1] || 0))[0]?.[0];
    add(best || /\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i.exec(tag)?.[1]);
  }
  return out;
}

// Screen recordings of the work itself, from hosts we know serve them: these become the card's moving preview.
const VIDEO_HOSTS = [/^https:\/\/assets\.awwwards\.com\/awards\/element\/[\w/.-]+\.mp4$/];
export function parseVideos(html, max = 3) {
  const out = [];
  for (const m of String(html).matchAll(/https:\/\/[^"'\s<>]+?\.mp4/g)) {
    const u = m[0];
    if (VIDEO_HOSTS.some((r) => r.test(u)) && !out.includes(u) && out.length < max) out.push(u);
  }
  return out;
}

const GAL_TTL = 30 * 24 * 3600_000;

/** Up to 6 pictures of a reference (its page's og image first, then its gallery); cached 30 days. */
export async function pageImages(url, { cacheDir, fetchImpl = pinnedFetch, now = Date.now(), check = resolvesPublic } = {}) {
  if (!/^https:\/\//.test(url || '')) return [];
  const yt = /youtube\.com\/watch\?v=([\w-]{11})|youtu\.be\/([\w-]{11})/.exec(url);
  if (yt) return [`https://i.ytimg.com/vi/${yt[1] || yt[2]}/hqdefault.jpg`];
  const file = cacheDir && join(cacheDir, 'references-cache.json');
  const key = `gal:${url}`;
  let cache = {};
  try { if (file && existsSync(file)) cache = JSON.parse(readFileSync(file, 'utf8')); } catch { cache = {}; }
  if (cache[key] && now - cache[key].at < GAL_TTL) return cache[key].images;
  let images = [], videos = [];
  try {
    const res = await safeFetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(6000) }, fetchImpl, check);
    const html = (await res.text()).slice(0, 1_500_000);
    videos = parseVideos(html);
    const found = parseImages(html, url);
    // The pictures get downloaded too, so each must also resolve to a public address.
    const ok = await Promise.all(found.map((x) => check(x).catch(() => false)));
    images = found.filter((_, i) => ok[i]);
  } catch { return cache[key]?.images || []; }
  if (file) {
    try { const fresh = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; fresh[key] = { at: now, images }; fresh[`vid:${url}`] = { at: now, videos }; mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(fresh)); } catch {}
  }
  return images;
}

/** The screen recordings pageImages found on the same page (call it first); [] when none. */
export function pageVideos(url, { cacheDir } = {}) {
  try { return JSON.parse(readFileSync(join(cacheDir, 'references-cache.json'), 'utf8'))[`vid:${url}`]?.videos || []; } catch { return []; }
}

// ── Fetching addresses that came from third-party feeds: public https hosts only ────────────────────────
// Page and gallery URLs are written by other sites, so they must never reach this machine or its network:
// https on the default port, a hostname (or IP) that is not loopback, private, link-local or otherwise
// internal, checked again on every redirect hop.
const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^198\.1[89]\./, /^2(2[4-9]|[3-5]\d)\./];
// IPv6 forms that carry an IPv4 address (::ffff:a.b.c.d, ::ffff:7f00:1, ::a.b.c.d) are judged by that address.
function embeddedV4(x) {
  const dotted = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(x);
  if (dotted) return dotted[1];
  const hex = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(x);
  if (!hex) return null;
  const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16);
  return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
}

export function isPrivateAddress(ip) {
  const v = String(ip).replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(v) === 4) return PRIVATE_V4.some((r) => r.test(v));
  if (isIP(v) !== 6) return true; // not an address we can judge: refuse
  const v4 = embeddedV4(v);
  if (v4) return PRIVATE_V4.some((r) => r.test(v4));
  // unspecified, loopback, unique-local, link-local, multicast, NAT64 and 6to4 (both can wrap internal v4)
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || /^64:ff9b:/.test(v) || /^2002:/.test(v);
}

export function isPublicHttpsUrl(u) {
  let x;
  try { x = new URL(u); } catch { return false; }
  if (x.protocol !== 'https:' || (x.port && x.port !== '443') || x.username || x.password) return false;
  const host = x.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') && !isIP(host)) return false;
  return !(isIP(host) && isPrivateAddress(host));
}

async function resolvesPublic(u) {
  const host = new URL(u).hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return !isPrivateAddress(host);
  try { return (await lookup(host, { all: true })).every((a) => !isPrivateAddress(a.address)); } catch { return false; }
}

/**
 * The connection's own DNS lookup, refusing internal addresses. Used as the socket's `lookup`, so the address
 * that is checked is the address that is connected to: no window between check and connect (DNS rebinding).
 */
export function pinnedLookup(resolve = lookup) {
  return (host, opts, cb) => {
    resolve(host, { all: true }).then((addrs) => {
      if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return cb(Object.assign(new Error(`refused: ${host}`), { code: 'EREFUSED' }));
      const a = addrs[0];
      return opts && opts.all ? cb(null, [{ address: a.address, family: a.family }]) : cb(null, a.address, a.family);
    }, (err) => cb(err));
  };
}

/** A minimal fetch over node:https whose sockets connect only to public addresses; no redirects of its own. */
export function pinnedFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers: init.headers, lookup: pinnedLookup(), timeout: 6000 }, (res) => {
      const chunks = []; let size = 0;
      res.on('data', (c) => { size += c.length; if (size > 2_000_000) req.destroy(); else chunks.push(c); });
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, ok: res.statusCode < 300, headers: { get: (k) => res.headers[String(k).toLowerCase()] ?? null }, text: async () => body });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    init.signal?.addEventListener?.('abort', () => req.destroy(new Error('aborted')));
    req.end();
  });
}

/** Fetch for third-party addresses: public https only, every redirect hop re-checked, connections pinned. */
export async function safeFetch(url, init = {}, fetchImpl = pinnedFetch, check = resolvesPublic) {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isPublicHttpsUrl(at) || !(await check(at))) throw new Error(`refused: ${at}`);
    const res = await fetchImpl(at, { ...init, redirect: 'manual' });
    const to = res.status >= 300 && res.status < 400 && res.headers?.get?.('location');
    if (!to) return res;
    at = new URL(to, at).href;
  }
  throw new Error('too many redirects');
}

// ── The big tagged catalog: shelf/index/<medium>.json, crawled daily from the galleries' category pages ─────
export const INDEX_URL = (medium) => `https://raw.githubusercontent.com/sameeeeeeep/references-mcp/main/shelf/index/${medium}.json`;
const INDEX_TTL = 3 * 3600_000;
const INDEX_VERSION = 2; // bump when the catalog's shape or source changes: old caches are ignored

export async function loadIndex(medium, { cacheDir, fetchImpl = fetch, now = Date.now() } = {}) {
  const file = cacheDir && join(cacheDir, `references-index-v${INDEX_VERSION}-${medium}.json`);
  let hit = null;
  try { if (file && existsSync(file)) hit = JSON.parse(readFileSync(file, 'utf8')); } catch {}
  if (hit && now - hit.at < INDEX_TTL) return hit.items;
  try {
    const res = await fetchImpl(INDEX_URL(medium), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const items = (JSON.parse(await res.text()).items || []).filter((x) => x && x.title && isPublicHttpsUrl(x.url || ''));
    if (file) { try { mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify({ at: now, items })); } catch {} }
    return items;
  } catch { return hit?.items || []; }
}

// ── A per-project pool for media with no tagged catalog (video, ads, motion, animation, social) ───────────
// Two searches built from the project itself: the brief's own words and the project context, each with the
// medium's noun ("luxury perfume commercial", "kids learning app launch film"). Proven work only: a views
// floor, a length cap, no duplicates. Each search is cached a day.
const ALT = { video: 'commercial', ad: 'campaign', motion: 'animation', animation: 'short film', social: 'campaign' };
const NOUN = { video: 'launch film', ad: 'commercial ad', motion: 'motion design reel', animation: 'animated short film', social: 'brand shorts' };
// Not references: how-tos, recaps, reactions, quizzes, songs, movie trailers, recipes, vlogs, reviews, lists.
const NOT_CRAFT = /\b(\d+ (?:settings|things|tips|tricks|ways|mistakes)|you need to|rocket|spacex|starship|falcon 9|ship launch|fails|close calls|live:|who does it better|with claude|unlocked|hindi|telugu|tamil|malayalam|kannada|punjabi|marathi|bollywood|tollywood|how i|here'?s how|how to|tutorial|course|explained|recap|reaction|reacts?|quiz|guess the|lyrics?|song|music video|official audio|official video|full movie|movie|netflix|hbo|recipe|vlog|podcast|interview|review|unboxing|walkthrough|beginner|in \d+ minutes|lesson|class \d|learn to|kids songs|nursery|asmr|live ?stream|compilation|top \d+|\d+ best|best \d+|vs\.?|episode|ep\.? ?\d|news|highlights|gameplay|let'?s play|tips|hack|guide)\b/i;
// Made work: films, campaigns, ads, launches, teasers, reels.
const MADE_WORK = /\b(explainer|product video|demo video|introduces|presents|official launch|design film|brand film|film|campaign|commercial|\bad\b|spec ad|tvc|launch|introducing|teaser|showreel|reel|spot|brand video|promo|keynote|motion|animation|animated|short film|manifesto)\b/i;
const MAX_LEN = { video: 600, ad: 240, motion: 600, animation: 1200, social: 120 };
const FILLER = new Set('a an the and or for of to in on with my our me we i it this that make build design create new some want need like page site website app video film launch ad ads commercial reel short shorts motion animation animated social post landing brand product macos ios android'.split(' '));
const keyWords = (text, n) => [...new Set(String(text).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !FILLER.has(w)))].slice(0, n);

export async function projectPool(intent, medium, context = '', { cacheDir, run = ytdlp, minViews = 20000 } = {}) {
  // Movie and game trailers only when the brief is about one.
  const trailers = /\b(game|trailer|teaser|movie|film festival)\b/i.test(`${intent} ${context}`);
  if (!NOUN[medium]) return [];
  const brief = keyWords(intent, 3), about = keyWords(context, 3);
  // What kind of thing it is, from plain words: "Mac app launch film" finds Mac app launches even for an unknown name.
  const text = `${intent} ${context}`.toLowerCase();
  const kind = [['mac app', /\b(mac|macos)\b/], ['ios app', /\b(ios|iphone)\b/], ['app', /\bapp\b/], ['saas', /\bsaas\b/], ['startup', /\bstartup\b/],
    ['game', /\bgame\b/], ['fragrance', /\b(perfume|fragrance)\b/], ['fashion', /\bfashion\b/], ['brand', /\bbrand\b/]].find(([, r]) => r.test(text))?.[0] || 'product';
  const queries = [...new Set([
    brief.length ? `${brief.join(' ')} ${NOUN[medium]}` : '',
    brief.length ? `${brief.join(' ')} ${ALT[medium]}` : '',
    about.length ? `${about.join(' ')} ${NOUN[medium]}` : '',
    `${kind} ${NOUN[medium]}`,
  ].filter(Boolean))];
  const seen = new Set(), out = [];
  for (const q of queries) {
    if (out.length >= 24) break;
    const items = await cachedYt(q, { cacheDir, run });
    for (const it of items) {
      if (seen.has(it.url) || it.views < minViews || !it.duration || it.duration > MAX_LEN[medium] || NOT_CRAFT.test(it.title)) continue;
      if (!trailers && /\btrailer\b/i.test(it.title)) continue;
      // Made work only (a film, campaign, commercial, launch, showreel…): popularity alone never gets a video in.
      if (!MADE_WORK.test(it.title)) continue;
      seen.add(it.url);
      out.push({ ...it, query: q, craft: true });
    }
  }
  return out.sort((a, b) => b.views - a.views).slice(0, 30);
}

async function cachedYt(query, { cacheDir, run, now = Date.now() }) {
  const file = cacheDir && join(cacheDir, 'references-cache.json');
  const key = `ytp2:${query.toLowerCase()}`;
  let cache = {};
  try { if (file && existsSync(file)) cache = JSON.parse(readFileSync(file, 'utf8')); } catch { cache = {}; }
  if (cache[key] && now - cache[key].at < YT_TTL) return cache[key].items;
  let items = [];
  try {
    // The global market in English (gl=US): local results skew to whatever is big in the viewer's own country.
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=US&hl=en`;
    items = parseYtLines(await run(['--flat-playlist', '--no-warnings', '--playlist-end', '30', '--print', '%(view_count)s\t%(duration)s\t%(id)s\t%(title)s', url]));
  } catch { return cache[key]?.items || []; }
  if (file) { try { const fresh = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; fresh[key] = { at: now, items }; mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(fresh)); } catch {} }
  return items;
}
export { fmtViews };
