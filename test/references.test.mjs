import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReferences, guessMedium, loadLibrary } from '../src/references.mjs';
import { CATALOG, MEDIA } from '../src/catalog.mjs';
import { SOURCES, isPublicHttpsUrl, isPrivateAddress, pinnedLookup, safeFetch, parseImages, parseRss, parseAdsOfTheWorld, parseAtom, parseGitHubTrending, parseYtLines, searchYouTube, fetchLive } from '../src/sources.mjs';

test('catalog covers every medium with unique ids and a take', () => {
  for (const m of MEDIA) assert.ok(CATALOG.filter((r) => r.medium === m).length >= 3, `${m} has at least 3`);
  assert.equal(new Set(CATALOG.map((r) => r.id)).size, CATALOG.length);
  for (const r of CATALOG) assert.ok(r.take && r.url && r.tags.length, r.id);
});

test('medium is inferred from intent words', () => {
  assert.equal(guessMedium('a pitch deck for investors'), 'deck');
  assert.equal(guessMedium('launch reel for Brandbrain'), 'video');
  assert.equal(guessMedium('LinkedIn post about our launch'), 'post');
  assert.equal(guessMedium('new homepage hero'), 'landing');
  assert.equal(guessMedium('something nice'), null);
});

test('suggest → pick → taste biases later suggestions; own library ranks first', async () => {
  const vault = mkdtempSync(join(tmpdir(), 'sb-refs-'));
  try {
    const refs = createReferences({ dir: vault, live: false });
    const deck = (await refs.suggest({ intent: 'keynote style launch deck' }));
    assert.equal(deck.medium, 'deck');
    assert.ok(deck.directions.every((d) => d.medium === 'deck'));
    assert.equal(deck.directions[0].id, 'deck-jobs-iphone');

    const spread = (await refs.suggest({ intent: 'something nice', count: 5 }));
    assert.equal(new Set(spread.directions.map((d) => d.medium)).size, 5, 'no medium → range across media');

    const more = (await refs.suggest({ intent: 'launch deck', exclude: deck.directions.map((d) => d.id) }));
    assert.ok(more.directions.every((d) => !deck.directions.some((x) => x.id === d.id)));

    // Taste: picking playful/gamified twice pushes Duolingo up for a neutral app intent.
    refs.pick({ id: 'app-duolingo', intent: 'habit app' });
    refs.pick({ id: 'app-duolingo', intent: 'habit app', note: 'more like this' });
    assert.equal((await refs.suggest({ intent: 'mobile app', medium: 'app' })).directions[0].id, 'app-duolingo');
    assert.equal(readFileSync(join(vault, 'taste.jsonl'), 'utf8').trim().split('\n').length, 2);

    // add() writes a vault ref that outranks curated ones.
    const shot = join(vault, 'shot.png'); writeFileSync(shot, 'png');
    const added = refs.add({ medium: 'landing', title: 'Our old hero', take: 'Lime on black, Doto headline', url: 'https://example.com', tags: ['lime'], image: shot, topic: 'brand' });
    assert.ok(existsSync(join(vault, 'brand', 'ref-1.png')));
    const top = (await refs.suggest({ intent: 'landing page hero' })).directions[0];
    assert.equal(top.id, added.id);
    assert.equal(top.source, 'mine');
    assert.ok(top.image.endsWith('ref-1.png'));
    assert.throws(() => refs.add({ medium: 'nope', title: 'x', take: 'y' }), /medium must be/);
    assert.throws(() => refs.get({ id: 'missing' }), /No reference/);
  } finally { rmSync(vault, { recursive: true, force: true }); }
});

test('plain folders (note.md + one image, no frontmatter) load', () => {
  const vault = mkdtempSync(join(tmpdir(), 'sb-refs-'));
  try {
    const dir = join(vault, 'squad'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'note.md'), '# Squad\nTake the warm operator-desk vibe. https://squad.so\n');
    writeFileSync(join(dir, 'hero.png'), 'png');
    const [r] = loadLibrary(vault);
    assert.equal(r.id, 'mine:squad/note');
    assert.equal(r.url, 'https://squad.so');
    assert.ok(r.image.endsWith('hero.png'));
    assert.match(r.take, /operator-desk/);
  } finally { rmSync(vault, { recursive: true, force: true }); }
});

test('every medium has curations to go deeper; live adapters parse real-shaped markup', () => {
  for (const m of MEDIA) assert.ok(SOURCES.some((s) => s.media.includes(m)), `${m} has a curation`);
  const rss = '<rss><item><title><![CDATA[Website Inspiration: Kizupi]]></title><link>https://onepagelove.com/kizupi</link><description>Calm &amp; warm</description><media:thumbnail url="https://x/a.jpg"/></item></rss>';
  assert.deepEqual(parseRss(rss, { strip: /^Website Inspiration:\s*/ }), [{ title: 'Kizupi', url: 'https://onepagelove.com/kizupi', image: 'https://x/a.jpg', note: 'Calm & warm' }]);
  const aotw = `<a href="/campaigns/better-protected"><picture><source srcset='x'><img alt="Better protected" width="544" src="https://image.adsoftheworld.com/zct" /></picture></a></div><div class='t'><a href="/campaigns/better-protected">KPN</a>`;
  assert.deepEqual(parseAdsOfTheWorld(aotw), [{ title: 'Better protected', url: 'https://www.adsoftheworld.com/campaigns/better-protected', image: 'https://image.adsoftheworld.com/zct', by: 'KPN' }]);
});

test('live picks are cached, fail soft, and can be picked like any reference', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sb-refs-live-'));
  try {
    let calls = 0;
    const page = `<a href="/campaigns/moldy"><picture><img alt="Moldy" src="https://img/m.jpg" /></picture></a><a href="/campaigns/moldy">Burger King</a>`;
    const fetchImpl = async () => { calls++; return { ok: true, text: async () => page }; };
    const src = SOURCES.find((s) => s.id === 'adsoftheworld');
    assert.equal((await fetchLive(src, { cacheDir: dir, fetchImpl }))[0].by, 'Burger King');
    await fetchLive(src, { cacheDir: dir, fetchImpl });
    assert.equal(calls, 1, 'second call served from cache');
    const dead = async () => { throw new Error('offline'); };
    assert.equal((await fetchLive(src, { cacheDir: dir, fetchImpl: dead, now: Date.now() + 13 * 3600_000 }))[0].title, 'Moldy', 'stale cache beats nothing');

    const youtube = async () => [{ title: 'Big ad', url: 'https://www.youtube.com/watch?v=abcdefghijk', image: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg', by: '2M views' }];
    const refs = createReferences({ dir, fetchImpl, youtube });
    const out = await refs.suggest({ intent: 'a bold ad campaign' });
    assert.equal(out.medium, 'ad');
    assert.equal(out.fresh[0].source, 'YouTube · most viewed', 'most-watched comes first for video-like media');
    assert.equal(out.fresh[0].items[0].title, 'Big ad · 2M views');
    const pickMe = out.fresh.find((f) => f.source === 'Ads of the World').items[0];
    assert.equal(pickMe.title, 'Moldy · Burger King');
    assert.equal(pickMe.untrusted, true);
    assert.match(pickMe.take, /^Current pick from Ads of the World/, 'take is never third-party text');
    assert.ok(out.curations.some((c) => c.name.startsWith('Cannes Lions')));
    assert.equal(refs.pick({ id: pickMe.id, note: 'this energy' }).build.url, 'https://www.adsoftheworld.com/campaigns/moldy');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('viral-project feeds and YouTube search parse; YouTube ranks by views and drops long streams', async () => {
  const atom = '<feed><entry><link rel="alternate" type="text/html" href="https://www.producthunt.com/products/x"/><title>Lookout</title><content type="html">&lt;p&gt;Urgent Slack messages.&lt;/p&gt; &lt;p&gt;Discussion | Link&lt;/p&gt;</content></entry></feed>';
  assert.deepEqual(parseAtom(atom), [{ title: 'Lookout', url: 'https://www.producthunt.com/products/x', note: 'Urgent Slack messages.' }]);
  const gh = '<article class="Box-row"><h2 class="h3"><a href="/a/b">a / b</a></h2><p class="col-9">A thing.</p><span>1,234 stars today</span></article>';
  assert.deepEqual(parseGitHubTrending(gh), [{ title: 'a/b', url: 'https://github.com/a/b', image: 'https://opengraph.githubassets.com/1/a/b', by: '★ 1,234 today', note: 'A thing.' }]);
  const lines = ['100\t30\tAAAAAAAAAAA\tsmall launch film', '5000000\t45\tBBBBBBBBBBB\tbig launch film', '9000000\t7200\tCCCCCCCCCCC\tstream launch',
    '8000000\t60\tDDDDDDDDDDD\tmovie trailer reaction', 'NA\tNA\tbad\tx'].join('\n');
  assert.equal(parseYtLines(lines).length, 4);
  const items = await searchYouTube('launch film', 'video', { run: async () => lines });
  assert.deepEqual(items.map((x) => x.title + ' · ' + x.by), ['big launch film · 5M views', 'small launch film · 100 views'], 'off-craft titles (the trailer) drop out');
  assert.deepEqual(await searchYouTube('x', 'video', { run: async () => { throw new Error('no yt-dlp'); } }), []);
});

test('gallery: og image first, then the page own work; chrome, icons, size variants and other posts dropped', () => {
  const html = `<meta property="og:image" content="https://i0.wp.com/m.com/wp-content/uploads/2026/10/cover.jpg">
    <img src="/logo.png"><img src="https://x.com/icon-32.png" width="32">
    <img src="https://i0.wp.com/m.com/wp-content/uploads/2026/10/still-1.jpg">
    <img src="https://i0.wp.com/m.com/wp-content/uploads/2024/02/other-post.jpg">
    <img srcset="https://i0.wp.com/m.com/wp-content/uploads/2026/10/still-2-1x.jpg 1x, https://i0.wp.com/m.com/wp-content/uploads/2026/10/still-2-2x.jpg 2x">
    <img src="https://i0.wp.com/m.com/wp-content/uploads/2026/10/still-2-1x.jpg">`;
  assert.deepEqual(parseImages(html, 'https://m.com/post'), [
    'https://i0.wp.com/m.com/wp-content/uploads/2026/10/cover.jpg',
    'https://i0.wp.com/m.com/wp-content/uploads/2026/10/still-1.jpg',
    'https://i0.wp.com/m.com/wp-content/uploads/2026/10/still-2-2x.jpg',
  ]);
});

test('third-party addresses never reach this machine or its network', async () => {
  for (const bad of ['http://example.com/a.jpg', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.1/x',
    'https://169.254.169.254/latest', 'https://[::1]/x', 'https://router.local/x', 'https://example.com:8443/x', 'https://u:p@example.com/x', 'https://intranet/x']) {
    assert.equal(isPublicHttpsUrl(bad), false, bad);
  }
  assert.equal(isPublicHttpsUrl('https://www.awwwards.com/sites/format'), true);
  // A public page that redirects inward is refused at the hop.
  const fetchImpl = async (u) => (u.includes('evil.example') ? { status: 302, headers: { get: () => 'https://192.168.0.1/admin' } } : { status: 200, headers: { get: () => null } });
  await assert.rejects(safeFetch('https://evil.example/page', {}, fetchImpl, async () => true), /refused/);
  // A hostname that resolves to a private address is refused before any request.
  let asked = false;
  await assert.rejects(safeFetch('https://rebind.example/x', {}, async () => { asked = true; return { status: 200 }; }, async () => false), /refused/);
  assert.equal(asked, false);
});

test('wrapped and encoded internal addresses are refused; the socket lookup itself refuses internal answers', async () => {
  for (const bad of ['https://[::ffff:127.0.0.1]/', 'https://[::ffff:a00:1]/', 'https://2130706433/', 'https://0x7f.0.0.1/',
    'https://[64:ff9b::a00:1]/', 'https://[::127.0.0.1]/', 'https://[fe80::1]/', 'https://[2002:7f00:1::]/']) {
    assert.equal(isPublicHttpsUrl(bad), false, bad);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700::1111'), false);
  const ask = (answers) => new Promise((res) => pinnedLookup(async () => answers)('x.example', {}, (err, addr) => res(err ? 'refused' : addr)));
  assert.equal(await ask([{ address: '93.184.216.34', family: 4 }]), '93.184.216.34');
  assert.equal(await ask([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]), 'refused');
  assert.equal(await ask([{ address: '::ffff:127.0.0.1', family: 6 }]), 'refused');
  assert.equal(await ask([]), 'refused');
});

test('every medium has a quiz; the first ask carries it, a styled ask does not', async () => {
  const { QUIZZES } = await import('../src/quiz.mjs');
  const { MEDIA } = await import('../src/catalog.mjs');
  for (const m of MEDIA) assert.ok(QUIZZES[m]?.length, `quiz for ${m}`);
  const { createReferences } = await import('../src/references.mjs');
  const refs = createReferences({ dir: join(tmpdir(), `refs-quiz-${process.pid}`), live: false });
  const first = await refs.suggest({ intent: 'landing page', medium: 'landing' });
  assert.equal(first.quiz.length, QUIZZES.landing.length);
  assert.ok(first.quiz[0].options.every((o) => o.label && o.tags.length && !('from' in o)));
  const styled = await refs.suggest({ intent: 'landing page', medium: 'landing', style: ['dark', 'glow'] });
  assert.equal(styled.quiz, undefined);
  assert.equal(styled.directions[0].id, 'landing-linear');
});
