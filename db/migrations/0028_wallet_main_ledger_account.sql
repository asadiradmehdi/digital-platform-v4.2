BEGIN;

-- Every wallet debit/credit path (wallet payment, top-up, refund, cancellation, renewal)
-- posts to the wallet's 'MAIN' ledger account, but registration only created
-- AVAILABLE/HELD/REFUNDS, so paying from the wallet always failed with "Wallet not found".
-- Backfill a MAIN account for every wallet that lacks one. Idempotent.
INSERT INTO ledger_accounts(wallet_id, account_code)
SELECT w.id, 'MAIN' FROM wallets w
ON CONFLICT (wallet_id, account_code) DO NOTHING;

COMMIT;
