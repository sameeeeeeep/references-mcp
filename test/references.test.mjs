import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReferences, guessMedium, loadLibrary } from '../src/references.mjs';
import { CATALOG, MEDIA } from '../src/catalog.mjs';
import { SOURCES, parseRss, parseAdsOfTheWorld, fetchLive } from '../src/sources.mjs';

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

    const refs = createReferences({ dir, fetchImpl });
    const out = await refs.suggest({ intent: 'a bold ad campaign' });
    assert.equal(out.medium, 'ad');
    const pickMe = out.fresh[0].items[0];
    assert.equal(pickMe.title, 'Moldy · Burger King');
    assert.equal(pickMe.untrusted, true);
    assert.match(pickMe.take, /^Current pick from Ads of the World/, 'take is never third-party text');
    assert.ok(out.curations.some((c) => c.name.startsWith('Cannes Lions')));
    assert.equal(refs.pick({ id: pickMe.id, note: 'this energy' }).build.url, 'https://www.adsoftheworld.com/campaigns/moldy');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
