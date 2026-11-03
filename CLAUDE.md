# Investor Relations for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR COMPANY], listed on [ASX / NZX], year end [30 June]
- **Operator:** [YOUR NAME], [head of investor relations / CFO / company secretary]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs chasing | `/attention` |
| The register, who moved, who is quiet | `/holders`, `/movers`, `/quiet` |
| Prospects | `/targets` |
| One investor | `/investor` |
| Meetings booked, held, without notes | `/upcoming`, `/meetings`, `/notes-due` |
| One meeting | `/meeting` |
| Promises open | `/follow-ups` |
| Brokers and consensus | `/coverage`, `/consensus` |
| Calendar and blackouts | `/calendar`, `/blackouts` |
| Where management time went | `/exec-time` |
| What investors said | `/feedback`, `/themes` |
| Roadshows and presentations | `/roadshows`, `/materials` |
| Substantial holder notices | `/notices` |
| Rule findings | `/compliance` |
| Book or record a meeting | `/meet` |
| Write up a meeting | `/note` |
| Cancel a meeting | `/cancel` |
| Record or close a promise | `/follow-up`, `/done` |
| A market release, a lodgement, the AGM notice | `/release`, `/lodge` |
| A substantial holder notice | `/notice` |
| A broker update, the price, shares on issue | `/rate` |
| Add a person, institution, contact, roadshow, material, event or broker | `/add` |
| How an institution shows on the register | `/alias` |
| Change a house setting | `/setting`, `/settings` |
| A private note on an investor | `/log` |
| Brief before a meeting | `/pre-meeting` |
| Thank-you after a meeting | `/thank-you` |
| Plan a roadshow, the itinerary | `/roadshow-plan`, `/itinerary` |
| The monthly register review | `/register-review` |
| The post-results wrap | `/results-wrap` |
| The board pack section | `/board-report` |
| The Monday review | `/weekly-review` |
| Dashboards or printed documents | `/view`, `/documents` |
| Bring data across from Irwin, or a register file | `/import` |
| Back everything up | `/export` |
| Change a field, a stage or a rule | `/customise` |
| A new dashboard page | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run ir -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Never rewrite a meeting's notes once written. Add to the investor's file with `/log`.
- Never `--force` a meeting past a blackout or unreleased material without the disclosure officer's yes in this session.
- Never put anything in a draft that has not already been released to the market. If a meeting note records something market sensitive that is not released, say so first.
- This system shows what the records say. The disclosure officer decides what is market sensitive, and the board decides what is released.

## The IR year

- Morning: `/attention`. Before a meeting: `/pre-meeting`. After it: `/note`, then `/follow-up` for each promise, then `/thank-you`.
- Monthly, when the register lands: `/import`, then `/register-review`. Monday: `/weekly-review`.
- Results: `/blackouts` before booking anything, `/release` the deck before the first meeting, `/roadshow-plan`, `/itinerary`, then `/results-wrap` and `/board-report`.
- Shares are whole numbers, prices are dollars to the cent, a share of the company is shown as a percentage (stored as basis points, 500 = 5%).

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Irwin.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/irwin
