import { requireCurrentUser } from '../../../../server/identity/request-user';
import { getTeam } from '../../../../server/admin/team';
import { PageHead } from '../ui';
import { TeamClient } from './TeamClient';

export default async function TeamPage() {
  const userId = await requireCurrentUser();
  const team = await getTeam(userId);
  return (
    <>
      <PageHead title="تیم و دسترسی‌ها" hint="هر نفر فقط همان کارهایی را می‌تواند انجام دهد که شما به او داده‌اید. مالک همه‌ی دسترسی‌ها را دارد." />
      <TeamClient team={team} />
    </>
  );
}
