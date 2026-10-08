import { appApi } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { faNum } from '../../zp/base';
import { CategoryGrid } from '../../zp/cards';
import { SubScreen } from '../../zp/Shell';
import { Async, SecHead } from '../../zp/ui';

/** Drawer «همه‌ی خدمات»: the same 12-category grid as home, on its own page. */
export function ServicesScreen() {
  const catalog = useRemote(appApi.catalog);
  return (
    <SubScreen title="همه‌ی خدمات">
      <Async state={catalog} retry={catalog.retry}>
        {c => (
          <>
            <SecHead title="دسته‌ها" note={`${faNum(c.services.length)} سرویس فعال`} />
            <CategoryGrid categories={c.categories} />
          </>
        )}
      </Async>
    </SubScreen>
  );
}
