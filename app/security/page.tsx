import { redirect } from 'next/navigation';

// The old public "security architecture" page described internal controls. Customers manage their own
// security (sessions, two-step login, passkeys) in their signed-in settings, so this path goes there.
export default function SecurityRedirect(): never {
  redirect('/settings/security');
}
