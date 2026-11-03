---
description: Bring data across: your Irwin contacts, organisations and meeting history, or a share register file
---

Read `docs/replace-irwin.md`. Always run with `--dry-run` first and show what would come across. Irwin: `npm run ir -- import irwin <folder> --dry-run [--map=map.json]`. Register: `npm run ir -- import register <file.csv> --date=YYYY-MM-DD [--top] --dry-run`; use `--top` for a top-holders report so holders not listed are carried forward, not read as sold. Show unmatched lines and offer `/alias` for each. Run without `--dry-run` only after the operator says yes.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
