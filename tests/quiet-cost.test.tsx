import { describe, expect, test } from 'claude-code/testing'

import { costOf, count, describe as spell, distance, dollars, effortName, elapsed, freshOf, fullOrder, lineSvg, modelName, spansOf, speedOf, tokensOf } from '../hooks/register'

const USAGE = (input: number, output: number, read = 0, write = 0) => ({
  model: 'claude-opus-5-5',
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: write,
})

// Stands for the engine beneath the mod: a session whose cost moves as `figures` says.
function engine(on: any) {
  const figures = { usages: [] as any[], toolUses: [] as any[], usd: 1 }
  const store = new Map<string, unknown>()
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }))
  on('store.get', (_$: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', (_$: any, e: any) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_$: any, e: any) => (store.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('session.id', () => ({ value: 'me' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 1e6 }, rateLimits: [], cost: { usd: figures.usd } },
  }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$: any, e: any) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: figures.toolUses.splice(0), stopReason: 'end_turn', usage: figures.usages.shift() ?? null }
  })
  on('turn.complete', (_$: any, e: any) => ({ text: e.answer }))
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Box({}))
  return { figures, store }
}

async function step($: any, figures: any, usage: any, agentId?: string) {
  figures.usages.push(usage)
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', effort: 'xhigh', messageCount: 1, ...(agentId ? { agentId } : {}) })
  for await (const _ of stream) {
  }
  return stream.result
}

const complete = ($: any, answer: string, agentId?: string) =>
  $.turn.complete({ answer, durationMs: 42_000, isAborted: false, turnId: 't', reason: 'answer', ...(agentId ? { agentId } : {}) })

async function lineUnder($: any, text: string, surface = 'terminal') {
  const row = await $.ui.mount({ plugin: 'quiet-cost', surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } } as any)
  const texts = (await row.findAll({ type: 'Text' })).map((t: any) => t.text)
  const svgs = (await row.findAll({ type: 'Svg' })).map((s: any) => s.props.alt)
  await row.unmount()
  return surface === 'terminal' ? texts.join('') : svgs.join('')
}

describe('quiet-cost', () => {
  test('helpers', () => {
    expect(dollars(0.001)).toBe('$0.01')
    expect(dollars(0.4249)).toBe('$0.42')
    expect(dollars(12.44)).toBe('$12.4')
    expect(count(840)).toBe('840')
    expect(count(12_400)).toBe('12.4k')
    expect(count(186_200)).toBe('186k')
    expect(count(1_000_000)).toBe('1M')
    expect(distance(0.004)).toBe('4 mm')
    expect(distance(0.042)).toBe('4.2 cm')
    expect(distance(0.09)).toBe('9 cm')
    expect(distance(6.3)).toBe('6.3 m')
    expect(distance(27_540)).toBe('28 km')
    expect(distance(1_240_000)).toBe('1,240 km')
    expect(elapsed(300)).toBe('1s')
    expect(elapsed(40_000)).toBe('40s')
    expect(elapsed(90_000)).toBe('1m 30s')
    expect(elapsed(120_000)).toBe('2m')
    expect(elapsed(9_000_000 + 20_000)).toBe('2h 30m')
    expect(elapsed(7_200_000)).toBe('2h')
    expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(modelName('claude-opus-5[1m]')).toBe('Opus 5')
    expect(modelName('gpt-x')).toBe('gpt-x')
    expect(effortName('xhigh')).toBe('X High')
    expect(effortName(3)).toBe('3')
    expect(speedOf({ durationMs: 10_000, output: 840 } as any)).toBe(84)
    expect(speedOf({ durationMs: 0, output: 840 } as any)).toBeUndefined()
    // A kept order meets figures added since: each joins after its neighbour in the default order.
    expect(fullOrder(['tokens', 'usd', 'time', 'five_hour', 'gone'])).toEqual([
      'model', 'effort', 'tokens', 'full', 'tools', 'edits', 'agents', 'snail', 'usd', 'session', 'time', 'speed',
    ])
    expect(tokensOf(USAGE(10, 20, 300, 4))).toBe(334)
    expect(tokensOf(null)).toBe(0)
    expect(freshOf(USAGE(10, 20, 300, 4))).toBe(34) // the cache's rereading left out
  })

  test('a reply costs what the session spent while it was written', () => {
    const cost = costOf({ usd: 1, tokens: 5000, model: 'claude-fable-5-1' }, 1.42, 90_000)
    expect(Math.abs((cost.usd ?? 0) - 0.42) < 1e-9).toBe(true)
    expect(cost.tokens).toBe(5000)
    expect(spansOf(cost, ['model'])).toEqual([{ text: 'Fable 5.1' }])
    // For fun: a snail crawls 1 mm a second.
    expect(spansOf(cost, ['snail'])).toEqual([{ text: 'snail 9 cm' }])
    expect(spansOf(cost, ['edits', 'agents'])).toEqual([{ text: '0 agents' }])
    expect(spansOf({ ...cost, fresh: 620, tokens: 474_000 }, ['tokens', 'full'])).toEqual([{ text: '620 tokens · 474k full tokens' }]) // no edit says nothing, no subagent says 0
    expect(costOf({ usd: null, tokens: 1 }, 2).usd).toBeNull()
  })

  test('the line stays grey, whatever the price', () => {
    const calm = spansOf({ model: null, sessionUsd: 3, tools: 0, usd: 0.42, durationMs: 90_000, tokens: 186_200 })
    expect(calm).toEqual([{ text: '$0.42 · 1m 30s · 186k tokens' }])
    expect(spansOf({ model: null, sessionUsd: 9, tools: 0, usd: 6, durationMs: 0, tokens: 10 })).toEqual([{ text: '$6.00 · 10 tokens' }])
    expect(lineSvg([{ text: '<$0.01 · 5 tokens' }])).toContain('&lt;$0.01')
    expect(spell({ model: null, sessionUsd: 3, tools: 0, usd: 0.42, durationMs: 40_000, tokens: 1234 }, ['usd', 'time', 'tokens', 'snail'])).toBe(
      'This reply cost about $0.42 at list price, 40s of work, 1,234 new tokens, a snail crawling 4 cm',
    )
  })

  test('each reply is signed with what it cost, subagents included', async ($, on) => {
    const { figures } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await $.turn.start({ text: 'hi', turnId: 't' })
    await step($, figures, USAGE(1000, 500, 100_000, 0))
    await step($, figures, USAGE(200, 100, 0, 0), 'a1') // a subagent's request counts toward the turn
    await complete($, 'sub report', 'a1') // its run ending does not close the turn
    figures.usd = 1.42
    await complete($, 'All done.')
    // 1,800 tokens read anew and written; 101,800 with the conversation read again from the cache.
    expect(await lineUnder($, 'All done.')).toBe('$0.42 · 42s · 1.8k tokens')
    expect(await lineUnder($, 'sub report')).toBe('')
    expect(await lineUnder($, 'All done.', 'desktop')).toBe('This reply cost about $0.42 at list price, 42s of work, 1,800 new tokens')
  })

  test('the row sets the line of the replies that follow', async ($, on) => {
    const { store, figures } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    let n = 0
    // One more reply, its line as the row is set now.
    const reply = async (usage = USAGE(10, 10)) => {
      const text = `Reply ${++n}.`
      await $.turn.start({ text: 'hi', turnId: `t${n}` })
      await step($, figures, usage)
      figures.usd += 0.2
      await complete($, text)
      return lineUnder($, text)
    }
    expect(await reply()).toBe('$0.20 · 42s · 20 tokens')
    const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } }
    const hidden = await $.ui.mount({ plugin: 'quiet-cost', surface: 'terminal', ...BAND } as any)
    expect(await hidden.find({ key: 'tokens' })).toBeUndefined() // the row waits for the command
    await hidden.unmount()
    await $.command.run({ command: 'quiet-cost', args: '' } as any)
    const row = await $.ui.mount({ plugin: 'quiet-cost', surface: 'terminal', ...BAND } as any)
    expect((await row.find({ key: 'tokens' }))?.props.dimColor).toBe(false)
    await row.press({ key: 'tokens' })
    await row.press({ key: 'usd' })
    await row.press({ key: 'session' })
    await row.press({ key: 'tools' })
    expect((await row.find({ key: 'tokens' }))?.props.dimColor).toBe(true)
    expect(await lineUnder($, 'Reply 1.')).toBe('$0.20 · 42s · 20 tokens') // a reply already written keeps its line
    const withTools = { ...USAGE(10, 10) }
    figures.toolUses = [{ name: 'Edit', input: {} }, { name: 'Agent', input: {} }]
    expect(await reply(withTools)).toBe('session $1.40 · 42s · 2 tools')
    expect(store.get('fields')).toEqual(['session', 'time', 'tools'])
    await row.press({ key: 'edits' })
    await row.press({ key: 'agents' })
    await row.press({ key: 'speed' })
    figures.toolUses = [{ name: 'Write', input: {} }, { name: 'Agent', input: {} }, { name: 'Read', input: {} }]
    expect(await reply(USAGE(10, 840))).toBe('session $1.60 · 42s · 20 tok/s · 3 tools · 1 edit · 1 agent')
    await row.press({ key: 'edits' })
    await row.press({ key: 'agents' })
    await row.press({ key: 'speed' })
    await row.press({ key: 'model' })
    await row.press({ key: 'effort' })
    expect(await reply()).toBe('Opus 5.5 · X High · session $1.80 · 42s') // no tool call: the figure says nothing
    await row.press({ key: 'effort' })
    await row.press({ key: 'power' }) // the line off: no line under the next replies, the choice kept
    expect(await reply()).toBe('')
    expect(store.get('isOn')).toBe(false)
    expect((await row.find({ key: 'time' }))?.props.dimColor).toBe(true)
    expect(await lineUnder($, 'Reply 4.')).toBe('Opus 5.5 · X High · session $1.80 · 42s')
    await row.press({ key: 'power' })
    expect(await reply()).toBe('Opus 5.5 · session $2.20 · 42s')
    await row.press({ key: 'close' })
    await row.unmount()
    const closed = await $.ui.mount({ plugin: 'quiet-cost', surface: 'desktop', ...BAND } as any)
    expect(await closed.find({ key: 'time' })).toBeUndefined()
    await closed.unmount()
  })

  test('a new session keeps what the line shows', async ($, on) => {
    const { store, figures } = engine(on)
    store.set('fields', ['seven_day', 'usd', 'snail'])
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await $.turn.start({ text: 'hi', turnId: 't' })
    figures.usd = 1.5
    await complete($, 'Hi.')
    expect(await lineUnder($, 'Hi.')).toBe('$0.50 · snail 4.2 cm') // a figure since removed is dropped
  })

  test('the row on the desktop', async ($, on) => {
    const { store } = engine(on)
    await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' } as any)
    await $.command.run({ command: 'quiet-cost', args: '' } as any)
    const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } }
    const row = await $.ui.mount({ plugin: 'quiet-cost', surface: 'desktop', ...BAND } as any)
    // Each picture's tooltip, shortened to what it names and its state: 'Dollars, on'.
    const alts = async () =>
      (await row.findAll({ type: 'Svg' })).map((b: any) => {
        const alt = String(b.props.alt)
        if (alt.startsWith('The cost line')) return alt.includes('is on') ? 'On, on' : 'Off, off'
        if (alt.startsWith('The figures')) return 'Data'
        const m = /^([^.]+)\. .* Example "/.exec(alt)
        return m ? `${m[1]}, ${String(b.props.source).includes('<rect') ? 'on' : 'off'}` : alt
      })
      .filter((a: string) => a !== '' && !a.startsWith('Move') && a !== 'About' && a !== 'Close')
    expect(await alts()).toEqual(['Cost', 'On, on', 'Data', 'Model, off', 'Effort, off', 'Dollars, on', 'Session, off', 'Time, on', 'Speed, off', 'Tokens, on', 'Full tokens, off', 'Tools, off', 'Edits, off', 'Agents, off', 'Snail, off'])
    const tips = (await row.findAll({ type: 'Svg' })).map((x: any) => String(x.props.alt))
    expect(tips).toContain(`Dollars. What the reply would cost at the API's list price. Example "$0.42"`)
    // The tooltip shown on hover: what it is, and an example.
    expect(await row.find({ type: 'Text', text: `What the reply would cost at the API's list price. Example "$0.42"` })).toBeDefined()
    await row.press({ key: 'snail' })
    expect(await alts()).toContain('Snail, on')
    // Hovering a figure shows its arrows: › moves it right, ‹ left; the first has no ‹, the last no ›.
    expect(await row.find({ key: 'model-left' })).toBeUndefined()
    expect(await row.find({ key: 'snail-right' })).toBeUndefined()
    await row.press({ key: 'model-right' })
    await row.press({ key: 'tokens-left' })
    expect((await alts()).slice(3, 9)).toEqual(['Effort, off', 'Model, off', 'Dollars, on', 'Session, off', 'Time, on', 'Tokens, on'])
    expect(store.get('order')).toEqual([
      'effort', 'model', 'usd', 'session', 'time', 'tokens', 'speed', 'full', 'tools', 'edits', 'agents', 'snail',
    ])
    await row.press({ key: 'power' })
    expect(await alts()).toContain('Off, off')
    await row.unmount()
  })
})
