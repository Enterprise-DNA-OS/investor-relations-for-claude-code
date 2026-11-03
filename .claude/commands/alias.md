---
description: Tell the system how an institution appears on the share register (custodian and account name)
---

Run `npm run ir -- alias <institution> "<name exactly as on the register>"`. Do this for every unmatched line a register import lists, then import again.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
