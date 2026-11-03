---
description: Check the records against the disclosure and calendar rules in docs/compliance.md and report every finding with the rule cited
---

1. Read `docs/compliance.md`. Each rule has a name, its source, what a breach looks like in the data, and the setting behind it.
2. Run `npm run ir -- compliance --json`.
3. Report as a table: rule, record, the issue, the source. Order: material shown before release first, then blackout meetings, substantial holder notices, reporting and AGM deadlines, notes not written.
4. For each finding, the fix the operator can approve: release the deck first (`/release`), move or cancel the meeting (`/cancel`), record the notice once it is lodged (`/notice`), lodge the report (`/lodge`), write the notes (`/note`). Draft any letter to `drafts/`, never send.
5. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc, the setting and the check together.

Nothing here is legal advice. The company's disclosure officer decides what is market sensitive; this command checks the records against the rules the operator has told the system to enforce.
