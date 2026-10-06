import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type MeResponse = {
  user: { id: string; email: string; displayName?: string };
  workspaces: Array<{ id: string; name: string; slug: string }>;
};

type WorkspaceState = {
  workspaceId: string | null;
  workspaceName: string | null;
  userDisplayName: string | null;
  loading: boolean;
  error: string | null;
};

let cache: WorkspaceState | null = null;

export function useWorkspace(): WorkspaceState {
  const [state, setState] = useState<WorkspaceState>(
    cache ?? { workspaceId: null, workspaceName: null, userDisplayName: null, loading: true, error: null },
  );

  useEffect(() => {
    if (cache && !cache.loading) { setState(cache); return; }
    apiFetch<MeResponse>('/api/v1/me')
      .then((data) => {
        const ws = data.workspaces?.[0];
        const next: WorkspaceState = {
          workspaceId: ws?.id ?? null,
          workspaceName: ws?.name ?? null,
          userDisplayName: data.user?.displayName ?? data.user?.email ?? null,
          loading: false,
          error: null,
        };
        cache = next;
        setState(next);
      })
      .catch((err: unknown) => {
        const next: WorkspaceState = {
          workspaceId: null,
          workspaceName: null,
          userDisplayName: null,
          loading: false,
          error: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات کاربر',
        };
        setState(next);
      });
  }, []);

  return state;
}
