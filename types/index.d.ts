// The session's figures as a turn began, and the tokens its requests have spent since.
export type Running = {
  usd: number | null // the session's cost so far; null where the host keeps no ledger
  tokens: number
  fresh?: number // of them, all but the conversation read again from the cache
  tools: number // the tool calls the turn's requests asked for, subagents included
  edits?: number // of them, the file edits (Edit, Write, NotebookEdit)
  agents?: number // of them, the subagents started
  output?: number // the tokens the turn's requests wrote
  model: string | null // the model the main conversation's last request ran on
  effort: Effort | null // the effort it asked for; null for a model without one
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | number

// What one reply cost.
export type Cost = {
  model: string | null // the model that wrote it, as the API names it
  effort?: Effort | null // the effort it was asked for
  usd: number | null // estimated, at list price
  sessionUsd: number | null // the session's cost so far, this reply included
  tools: number
  edits?: number
  agents?: number
  output?: number // the tokens written, for the speed
  durationMs: number // how long the reply took to write
  tokens: number // every token the turn's requests counted, subagents included
  fresh?: number // of them, those read anew and written: the cache's rereading left out
}

// What the line can show, in its order.
export type Field =
  | 'model'
  | 'effort'
  | 'usd'
  | 'session'
  | 'time'
  | 'speed'
  | 'tokens'
  | 'full'
  | 'tools'
  | 'edits'
  | 'agents'
  | 'snail'

declare module 'claude-code' {
  interface PluginState {
    'quiet-cost': {
      running: Running | null // the main turn in progress; null between turns
      // The end of the session's last replies, what each cost, and the figures its line was set to show
      // when it was written: a later change of the row applies to the replies that follow.
      replies: { tail: string; cost: Cost; shown?: Field[] }[]
      isOn: boolean // whether the line is drawn at all, kept across sessions in the store too
      fields: Field[] // the figures the line shows, kept across sessions in the store too
      order: Field[] // every figure, in the line's order, kept likewise
      isRowShown: boolean // the row above the prompt that picks them
    }
  }
}
