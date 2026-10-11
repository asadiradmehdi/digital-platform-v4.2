import { redirect } from 'next/navigation';

/** The old technical page lives inside the console now; keep the address working. */
export default function AdminIndex() {
  redirect('/admin/system');
}
