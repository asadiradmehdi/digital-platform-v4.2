import { redirect } from 'next/navigation';
import { requireCurrentUser } from '../identity/request-user';
import { getViewer, type Viewer } from './overview';

/** Signed-in viewer for an app page; anonymous visitors are sent to /auth. */
export async function requireViewer(): Promise<Viewer> {
  let userId: string | null = null;
  try { userId = await requireCurrentUser(); } catch { userId = null; }
  if (!userId) redirect('/auth');
  return getViewer(userId);
}

/** Signed-in viewer when there is one; public pages (catalogue) render for visitors too. */
export async function optionalViewer(): Promise<Viewer | null> {
  try { return await getViewer(await requireCurrentUser()); } catch { return null; }
}
