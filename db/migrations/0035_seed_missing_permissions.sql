BEGIN;

-- Routes check these keys but no migration ever created them, so every member got 403 on top-up,
-- order cancellation, subscribing, AI and automation. Create them and grant them to each workspace's
-- system Owner role (what signup grants: every permission except admin.ops).
-- orders.refund is deliberately NOT granted to customers: refunds are issued by staff.
INSERT INTO permissions(key, description) VALUES
  ('wallet.deposit',       'Top up the workspace wallet through the payment gateway'),
  ('orders.cancel',        'Cancel an order that has not been submitted to a provider'),
  ('orders.refund',        'Refund a paid order (staff only)'),
  ('subscriptions.create', 'Subscribe the workspace to a plan'),
  ('ai.read',              'Read AI catalogue and history'),
  ('ai.generate',          'Generate content with AI'),
  ('ai.execute',           'Run AI agents'),
  ('automation.read',      'Read automations'),
  ('automation.write',     'Create and change automations'),
  ('api_keys.read',        'List API keys'),
  ('api_keys.write',       'Create and revoke API keys')
ON CONFLICT(key) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.key IN ('wallet.deposit','orders.cancel','subscriptions.create','ai.read','ai.generate',
                                  'ai.execute','automation.read','automation.write','api_keys.read','api_keys.write')
 WHERE r.is_system AND r.name = 'Owner'
ON CONFLICT DO NOTHING;

COMMIT;
