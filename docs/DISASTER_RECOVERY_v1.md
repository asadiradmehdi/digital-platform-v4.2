# Disaster Recovery v1

## Recovery objectives
RPO and RTO are business decisions and must be configured per environment. The production launch gate requires explicit numeric targets rather than an undocumented assumption.

## Recovery sequence
1. Declare incident and freeze destructive operations.
2. Identify last verified backup/WAL point.
3. Provision clean PostgreSQL infrastructure.
4. Restore backup and WAL to target recovery point.
5. Run migration/schema checks and integrity queries.
6. Validate ledger balance, order/payment consistency and idempotency tables.
7. Run application smoke tests.
8. Re-enable traffic gradually.
9. Reconcile external payment/provider state.
10. Record recovery evidence and post-incident actions.

## Invariants
- Ledger debits equal credits per balanced transaction.
- Historical order prices never change after creation.
- Payment callbacks remain idempotent.
- Provider submissions are not duplicated after ambiguous failures.
- Tenant isolation remains enforced after restore.

## Required evidence
Every restore drill records backup ID, checksum, recovery point, restore duration, validation results, discrepancies and sign-off.
