<h1 align="center">Investor Relations for Claude Code</h1>

<p align="center">
  <strong>The open-source investor relations system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Irwin data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=irwin">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/irwin?utm_source=github&utm_medium=readme&utm_campaign=irwin">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-irwin">Instead of Irwin</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Investor Relations for Claude Code does the job you pay Irwin for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Irwin dashboard cannot.

Irwin publishes no price: each company gets a quote after a demo, and its own site lists surveillance reports and NOBO ownership data as extra plans "for an additional cost" ([Irwin shareholder monitoring](https://www.getirwin.com/solutions/shareholder-monitoring)). This repo has no seats and no plans.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=irwin).

It is for the investor relations manager, CFO and CEO of a listed small or mid cap company on the ASX or NZX. It keeps the investors you know and the people at each, every meeting and what was said, what you promised, the share register over time, substantial holder notices, the presentations you showed and when each went to the market, broker coverage and consensus, and the market calendar with its blackouts and deadlines. It checks every meeting against your disclosure policy and the listing rules, and tells you who to call.

### Ten questions it answers today

| Ask | Command |
|---|---|
| Which holders with more than 1% has nobody from management met in six months, with nothing booked? | `/quiet` |
| Who sold since the last register, and had we met them in the 90 days before? | `/movers` |
| Which meetings booked ahead fall inside a blackout? | `/upcoming` |
| Was any presentation shown to an investor before it was released to the market? | `/compliance` |
| Which holders are at or over 5% with no substantial holder notice, or have moved a point since their last one? | `/compliance` |
| How many of the CEO's investor meetings in the last six months were with holders of less than 1%? | `/exec-time` |
| What did investors raise most after the last result, and how did the mood compare with the result before? | `/feedback` |
| Which funds have we met three times this year and still do not hold? | `/targets` |
| Where is the consensus target against the last close, and which broker moved last? | `/consensus` |
| Which promises made in meetings are still open, and who owes them? | `/follow-ups` |

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/investor-relations-for-claude-code.git
cd investor-relations-for-claude-code
npm install
npm run demo
```

The demo is a fictional ASX-listed company, Harbourline Group, with fifteen institutions, two registers, a results roadshow and a New Zealand roadshow, five brokers and the calendar. Then open the folder in Claude Code and type `/attention`.

### Your first hour: ten things to ask for

1. "What needs chasing this week?" (`/attention`)
2. "Who moved on the last register, and had we seen them?" (`/movers`)
3. "Brief the CEO for tomorrow's meeting with Tasman Peak." (`/pre-meeting`)
4. "Write up the meeting: they liked the margins, asked about debt, I promised the maturity profile." (`/note`, `/follow-up`)
5. "Are we in a blackout, and is anything booked inside it?" (`/blackouts`, `/upcoming`)
6. "Plan the Auckland roadshow." (`/roadshow-plan`)
7. "What has the market asked since the result?" (`/themes`)
8. "Draft the IR section of the board pack." (`/board-report`)
9. "Add a field for each investor's ESG rating." (`/customise`)
10. "Bring in this month's register." (`/import`)

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything to chase: rule findings, promises, quiet holders, sellers, meetings, deadlines, blackouts |
| `/holders` | The register ranked, with change and last meeting |
| `/movers` | Who bought and sold, and whether we had met them |
| `/quiet` | Holders nobody has seen |
| `/targets` | Non-holders, best prospects first |
| `/investor` | One investor's whole file |
| `/upcoming` | Meetings booked, with blackout and material checks |
| `/meetings` | The last 90 days of meetings |
| `/meeting` | One meeting |
| `/notes-due` | Meetings with no notes yet |
| `/follow-ups` | Promises still open |
| `/coverage` | Each broker's rating, target and estimates |
| `/consensus` | The consensus against the last close |
| `/calendar` | Results, quarterlies, AGM, deadlines |
| `/blackouts` | Blackout windows |
| `/exec-time` | Where management time went, by holding size |
| `/feedback` | What investors said after each result |
| `/themes` | Themes since the last result |
| `/roadshows` | Every roadshow |
| `/materials` | Presentations and when each was released |
| `/notices` | Substantial holder notices on file |
| `/compliance` | Disclosure and calendar rules checked, with sources |
| `/settings` | House settings and limits |
| `/meet` | Book or record a meeting (refuses a blackout or unreleased material) |
| `/note` | Write up a meeting, once |
| `/cancel` | Cancel a meeting |
| `/follow-up` | Record a promise |
| `/done` | Close a promise |
| `/release` | Record a market release |
| `/lodge` | Record a lodgement or the AGM notice |
| `/notice` | Record a substantial holder notice |
| `/rate` | Update a broker, the price or shares on issue |
| `/add` | Add a person, institution, contact, roadshow, material, event or broker |
| `/alias` | How an institution appears on the register |
| `/setting` | Change a setting |
| `/log` | A private note on an investor |
| `/register-review` | The monthly register review, drafted |
| `/results-wrap` | The post-results wrap, drafted |
| `/roadshow-plan` | Plan a roadshow |
| `/pre-meeting` | A one-page brief before a meeting |
| `/thank-you` | A thank-you note with what was promised |
| `/itinerary` | The roadshow itinerary |
| `/board-report` | The IR section of the board pack |
| `/weekly-review` | The Monday review |
| `/view` | Dashboards: week, register, disclosure |
| `/documents` | Tear sheets, itineraries, the board report |
| `/import` | Bring in Irwin records or a register file |
| `/export` | Back up everything |
| `/customise` | Add a field, change a rule, in plain language |
| `/new-view` | Add a dashboard page |

Every command drives one CLI: `npm run ir -- help` lists it all. `npm run view` renders the dashboards and `npm run docs` the branded documents, in the colours in `brand.json`.

## Instead of Irwin

Ask Irwin for your organisations, contacts and activity history as CSV files, then `npm run ir -- import irwin <folder> --dry-run`. Your share register comes straight from your registry: `npm run ir -- import register <file.csv> --date=YYYY-MM-DD`. What maps, what does not (Irwin's licensed investor database and surveillance stay with Irwin) and how to run both side by side: [docs/replace-irwin.md](docs/replace-irwin.md). The rules the checks run, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
investor-relations-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Investor Relations for Claude Code for your business, migrates your Irwin data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=irwin)
- Read more: [enterprisedna.co/omni/instead-of/irwin](https://enterprisedna.co/omni/instead-of/irwin?utm_source=github&utm_medium=readme&utm_campaign=irwin)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
