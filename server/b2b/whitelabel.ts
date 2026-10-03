import { query } from '../core/db';

export type WorkspaceBranding = {
  displayName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  supportEmail?: string;
  metadata?: Record<string, unknown>;
};

export async function upsertBranding(workspaceId: string, branding: WorkspaceBranding): Promise<void> {
  await query(
    `INSERT INTO workspace_branding(workspace_id, display_name, logo_url, favicon_url, primary_color, custom_domain, support_email, metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(workspace_id) DO UPDATE SET
       display_name=COALESCE($2, workspace_branding.display_name),
       logo_url=COALESCE($3, workspace_branding.logo_url),
       favicon_url=COALESCE($4, workspace_branding.favicon_url),
       primary_color=COALESCE($5, workspace_branding.primary_color),
       custom_domain=COALESCE($6, workspace_branding.custom_domain),
       support_email=COALESCE($7, workspace_branding.support_email),
       metadata=workspace_branding.metadata || $8,
       updated_at=now()`,
    [workspaceId, branding.displayName ?? null, branding.logoUrl ?? null, branding.faviconUrl ?? null,
     branding.primaryColor ?? null, branding.customDomain ?? null, branding.supportEmail ?? null, branding.metadata ?? {}]
  );
}

export async function getBranding(workspaceId: string): Promise<WorkspaceBranding | null> {
  const r = await query<WorkspaceBranding & { workspace_id: string }>(
    `SELECT display_name AS "displayName", logo_url AS "logoUrl", favicon_url AS "faviconUrl",
            primary_color AS "primaryColor", custom_domain AS "customDomain",
            support_email AS "supportEmail", metadata
     FROM workspace_branding WHERE workspace_id=$1`,
    [workspaceId]
  );
  return r.rows[0] ?? null;
}

export async function resolveWorkspaceByDomain(domain: string): Promise<string | null> {
  const r = await query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_branding WHERE custom_domain=$1`,
    [domain]
  );
  return r.rows[0]?.workspace_id ?? null;
}
