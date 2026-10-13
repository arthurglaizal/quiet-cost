<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-cost/releases/download/v1.0.0/quiet-cost.gif" alt="Quiet Cost demo: the cost line under each reply and the row that picks its figures" width="100%">
</p>

# Quiet Cost

> **What each reply cost, in one quiet grey line under it.**

A Claude Code mod that signs every reply with what it cost: an estimated price in dollars, how long it took, the tokens it used, and more you can pick, one of them just for fun.

It stays neutral: everything is grey, and the price only takes color when that reply weighed.

## What it shows

Under the last block of each reply:

```txt
$0.42 · 1m 30s · 620 tokens
```

From left to right:

- **Model** (off at first): the model that wrote the reply, `Opus 5.5`. Left out by default, as [Quiet Model](https://github.com/arthurglaizal/quiet-model) already names it.
- **Effort** (off at first): the effort the reply was asked for, `High`. Nothing for a model without one (Haiku).
- **Dollars**: what the reply would cost at the API's list price. Claude Code prices each request by its model, so a Fable reply costs more than an Opus one, and far more than a Haiku one. On a subscription this is not what you pay: it is a way to compare replies.
- **Session** (off at first): what the whole session has cost so far, `session $4.20`.
- **Time**: how long the reply took to write: `40s`, `1m 30s`, `2h 30m`.
- **Speed** (off at first): how fast the reply was written, `84 tok/s`.
- **Tokens**: the tokens the reply read anew and wrote, the subagents it started included, `620 tokens`.
- **Full tokens** (off at first): every token it counted, `474k full tokens`. Each reply reads the whole conversation again from the cache, so this grows with the conversation whatever the reply does; the cache is cheap, which is why the price stays low.
- **Tools** (off at first): how many tool calls the reply made, `12 tools`; left out when it made none.
- **Edits** (off at first): the file edits the reply made, `3 edits`; left out when it made none.
- **Agents** (off at first): the subagents it started, `2 agents`, and `0 agents` when it started none.
- **Snail** (off at first, for fun): how far a snail would have crawled meanwhile, `snail 9 cm`.

The smallest price reads `$0.01`. For your session and weekly limits, see [Quiet Token Bar](https://github.com/arthurglaizal/quiet-token-bar).

On the desktop app the line is drawn small, like Quiet Model's signature. In the terminal it is plain dim text.

### When it takes color

Only the price, in orange from $1 a reply, in red from $5.

## How to use

Once installed, the line appears under each new reply, with the price, the time and the tokens.

To pick the figures, type `/quiet-cost`: a row opens above the prompt.

```txt
Cost  ◯━ On  │ data  Model  Effort  [Dollars]  Session  [Time]  Speed     ⓘ ×
                       ›     ‹  ›     ‹  ›      ‹  ›     ‹  ›    ‹  ›
                     [Tokens]  Full tokens  Tools  Edits  Agents  Snail
                       ‹  ›    ‹  ›   ‹  ›   ‹  ›    ‹  ›    ‹
```

The switch turns the line on or off. After `data`, each figure is a toggle: on a chip when the line shows it. The `‹` and `›` under each figure move it along the line. Hover a figure to read what it is and how it reads in the line. Changes apply to the next replies, not to the ones already written, and are kept for the next sessions: there is nothing to save. The cross closes the row.

| Action | How |
| --- | --- |
| Open or close the row | `/quiet-cost` |
| Turn the line on or off | the first switch |
| Show or hide a figure | click it |
| Move a figure | the `‹` and `›` under it |
| Read what each figure is | hover it |
| Read what the mod does | hover the info icon |

## Limitations

- Mods are a recent Claude Code feature: you need a version with mod support (tested on **Claude Code 2.1.296**), and an update can change the mod API.
- **The dollars are an estimate at list price**, as `/cost` counts them. On a Pro or Max plan you pay your subscription, not this.
- Work a reply leaves running after it ends (a background agent) counts toward the next reply.
- Only replies written while the mod is on are signed; earlier ones and replies of a resumed session keep no line.
- On desktop, widths are estimated, so the line can be cut short or end with a little air depending on the font.

## What it runs and keeps

- **No network requests.** Nothing is sent anywhere by the mod.
- **No commands.** It never runs a slash command, changes your settings, or touches the requests you send.
- **What it hooks:**
  - `command.run`, only for `/quiet-cost`: opens or closes the row. It never sees any other command.
  - `turn.start` and `turn.complete`: reads the session's cost as a reply starts and ends, the figure `/cost` and the status line use, and how long the reply took.
  - `turn.step`: reads the token counts of each request. Nothing is changed.
  - `ui.render`: draws the line under each reply, and the row above the prompt while it is open.
  - `session.start`: registers `/quiet-cost`.
- **In the session's memory only**: the last 160 characters of recent replies, used to tell which reply to sign, and what each cost. Nothing about a reply is written to disk.
- **Three values kept on your machine**, in Claude Code's plugin storage: whether the line is on, the figures it shows and their order.

## Install in Claude Code

This repository is its own plugin marketplace.

```sh
claude plugin marketplace add arthurglaizal/quiet-cost
claude plugin install quiet-cost@quiet-cost
```

Or, in a Claude Code session:

```txt
/plugin marketplace add arthurglaizal/quiet-cost
/plugin install quiet-cost@quiet-cost
```

Start a new session and the line appears under the next reply.

To try it without installing, clone the repository and run:

```sh
claude --plugin-dir ./quiet-cost
```

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
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v1.0.0/quiet-mods.png" alt="Quiet Token Bar and Quiet Model stacked above the Claude Code prompt" width="100%">
</p>

The Quiet mods share one design: grey by default, color only when something needs you.

| Mod | Description |
| --- | --- |
| [Quiet Token Bar](https://github.com/arthurglaizal/quiet-token-bar) | Your context window in one quiet line: a patterned bar, a compact button and your session and weekly limits, grey until something gets warm. |
| [Quiet Model](https://github.com/arthurglaizal/quiet-model) | The model and effort picker as one quiet grey row above the prompt. |

## Support

If you find my work useful, you can [buy me a coffee](https://ko-fi.com/arturo_ux) ☕️

## License

MIT — see [LICENSE](LICENSE).
