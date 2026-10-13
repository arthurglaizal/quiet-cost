import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cost, Effort, Field } from '../types'

const COMMAND = 'quiet-cost'
// The design shared with the other Quiet mods: neutral greys; this line stays grey whatever the price.
const FONTS = "-apple-system, 'SF Pro Text', system-ui, sans-serif"
const LINE_FONT = 12 // as Quiet Model's signature, so the two lines read alike when stacked
const COLOR = '#6e6e73' // a step under the text grey, as the app's own context lines
const CHAR_WIDTH = 6.1 // a character's width at FONT, an estimate
const GAP = 10 // air above the line, so it reads apart from the reply
const PX_PER_COLUMN = 8.4
// The row above the prompt: a switch for the line, then the figures as toggles, as Quiet Model's options.
const FONT = 11
const TITLE_FONT = 13
const TEXT = '#8b8b90' // text and switches at rest
const ON = '#d6d6da' // a switch on: its name brighter, a step short of white
const MUTED = 0.45 // the figures while the line is off: still there, set aside
const ON_FONT = 12 // a shown figure's name, a pixel larger, as in Quiet Model
const CHIP = '#323439' // a shown figure's fill, a step above the ground
const CHIP_INSET = 3 // px each side: 6 px of air between two chips
const TRACK = { on: '#8b8b90', off: '#3a3c41' }
const KNOB = { on: '#e8e8ea', off: '#8b8b90' }
const SWITCH_WIDTH = 22
const SWITCH_GAP = 6 // between a switch and its name
const SPACING = 2 // cells after the line's switch
const DIVIDER = '#3a3c41'
const TIP = '#b9b9be' // a tooltip's text, on the app's dark card
const TIP_WIDTH = 44 // a tooltip's widest, in cells: a longer one wraps
const SWITCH_HEIGHT = 20
const APP_FONT = 13 // the app's text size: an em space is this wide
const BUTTON_PADDING = 16 // what a desktop button adds around its label, an estimate
const BAND_CONTROL = 4 // the terminal's own `[-]` at the end of the band's first row, and a space before it
// The title column as Quiet Token Bar draws its own, so the stacked rows start their content alike.
const TITLE_WIDTH = Math.round(('Context'.length * CHAR_WIDTH * (TITLE_FONT / FONT) + 14) * (FONT / TITLE_FONT))
const NOTE =
  'While on, a quiet line under each new reply sums up what it cost. Pick here the figures it shows and their order. Close this bar: the line stays on until you switch it off. /quiet-cost opens the bar again.'
const INFO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b8b90" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
const CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b8b90" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'

// What the line can show, in its order, as the row names each.
// Each with what its tooltip says it is, and what it reads like in the line.
export const FIELDS: readonly { key: Field; name: string; tip: string; example: string }[] = [
  { key: 'model', name: 'Model', tip: 'the model that wrote the reply', example: 'Opus 5.5' },
  { key: 'effort', name: 'Effort', tip: 'how hard the model was asked to think', example: 'High' },
  { key: 'usd', name: 'Dollars', tip: "what the reply would cost at the API's list price", example: '$0.42' },
  { key: 'session', name: 'Session', tip: 'what the whole session has cost so far', example: 'session $4.20' },
  { key: 'time', name: 'Time', tip: 'how long the reply took', example: '1m 30s' },
  { key: 'speed', name: 'Speed', tip: 'how fast the reply was written, in tokens per second', example: '84 tok/s' },
  { key: 'tokens', name: 'Tokens', tip: 'the tokens the reply read anew and wrote, subagents included', example: '620 tokens' },
  { key: 'full', name: 'Full tokens', tip: 'every token the reply counted, the whole conversation read again from the cache included', example: '474k full tokens' },
  { key: 'tools', name: 'Tools', tip: 'the tool calls the reply made', example: '12 tools' },
  { key: 'edits', name: 'Edits', tip: 'the file edits the reply made', example: '3 edits' },
  { key: 'agents', name: 'Agents', tip: 'the subagents the reply started', example: '2 agents' },
  { key: 'snail', name: 'Snail', tip: 'how far a snail would have crawled while the reply was written', example: 'snail 9 cm' },
]
// A snail's pace, in m/s.
const SNAIL_M_S = 0.001
// The tools that edit a file, and the one that starts a subagent ('Task' its older name).
const EDIT_TOOLS = ['Edit', 'Write', 'NotebookEdit']
const AGENT_TOOLS = ['Agent', 'Task']

// A figure's tooltip: what it is, and how it reads in the line, quoted.
export const chipTip = (f: (typeof FIELDS)[number]) => `${f.tip.charAt(0).toUpperCase()}${f.tip.slice(1)}. Example "${f.example}"`
export const powerTip = (isOn: boolean) =>
  isOn ? 'The cost line is on under new replies. Click to turn it off.' : 'The cost line is off. Click to turn it on under new replies.'
const DATA_TIP = 'The figures the line shows. Click one to show or hide it; the arrows under it move it.'
const ALL_FIELDS = FIELDS.map(f => f.key)
// A short line at first; the model is left out as Quiet Model already names it under each reply.
const DEFAULT_FIELDS: Field[] = ['usd', 'time', 'tokens']
const ARROW = { left: '\u2039', right: '\u203A' } // ‹ ›, to move a figure along the line

// Session values: the turn in progress, and the end of each recent reply with what it cost, kept as
// short tails so the reply drawn is found again. The text of a reply is not stored.
const running = atom({ plugin: 'quiet-cost', key: 'running' } as const, null)
const replies = atom({ plugin: 'quiet-cost', key: 'replies' } as const, [])
const isOn = atom({ plugin: 'quiet-cost', key: 'isOn' } as const, true)
const fields = atom({ plugin: 'quiet-cost', key: 'fields' } as const, DEFAULT_FIELDS)
const order = atom({ plugin: 'quiet-cost', key: 'order' } as const, ALL_FIELDS)
const isRowShown = atom({ plugin: 'quiet-cost', key: 'isRowShown' } as const, false)
const KEPT_REPLIES = 100
const TAIL = 160
// Whether a block drawn is the end of the reply whose tail is kept.
const isEndOf = (tail: string, shown: string) => (shown.length >= TAIL ? shown.slice(-TAIL) === tail : tail.endsWith(shown))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'Show or hide the row that picks what the cost line shows' })
    const picked = (await $.store.get('fields').catch(() => undefined)) as Field[] | undefined
    if (Array.isArray(picked)) await update($, fields, () => ALL_FIELDS.filter(f => picked.includes(f)))
    const keptOrder = (await $.store.get('order').catch(() => undefined)) as Field[] | undefined
    if (Array.isArray(keptOrder)) await update($, order, () => fullOrder(keptOrder))
    if ((await $.store.get('isOn').catch(() => undefined)) === false) await update($, isOn, () => false)
    // What earlier versions kept to estimate the limits, no longer used.
    for (const k of await $.store.keys().catch(() => [] as string[]))
      if (k === 'rates' || k === 'rates-v2' || k.startsWith('active:')) await $.store.delete(k).catch(() => {})
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    const shown = await update($, isRowShown, was => !was)
    return { text: shown ? 'Pick what the cost line shows, above the prompt' : `Cost row hidden. /${COMMAND} shows it again` }
  })

  // A turn of the main conversation begins: what the session had cost.
  on('turn.start', async ($, e, next) => {
    const usage = await $.session.usage().catch(() => undefined)
    const usd = usage?.cost?.usd ?? null
    await update($, running, () => ({ usd, tokens: 0, fresh: 0, tools: 0, edits: 0, agents: 0, output: 0, model: null, effort: null }))
    return next(e)
  })

  // Every request while it runs, its subagents' included, adds its tokens and tool calls; the main
  // conversation's name the model that writes the reply.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const n = tokensOf(result.usage)
    const fresh = freshOf(result.usage)
    const tools = result.toolUses.length + (result.serverToolUses?.length ?? 0)
    const edits = result.toolUses.filter(t => EDIT_TOOLS.includes(t.name)).length
    const agents = result.toolUses.filter(t => AGENT_TOOLS.includes(t.name)).length
    const output = result.usage?.output_tokens ?? 0
    const isMain = e.agentId === undefined
    const model = isMain ? result.usage?.model : undefined
    if (n > 0 || tools > 0 || model)
      await update($, running, r =>
        r
          ? {
              ...r,
              tokens: r.tokens + n,
              fresh: (r.fresh ?? 0) + fresh,
              tools: (r.tools ?? 0) + tools,
              edits: (r.edits ?? 0) + edits,
              agents: (r.agents ?? 0) + agents,
              output: (r.output ?? 0) + output,
              model: model ?? r.model,
              effort: isMain && result.usage ? (e.effort ?? null) : (r.effort ?? null),
            }
          : r,
      )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result // a subagent's run: its cost is its spawner's turn's
    const start = await read($, running)
    await update($, running, () => null)
    const text = e.answer.trim()
    if (!start || !text) return result
    const usage = await $.session.usage().catch(() => undefined)
    const usd = usage?.cost?.usd ?? null
    const cost = costOf(start, usd, e.durationMs)
    // The line as the row is set now: a later change applies to the replies that follow, not this one.
    const shown = (await read($, isOn)) ? lineFields(await read($, order), await read($, fields)) : []
    await update($, replies, r => [...r, { tail: text.slice(-TAIL), cost, shown }].slice(-KEPT_REPLIES))
    return result
  })

  // Under the reply's last block, small and dim: '$0.42 · 1m 30s · 620 tokens'.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    const text = e.props.text.trim()
    const reply = text ? [...(await read($, replies))].reverse().find(r => isEndOf(r.tail, text)) : undefined
    if (!reply) return drawn
    const shown = reply.shown ?? lineFields(await read($, order), await read($, fields))
    const parts = spansOf(reply.cost, shown)
    if (!parts.length) return drawn // nothing picked, or nothing known of what is
    const { Box, Text } = $.ui.resolve(e)
    const alt = describe(reply.cost, shown)
    const Svg = (e.surface === 'terminal' ? undefined : ($.ui.resolve(e) as any).Svg) as
      | ((props: { source: string; alt: string; width?: number; height?: number }) => any)
      | undefined
    if (!Svg) {
      return (
        <Box flexDirection="column">
          {drawn}
          <Box>
            {parts.map((p, i) =>
              p.color ? (
                <Text key={`p${i}`} color={p.color} bold>
                  {p.text}
                </Text>
              ) : (
                <Text key={`p${i}`} dimColor>
                  {p.text}
                </Text>
              ),
            )}
          </Box>
        </Box>
      )
    }
    // Given its size in pixels, or the app stretches the picture across the reply's width.
    const size = lineSize(parts)
    return (
      <Box flexDirection="column">
        {drawn}
        <Box width={Math.ceil(size.width / PX_PER_COLUMN)}>
          <Svg source={lineSvg(parts)} alt={alt} width={size.width} height={size.height} />
        </Box>
      </Box>
    )
  })

  // The row that picks what the line shows: hidden until /quiet-cost asks for it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e) // what other mods and Claude Code draw here stays
    if (e.props.hasSurvey || !(await read($, isRowShown))) return rest
    const { Box, Text, Button } = $.ui.resolve(e)
    const picked = await read($, fields)
    const sequence = await read($, order)
    const isLineOn = await read($, isOn)
    const Svg = (e.surface === 'terminal' ? undefined : ($.ui.resolve(e) as any).Svg) as
      | ((props: { source: string; alt: string; width?: number; height?: number }) => any)
      | undefined
    // The line's switch, in a box of fixed width so a click never moves the row: on the desktop a picture
    // under an empty button that spans it.
    const powerSwitch = () => {
      const name = isLineOn ? 'On' : 'Off'
      if (!Svg) {
        return (
          <Box marginRight={SPACING}>
            <Button key="power" plain dimColor={!isLineOn} label={`${isLineOn ? '●' : '○'} ${name}`} onPress={() => void power()} />
          </Box>
        )
      }
      const cols = switchColumns('Off')
      return (
        <Box key="power-box" width={cols} height={1} flexShrink={0} marginRight={SPACING} alignItems="center">
          <Svg source={switchSvg(name, isLineOn, cols * PX_PER_COLUMN)} alt={powerTip(isLineOn)} />
          <Box position="absolute" top={0} left={0} width={cols} height={1} justifyContent="center" alignItems="center">
            <Button key="power" plain label={cover(cols)} onPress={() => void power()} />
          </Box>
          {tooltip(powerTip(isLineOn))}
        </Box>
      )
    }
    // A tooltip: text only, on the app's dark card, under the arrows' line so it hides nothing of the row.
    const tooltip = (text: string) => (
      <Box position="absolute" top={2} left={0} width={Math.min(text.length + 2, TIP_WIDTH)} display="none" hover={{ display: 'flex' }}>
        <Text color={TIP}>{text}</Text>
      </Box>
    )
    // A figure as a toggle, as Quiet Model's options: its name on a chip when shown. Under it, a ‹ and a ›
    // move it along the line; the first has no ‹, the last no ›.
    type Move = { left?: () => unknown; right?: () => unknown }
    const chip = (c: { key: Field; name: string; tip: string; isOn: boolean; move: Move }) => {
      if (!Svg) {
        const arrow = (side: 'left' | 'right', press: (() => unknown) | undefined) =>
          press ? (
            <Button key={`${c.key}-${side}`} plain dimColor label={ARROW[side]} onPress={() => void press()} />
          ) : (
            <Text> </Text>
          )
        return (
          <Box key={`${c.key}-box`} flexDirection="column" alignItems="center">
            <Box backgroundColor={c.isOn && isLineOn ? CHIP : undefined}>
              <Button key={c.key} plain dimColor={!c.isOn || !isLineOn} label={` ${c.name} `} onPress={() => void pick($, c.key)} />
            </Box>
            <Box columnGap={1}>
              {arrow('left', c.move.left)}
              {arrow('right', c.move.right)}
            </Box>
          </Box>
        )
      }
      const cols = chipColumns(c.name)
      return (
        <Box key={`${c.key}-chip`} width={cols} height={1} flexShrink={0} justifyContent="center" alignItems="center">
          <Svg source={chipSvg(c.name, c.isOn, !isLineOn, cols * PX_PER_COLUMN)} alt={`${c.name}. ${c.tip}`} />
          <Box position="absolute" top={0} left={0} width={cols} height={1} justifyContent="center" alignItems="center">
            <Button key={c.key} plain label={cover(cols)} onPress={() => void pick($, c.key)} />
          </Box>
          {tooltip(c.tip)}
        </Box>
      )
    }
    // The ‹ and › under a figure on the desktop, in a box as wide as its chip.
    const arrows = (c: { key: Field; name: string; move: Move }) => {
      const cols = chipColumns(c.name)
      const arrow = (side: 'left' | 'right', press: (() => unknown) | undefined) => (
        <Box width={2} height={1} justifyContent="center" alignItems="center">
          {press && Svg && <Svg source={chevron(side)} alt={side === 'left' ? 'Move left' : 'Move right'} width={10} height={10} />}
          {press && (
            <Box position="absolute" top={0} left={0} width={2} height={1}>
              <Button key={`${c.key}-${side}`} plain label={'\u00A0\u00A0'} onPress={() => void press()} />
            </Box>
          )}
        </Box>
      )
      return (
        <Box key={`${c.key}-arrows`} width={cols} height={1} flexShrink={0} justifyContent="center">
          {arrow('left', c.move.left)}
          {arrow('right', c.move.right)}
        </Box>
      )
    }
    const power = async () => {
      const isNowOn = await update($, isOn, was => !was)
      await $.store.set('isOn', isNowOn).catch(() => {})
    }
    const iconButton = (b: { key: string; icon: string; alt: string; press: () => unknown }) =>
      Svg && (
        <Box width={2} height={1} justifyContent="center" alignItems="center">
          <Svg source={b.icon} alt={b.alt} width={12} height={12} />
          <Box position="absolute" top={0} left={0} width={2} height={1}>
            <Button key={b.key} plain label={'\u00A0\u00A0'} onPress={() => void b.press()} />
          </Box>
        </Box>
      )
    const close = () => update($, isRowShown, () => false)
    const figures = sequence.flatMap((key, i) => {
      const f = FIELDS.find(x => x.key === key)
      if (!f) return []
      const left = i > 0 ? () => move($, i, i - 1) : undefined
      const right = i < sequence.length - 1 ? () => move($, i, i + 1) : undefined
      return [{ key, name: f.name, tip: chipTip(f), isOn: picked.includes(key), move: { left, right } }]
    })
    const icons = Svg ? (
      <Box columnGap={1}>
        {/* The note on hover: text only, under the icon, right-aligned so it stays in the card. */}
        <Box key="info-box" width={2} height={1}>
          {iconButton({ key: 'info', icon: INFO, alt: 'About', press: () => undefined })}
          <Box position="absolute" top={1} right={0} width={NOTE.length + 2} display="none" hover={{ display: 'flex' }}>
            <Text color={TIP}>{NOTE}</Text>
          </Box>
        </Box>
        {iconButton({ key: 'close', icon: CLOSE, alt: 'Close', press: close })}
      </Box>
    ) : (
      <Box marginRight={BAND_CONTROL}>
        <Button key="close" plain dimColor label="×" onPress={() => void close()} />
      </Box>
    )
    if (!Svg) {
      return (
        <Box flexDirection="column">
          <Box alignItems="flex-start" paddingX={1}>
            <Text dimColor>Cost </Text>
            {powerSwitch()}
            <Text dimColor>│ data </Text>
            <Box flexWrap="wrap" flexShrink={1}>
              {figures.map(chip)}
            </Box>
            <Box flexGrow={1} />
            {icons}
          </Box>
          {rest}
        </Box>
      )
    }
    // On the desktop, two lines: the switches, then the arrows under each figure. The title is drawn
    // TOP_AIR taller than the line, its word at the bottom, and the line sits on its bottom: the air above
    // keeps the row apart from another mod's stacked over it. Everything before the figures is given whole
    // cells, so the arrows' line lines up under them.
    const titleCols = Math.ceil(TITLE_WIDTH / PX_PER_COLUMN)
    const dataCols = Math.ceil(dataWidth() / PX_PER_COLUMN)
    const lead = titleCols + switchColumns('Off') + SPACING + dataCols
    // The figures on two lines, half on each, so the row never has to squeeze them; each line has its
    // arrows under it, and the second starts where the first's figures do.
    const half = Math.ceil(figures.length / 2)
    const [first, second] = [figures.slice(0, half), figures.slice(half)]
    return (
      <Box flexDirection="column">
        <Box alignItems="flex-end" paddingX={1}>
          <Box width={titleCols} flexShrink={0}>
            <Svg source={titleSvg()} alt="Cost" />
          </Box>
          {powerSwitch()}
          <Box width={dataCols} height={1} flexShrink={0}>
            <Svg source={dataSvg()} alt={DATA_TIP} />
          </Box>
          {first.map(chip)}
          <Box flexGrow={1} />
          {icons}
        </Box>
        <Box paddingX={1}>
          <Box width={lead} height={1} flexShrink={0} />
          {first.map(arrows)}
        </Box>
        {second.length > 0 && (
          <Box paddingX={1}>
            <Box width={lead} height={1} flexShrink={0} />
            {second.map(chip)}
          </Box>
        )}
        {second.length > 0 && (
          <Box paddingX={1}>
            <Box width={lead} height={1} flexShrink={0} />
            {second.map(arrows)}
          </Box>
        )}
        {rest}
      </Box>
    )
  })
}

// Moves the figure at `from` to `to`, here and in the next sessions.
async function move($: EngineInterface, from: number, to: number) {
  const next = await update($, order, o => {
    const moved = [...o]
    const [key] = moved.splice(from, 1)
    if (key) moved.splice(to, 0, key)
    return moved
  })
  await $.store.set('order', next).catch(() => {})
}

// Every figure once, in a kept order; a figure the order does not know yet (added since) joins at its place
// in the default order.
export function fullOrder(kept: readonly string[]): Field[] {
  const known = kept.filter((k): k is Field => (ALL_FIELDS as string[]).includes(k))
  const out = [...new Set(known)]
  ALL_FIELDS.forEach((k, i) => {
    if (out.includes(k)) return
    const before = ALL_FIELDS.slice(0, i).reverse().find(b => out.includes(b))
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, k)
  })
  return out
}

// The figures the line shows, in its order.
export const lineFields = (sequence: readonly Field[], on: readonly Field[]) => sequence.filter(k => on.includes(k))

// Shows or hides one figure of the line, here and in the next sessions.
async function pick($: EngineInterface, key: Field) {
  const next = await update($, fields, f => ALL_FIELDS.filter(k => (k === key ? !f.includes(k) : f.includes(k))))
  await $.store.set('fields', next).catch(() => {})
}

// Every token a request counted: what it read fresh, from the cache and into it, and what it wrote.
export function tokensOf(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number } | null | undefined) {
  if (!u) return 0
  return u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
}

// The tokens a request read anew and wrote: all but the conversation read again from the cache, which
// grows with every reply whatever the reply does.
export function freshOf(u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number } | null | undefined) {
  if (!u) return 0
  return u.input_tokens + u.output_tokens + u.cache_creation_input_tokens
}

// What the turn cost: the session's cost now less what it was as the turn began, and what it counted.
export function costOf(
  start: {
    usd: number | null
    tokens: number
    fresh?: number
    tools?: number
    edits?: number
    agents?: number
    output?: number
    model?: string | null
    effort?: Effort | null
  },
  usd: number | null,
  durationMs = 0,
): Cost {
  const spent = usd !== null && start.usd !== null ? Math.max(0, usd - start.usd) : null
  return {
    model: start.model ?? null,
    effort: start.effort ?? null,
    usd: spent,
    sessionUsd: usd,
    tools: start.tools ?? 0,
    edits: start.edits ?? 0,
    agents: start.agents ?? 0,
    output: start.output ?? 0,
    durationMs,
    tokens: start.tokens,
    fresh: start.fresh ?? 0,
  }
}

// '$0.42', '$1.37', '$12.4'; the smallest reads '$0.01', which says how small it is.
export function dollars(usd: number) {
  return usd < 10 ? `$${Math.max(usd, 0.01).toFixed(2)}` : `$${usd.toFixed(1)}`
}

// 'Opus 5.5', 'Haiku 4.5', from 'claude-opus-5-5' or 'claude-haiku-4-5-20251001'; an id it cannot read, as is.
export function modelName(id: string) {
  const m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id)
  if (!m) return id
  const [, family = '', major, minor] = m
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}${minor ? `.${minor}` : ''}`
}

// 'Low', 'Medium', 'High', 'X High', 'Max', as the app's menu names them.
export function effortName(effort: Effort) {
  const names: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'X High', max: 'Max' }
  return typeof effort === 'number' ? String(effort) : (names[effort] ?? effort)
}

// '1 tool', '12 tools'.
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// The tokens written a second, over the reply's whole time; nothing when either is unknown.
export function speedOf(cost: Cost) {
  const seconds = cost.durationMs / 1000
  return cost.output && seconds > 0 ? Math.round(cost.output / seconds) : undefined
}

// '40s', '1m 30s', '2h 30m': the seconds go once it runs to hours.
export function elapsed(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60}m`
  const m = Math.round(s / 60)
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`
}

// '4.2 cm', '9 cm', '6 m', '13 km', '1,240 km': a length as one reads it.
export function distance(m: number) {
  const round = (n: number) => (n < 10 ? trim(n.toFixed(1)) : Math.round(n).toLocaleString('en-US'))
  if (m < 0.01) return `${trim((m * 1000).toFixed(1))} mm`
  if (m < 1) return `${round(m * 100)} cm`
  return m < 1000 ? `${round(m)} m` : `${round(m / 1000)} km`
}

// '840', '12.4k', '186k', '1.2M'.
export function count(n: number) {
  if (n < 1000) return String(n)
  if (n < 1e6) return n < 1e5 ? `${trim((n / 1e3).toFixed(1))}k` : `${Math.round(n / 1e3)}k`
  return `${trim((n / 1e6).toFixed(1))}M`
}
const trim = (s: string) => s.replace(/\.0$/, '')

export type Span = { text: string; color?: string }

// The line as spans, the figures shown in their order, all grey. A
// figure with nothing to say (no tool call, no edit) is left out; the subagents are counted even at zero.
export function spansOf(cost: Cost, shown: readonly Field[] = DEFAULT_FIELDS): Span[] {
  const groups = shown.flatMap((key): Span[][] => {
    switch (key) {
      case 'model':
        return cost.model ? [[{ text: modelName(cost.model) }]] : []
      case 'effort':
        return cost.effort != null ? [[{ text: effortName(cost.effort) }]] : []
      case 'usd':
        return cost.usd !== null ? [[{ text: dollars(cost.usd) }]] : []
      case 'session':
        return cost.sessionUsd != null ? [[{ text: `session ${dollars(cost.sessionUsd)}` }]] : []
      case 'time':
        return cost.durationMs > 0 ? [[{ text: elapsed(cost.durationMs) }]] : []
      case 'tokens':
        return [[{ text: `${count(cost.fresh ?? cost.tokens)} tokens` }]]
      case 'full':
        return [[{ text: `${count(cost.tokens)} full tokens` }]]
      case 'tools':
        return cost.tools > 0 ? [[{ text: plural(cost.tools, 'tool') }]] : []
      case 'speed': {
        const s = speedOf(cost)
        return s !== undefined ? [[{ text: `${s} tok/s` }]] : []
      }
      case 'edits':
        return cost.edits ? [[{ text: plural(cost.edits, 'edit') }]] : []
      case 'agents': // shown at zero too: no subagent is worth knowing
        return [[{ text: plural(cost.agents ?? 0, 'agent') }]]
      case 'snail':
        return cost.durationMs > 0 ? [[{ text: `snail ${distance((cost.durationMs / 1000) * SNAIL_M_S)}` }]] : []
      default:
        return []
    }
  })
  const spans: Span[] = []
  groups.forEach((g, i) => spans.push(...(i ? [{ text: ' · ' }] : []), ...g))
  // Neighbouring grey spans are one text: fewer elements to draw.
  return spans.reduce<Span[]>((out, s) => {
    const last = out.at(-1)
    if (last && !last.color && !s.color) last.text += s.text
    else out.push({ ...s })
    return out
  }, [])
}

// The line spelled out, for the picture's alternative text.
export function describe(cost: Cost, shown: readonly Field[] = DEFAULT_FIELDS) {
  const parts = shown.map(key => {
    switch (key) {
      case 'model':
        return cost.model ? `on ${modelName(cost.model)}` : null
      case 'effort':
        return cost.effort != null ? `at ${effortName(cost.effort)} effort` : null
      case 'usd':
        return cost.usd !== null ? `about ${dollars(cost.usd)} at list price` : null
      case 'session':
        return cost.sessionUsd != null ? `the session at ${dollars(cost.sessionUsd)} so far` : null
      case 'time':
        return cost.durationMs > 0 ? `${elapsed(cost.durationMs)} of work` : null
      case 'tokens':
        return `${(cost.fresh ?? cost.tokens).toLocaleString('en-US')} new tokens`
      case 'full':
        return `${cost.tokens.toLocaleString('en-US')} tokens in all`
      case 'tools':
        return cost.tools > 0 ? plural(cost.tools, 'tool call') : null
      case 'speed': {
        const s = speedOf(cost)
        return s !== undefined ? `${s} tokens a second` : null
      }
      case 'edits':
        return cost.edits ? plural(cost.edits, 'file edit') : null
      case 'agents':
        return plural(cost.agents ?? 0, 'subagent')
      case 'snail':
        return cost.durationMs > 0 ? `a snail crawling ${distance((cost.durationMs / 1000) * SNAIL_M_S)}` : null
      default:
        return null
    }
  })
  return `This reply cost ${parts.filter(Boolean).join(', ')}`
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export const lineSize = (spans: Span[]) => ({
  width: Math.ceil(spans.reduce((w, s) => w + s.text.length * CHAR_WIDTH * (LINE_FONT / FONT) * (s.color ? 1.06 : 1), 0)) + 4,
  height: GAP + 16,
})

// The line as a picture: 12 px, dim grey, a colored figure in 600.
export function lineSvg(spans: Span[]) {
  const { width, height } = lineSize(spans)
  const tspans = spans
    .map(s => `<tspan fill="${s.color ?? COLOR}"${s.color ? ' font-weight="600"' : ''}>${escape(s.text)}</tspan>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONTS}" font-size="${LINE_FONT}"><text x="0" y="${GAP + 12}" xml:space="preserve">${tspans}</text></svg>`
}

// The columns the line's switch takes on the desktop: the switch, its name and a little air.
export const switchColumns = (name: string) =>
  Math.ceil((SWITCH_WIDTH + SWITCH_GAP + name.length * CHAR_WIDTH + 4) / PX_PER_COLUMN)

// The columns a figure's chip takes on the desktop: its name and 8 px each side, rounded up to whole cells.
// At least 4: the two arrows under it.
export const chipColumns = (name: string) => Math.max(4, Math.ceil((name.length * CHAR_WIDTH + 16) / PX_PER_COLUMN))

// The arrows under a figure, as the row's other icons are drawn, a size smaller and dimmer.
export const chevron = (side: 'left' | 'right') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${side === 'left' ? 'm15 6l-6 6l6 6' : 'm9 6l6 6l-6 6'}"/></svg>`

const svgOpen = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONTS}" font-size="${FONT}">`

// The line's switch and its name: on, a light knob to the right of a lit track and the name brighter;
// off, the knob to the left of a dark track.
export function switchSvg(name: string, isOn: boolean, width: number) {
  const w = Math.round(width)
  const h = SWITCH_HEIGHT
  const state = isOn ? 'on' : 'off'
  return `${svgOpen(w, h)}<rect x="0" y="${h / 2 - 6}" width="${SWITCH_WIDTH}" height="12" rx="6" fill="${TRACK[state]}"/><circle cx="${isOn ? SWITCH_WIDTH - 6 : 6}" cy="${h / 2}" r="4" fill="${KNOB[state]}"/><text x="${SWITCH_WIDTH + SWITCH_GAP}" y="${h / 2 + 4}" fill="${isOn ? ON : TEXT}">${name}</text></svg>`
}

// The air above the row, in px.
const TOP_AIR = 12

// The subtitle of the figures, drawn as Quiet Token Bar's '│ limit': the bar, 10 px, the word.
export const dataWidth = () => Math.ceil('│data'.length * CHAR_WIDTH + 10 + 10)
export function dataSvg() {
  const w = dataWidth()
  return `${svgOpen(w, SWITCH_HEIGHT)}<text x="0" y="${SWITCH_HEIGHT / 2 + 4}" fill="${TEXT}" xml:space="preserve"><tspan>│</tspan><tspan dx="10">data</tspan></text></svg>`
}

// A figure's name at 11 px, centered in its box; shown, brighter on a chip, inset so two chips side by
// side keep a little air between them. Muted while the line is off.
export function chipSvg(name: string, isOn: boolean, isMuted: boolean, width: number) {
  const w = Math.round(width)
  const h = SWITCH_HEIGHT
  const chip = isOn ? `<rect x="${CHIP_INSET}" y="0" width="${w - 2 * CHIP_INSET}" height="${h}" rx="4" fill="${CHIP}"/>` : ''
  return `${svgOpen(w, h)}<g${isMuted ? ` opacity="${MUTED}"` : ''}>${chip}<text x="${w / 2}" y="${h / 2 + 4}" text-anchor="middle" fill="${isOn ? ON : TEXT}"${isOn ? ` font-size="${ON_FONT}"` : ''}>${name}</text></g></svg>`
}

// The empty label that makes a button span `cols` cells: em spaces are as wide as the app's text size,
// rounded down with room for the button's padding, so no ellipsis is drawn under the name.
export const cover = (cols: number) =>
  '\u2003'.repeat(Math.max(1, Math.floor((cols * PX_PER_COLUMN - BUTTON_PADDING) / APP_FONT)))

// The row's title, as wide as the context bar's so the rows start their content at the same place.
// TOP_AIR taller than the line, the word at its bottom: the air above the row.
export const titleSvg = () =>
  `${svgOpen(TITLE_WIDTH, SWITCH_HEIGHT + TOP_AIR)}<text x="0" y="${TOP_AIR + SWITCH_HEIGHT / 2 + 4}" fill="${TEXT}">Cost</text></svg>`
