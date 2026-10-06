BEGIN;

-- Migration 0016 seeded all transaction_security_policies with active=true.
-- Step-up enforcement must be explicitly enabled by an operator after the web
-- and mobile UI step-up flows are deployed and tested end-to-end.
-- Setting active=false here makes the policies visible for configuration
-- without blocking any existing routes on first deployment.
UPDATE transaction_security_policies
SET active = false
WHERE action_type IN (
  'WALLET_WITHDRAW',
  'PAYMENT_METHOD_CHANGE',
  'API_KEY_CREATE',
  'API_KEY_REVOKE',
  'SECURITY_SETTINGS_CHANGE',
  'WORKSPACE_OWNER_CHANGE'
);

COMMIT;
