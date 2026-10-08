BEGIN;

-- createOrder and checkout read service_prices.fx_rate_id to copy the FX provenance of a price
-- onto order_items (0010), but the column was only ever added to order_items, so every order
-- failed with "column sp.fx_rate_id does not exist". Nullable: prices set directly in toman
-- have no FX rate.
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS fx_rate_id uuid REFERENCES fx_rates(id);

COMMIT;
