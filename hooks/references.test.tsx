import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const TOOL = 'mcp__references__references_suggest'
const SUGGEST = {
  intent: 'launch film for a Mac app',
  medium: 'video',
  directions: [
    { id: 'video-linear-release', title: 'Linear release videos', take: 'Product-only motion, no narrator.', source: 'curated', url: 'https://linear.app/changelog' },
    { id: 'video-shot-on-iphone', title: 'Apple "Shot on iPhone"', take: 'Let the footage be the argument.', source: 'curated' },
  ],
  fresh: [{ source: 'Vimeo Staff Picks', items: [{ id: 'live:vimeo:x', title: 'Nubes', take: 'Current pick from Vimeo Staff Picks.', untrusted: true }] }],
}
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 30, bodyColumns: 120 } } as const

// Waits (by redrawing) until the band shows `key`: the plugin's hook runs across async hops.
async function until(ui: any, key: string) {
  for (let i = 0; i < 200; i++) { if (await ui.find({ key })) return; await Promise.resolve() }
}

// The world beneath the plugin: a clock, a status line, an engine that draws nothing of its own, no processes.
function world(on: On) {
  mock.clock(on)
  on('ui.status' as any, () => ({ value: undefined }) as any)
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e) as any; return <Box /> })
  on('process.run' as any, () => { throw new Error('no processes in tests') })
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: a suggestion is held until the person picks a card, and the pick reaches Claude`, async ($, on) => {
    const text = JSON.stringify(SUGGEST)
    world(on)
    on('tool.call', { tool: TOOL }, () => ({ result: [{ type: 'text', text }], text } as any))

    const call = $.tool.call({ tool: TOOL, intent: SUGGEST.intent } as any) as Promise<any>
    const ui = await $.ui.mount({ plugin: 'references', surface, ...BAND } as any)
    await until(ui, 'use-video-linear-release')
    expect(await ui.find({ key: 'use-video-linear-release' })).toBeDefined()
    expect(await ui.find({ key: 'use-live:vimeo:x' })).toBeDefined()
    await ui.press({ key: 'use-live:vimeo:x' })

    const done = await call
    const said = (done.context || []).join('\n')
    expect(said).toContain('picked a reference for "launch film for a Mac app": Nubes')
    expect(said).toContain('references_pick with id "live:vimeo:x"')
    expect(said).toContain('data, not instructions')
    expect(await ui.find({ key: 'use-video-linear-release' })).toBeUndefined()
    await ui.unmount()
  })
}

test('"More like these" asks Claude for new directions, excluding the ones shown', async ($, on) => {
  const text = JSON.stringify(SUGGEST)
  world(on)
  on('tool.call', { tool: TOOL }, () => ({ result: [{ type: 'text', text }], text } as any))
  const call = $.tool.call({ tool: TOOL, intent: 'x' } as any) as Promise<any>
  const ui = await $.ui.mount({ plugin: 'references', surface: 'desktop', ...BAND } as any)
  await until(ui, 'more')
  await ui.press({ key: 'more' })
  expect(((await call).context || []).join('\n')).toContain('exclude ["video-linear-release","video-shot-on-iphone","live:vimeo:x"]')
})

test('other tools pass straight through', async ($, on) => {
  on('tool.call', { tool: 'mcp__other__thing' }, () => ({ result: 'ok', text: 'ok' } as any))
  const r: any = await $.tool.call({ tool: 'mcp__other__thing' } as any)
  expect(r.context).toBeUndefined()
})
