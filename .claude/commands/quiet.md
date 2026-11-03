---
description: Holders above the quiet threshold that nobody has met in the quiet period and that have nothing booked
---

Run `npm run ir -- quiet --json`. For each, say who owns the relationship and offer to book a meeting with `/meet` or draft a brief with `/pre-meeting`. Index funds are left out on purpose. The threshold and the period are settings (`quiet_min_bps`, `quiet_days`).

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
