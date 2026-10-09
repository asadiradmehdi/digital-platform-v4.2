-- Migration: 0063_password_reset_otp
-- Forgotten-password recovery uses the same SMS one-time-code table as sign-in; only the purpose list grows.
-- No new table, no workspace_id: otp_challenges stays account/platform scoped (see 0050).
BEGIN;
ALTER TABLE otp_challenges DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;
ALTER TABLE otp_challenges ADD CONSTRAINT otp_challenges_purpose_check
  CHECK (purpose IN ('LOGIN','REAUTH','PHONE_CHANGE','PASSWORD_RESET'));
COMMIT;
