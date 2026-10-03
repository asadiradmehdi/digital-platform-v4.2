BEGIN;
INSERT INTO permissions(key, description) VALUES
('workspace.read','Read workspace data'),
('workspace.manage','Manage workspace settings'),
('members.manage','Manage workspace members'),
('catalog.read','Read service catalog'),
('orders.create','Create orders'),
('orders.read','Read orders'),
('orders.manage','Manage orders'),
('wallet.read','Read wallet and transactions'),
('billing.manage','Manage billing'),
('ai.use','Use AI services'),
('ai.manage','Manage AI configuration'),
('automation.use','Run automations'),
('automation.manage','Manage automations'),
('support.create','Create support tickets'),
('support.manage','Manage support tickets'),
('analytics.read','Read analytics'),
('api.manage','Manage API keys'),
('admin.ops','Operate platform administration')
ON CONFLICT(key) DO NOTHING;
COMMIT;
