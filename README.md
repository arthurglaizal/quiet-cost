<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-cost/releases/download/v1.0.0/quiet-cost.gif" alt="Quiet Cost demo: the cost line under each reply and the row that picks its figures" width="100%">
</p>

# Quiet Cost

> **What each reply cost, in one quiet grey line under it.**

A Claude Code mod that signs every reply with what it cost: an estimated price in dollars, how long it took, the tokens it used, and more you can pick, one of them just for fun.

It stays neutral: everything is grey, whatever the price.

## What it shows

Under the last block of each reply:

```txt
$0.42 · 1m 30s · 620 tokens
```

Shown by default:

- **Dollars**: what the reply would cost at the API's list price, by its model. On a subscription you do not pay this: it is a way to compare replies.
- **Time**: how long the reply took, `40s`, `1m 30s`.
- **Tokens**: the tokens the reply read anew and wrote, its subagents included.

Off at first, to add if you like:

- **Model** and **Effort**: what wrote the reply, `Opus 5.5 · High`. Left out by default, as [Quiet Model](https://github.com/arthurglaizal/quiet-model) already names it.
- **Session**: what the whole session has cost so far.
- **Speed**: how fast the reply was written, `84 tok/s`.
- **Full tokens**: every token counted, cache included. It grows with the conversation, but the cache is cheap.
- **Tools**, **Edits** and **Agents**: the tool calls, file edits and subagents of the reply.
- **Snail**, for fun: how far a snail would have crawled meanwhile, `snail 9 cm`.

For your session and weekly limits, see [Quiet Token Bar](https://github.com/arthurglaizal/quiet-token-bar).

## Install

```sh
claude plugin marketplace add arthurglaizal/quiet-cost
claude plugin install quiet-cost@quiet-cost
```

Start a new session and the line appears under the next reply. To update later: `claude plugin update quiet-cost@quiet-cost`. To try it without installing, clone the repository and run `claude --plugin-dir ./quiet-cost`.

## How to use

Type `/quiet-cost` to open a row above the prompt:

```txt
Cost  ◯━ On  │ data  Model  Effort  [Dollars]  Session  [Time]  Speed     ⓘ ×
                       ›     ‹  ›     ‹  ›      ‹  ›     ‹  ›    ‹  ›
                     [Tokens]  Full tokens  Tools  Edits  Agents  Snail
                       ‹  ›    ‹  ›   ‹  ›   ‹  ›    ‹  ›    ‹
```

The switch turns the line on or off. Click a figure to show or hide it, and use `‹` `›` under it to move it. Hover a figure to read what it is. Changes apply to the next replies and are kept: there is nothing to save.

## Limitations

- Needs a Claude Code version with mods (tested on 2.1.296). An update can change the mod API.
- The dollars are a list-price estimate, as `/cost` counts them, not what your plan charges.
- A background agent still running after a reply counts toward the next one.
- Only replies written while the mod is on get a line.

## What it runs and keeps

- **No network requests, no commands.** It only reads the cost, time and tokens Claude Code already counts. Nothing is changed or sent.
- **Hooks**:
  - `command.run`, only for `/quiet-cost`: opens or closes the row and answers the command itself. It never sees or changes any other command, its own or another plugin's.
  - `turn.start`, `turn.step` and `turn.complete`: read the session's cost, the token counts and how long the reply took. Nothing is changed.
  - `ui.render`: draws the line under each reply, and the row above the prompt while it is open.
  - `session.start`: registers `/quiet-cost` and loads your saved settings.
- **Kept on your machine**: whether the line is on, the figures it shows and their order. Nothing about a reply is written to disk.

## Repository structure

```txt
quiet-cost/
├── README.md
├── LICENSE
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── hooks/
│   ├── hooks.json
│   └── register.tsx
├── types/index.d.ts
└── tests/quiet-cost.test.tsx
```

Run the checks with `claude plugin validate .` and `claude plugin test .`.

## Quiet mods

<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v2.0.0/quiet-mods.png" alt="Quiet Token Bar and Quiet Model stacked above the Claude Code prompt" width="100%">
</p>

The Quiet mods share one design: grey by default, color only when something needs you.

| Mod | Description |
| --- | --- |
| [Quiet&nbsp;Token&nbsp;Bar](https://github.com/arthurglaizal/quiet-token-bar) | Your context window in one quiet line: a patterned bar, a compact button and your session and weekly limits, grey until something gets warm. |
| [Quiet&nbsp;Model](https://github.com/arthurglaizal/quiet-model) | Pick the model and effort in one quiet grey row. Or let Magic Router choose for each message. |
| [Quiet&nbsp;Server](https://github.com/arthurglaizal/quiet-server) | Launch your servers without leaving the conversation and catch the ones still running elsewhere: a count in the status line, the details in a pane. |

## Support

If you find my work useful, you can [buy me a coffee](https://ko-fi.com/arturo_ux) ☕️

## License

MIT — see [LICENSE](LICENSE).
