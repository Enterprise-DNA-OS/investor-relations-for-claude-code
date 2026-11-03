# Moving off Irwin

Irwin keeps three things you own (your contacts, the organisations they work for and your meeting history) and two things you rent (the global investor and ownership database it licenses from FactSet and its partners, and its surveillance service). The first three come across. The second two do not: they are data products, not your records. Your own share register replaces most of what you used the ownership screens for.

## 1. Get your records out of Irwin

Irwin does not publish how its exports work, so ask your Irwin account manager for three spreadsheet (CSV) files:

1. **Organizations**: every organisation in your CRM, with type, style, city, country and assets under management.
2. **Contacts**: every contact, with organisation, title, email, phone and city.
3. **Activities**: every meeting, call and event, with date, type, organisation, subject, notes, the investor attendees and your own attendees.

Name the files `Organizations.csv`, `Contacts.csv` and `Activities.csv` and put them in one folder.

## 2. Test run, then import

```bash
npm run ir -- import irwin ./irwin-export --dry-run
npm run ir -- import irwin ./irwin-export
```

The dry run reads every row, matches organisations by name and rolls back, so nothing changes until you run it without `--dry-run`. Running it twice does not duplicate anything.

The import reads the column names Irwin's screens use (`Organization Name`, `Organization Type`, `Investment Style`, `AUM (USD M)`, `First Name`, `Last Name`, `Job Title`, `Activity ID`, `Activity Date`, `Activity Type`, `Subject`, `Notes`, `Attendees`, `Internal Attendees`) and common variants. If your files use other names, write a map and pass it with `--map=map.json`:

```json
{ "institutions": { "name": "Firm" }, "contacts": { "institution": "Company" }, "meetings": { "date": "Meeting Day" } }
```

### What maps

| Irwin | Here |
|---|---|
| Organization, type, style, city, country, AUM | `institutions` (type becomes institution, super fund, hedge fund, family office, index fund or broker) |
| Contact, organisation, title, email, phone | `contacts`, matched by email, then by name within the organisation |
| Activity date, type, organisation, subject and notes | `meetings`, held and noted (future activities come in as booked) |
| Attendees | the investor's people at the meeting, matched by name |
| Internal attendees | your team at the meeting, matched by code or name (add your team first with `/add`) |

### What does not come across

- Irwin's global investor database, targeting fit scores, peer ownership and 13F data. Your own targets list starts from the organisations you have met; add new ones with `/add`.
- Surveillance reports and NOBO data.
- Email campaigns sent through Irwin Mail, website visitor data, tear sheets as files.
- Follow-ups and sentiment: Irwin does not export them in a form we can read reliably. Add the open promises with `/follow-up`.

## 3. Bring in your share register

Your share registry (Computershare, MUFG Corporate Markets, Automic, Boardroom or another) gives you the register, and most companies also buy a monthly beneficial ownership analysis. Export either to CSV with the holder name and the number of shares.

```bash
npm run ir -- import register ./register-2026-10-31.csv --date=2026-10-31 --dry-run
npm run ir -- import register ./register-2026-10-31.csv --date=2026-10-31 --top
```

- Lines are matched to an institution by its name, its code, or an alias: the custodian and account name it appears under (`/alias TPC "J P MORGAN NOMINEES AUSTRALIA PTY LIMITED <TASMAN PEAK A/C>"`). Several lines for one institution are added together.
- Unmatched lines are listed, largest first. Add an alias for each one you care about and import again; the same date is replaced, not doubled.
- Use `--top` for a top-holders report. Holders not on it are carried forward from the register before and listed, instead of being read as sold out. Leave it off for a full beneficial ownership analysis.
- Record shares on issue after any raise with `npm run ir -- capital <shares> --date=..`, so percentages stay right.

## 4. Run both for a month

Keep Irwin until one results cycle has been run here: the register review, the roadshow, the notes and the board report. Then cancel.
