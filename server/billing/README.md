# Billing runtime

Financial source of truth is PostgreSQL. Amounts are integer minor units.

`double-entry.ts` is the preferred journal primitive. A committed journal must balance debits and credits; the database enforces this with a deferred constraint trigger.

`ledger.ts` is retained as a compatibility primitive for legacy single-account entry migration and must not be used for new financial flows. New payment, refund, credit and settlement flows must use balanced journals.
