import { notFound } from 'next/navigation';
import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getServicePackages } from '../../../../../server/admin/packages';
import { listAdminServices } from '../../../../../server/admin/catalog';
import { AppError } from '../../../../../server/core/errors';
import { formatQuantityWords } from '../../../../../lib/format';
import { EmptyState, PageHead, faDate, fa, toman } from '../../ui';
import { PackageEditor } from './PackageEditor';
import { ActiveSwitch, BasePriceTools, CostForm, DetailsForm } from './ServiceForms';

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireCurrentUser();
  let data;
  try { data = await getServicePackages(userId, id); } catch (e) { if (e instanceof AppError && (e.code === 'NOT_FOUND' || e.code === 'VALIDATION_ERROR')) notFound(); throw e; }
  const row = (await listAdminServices(userId)).find(s => s.id === id);
  const { service, kind, history } = data;
  const base = data.packages.find(p => p.quantity === kind.per) ? kind.per : null;
  const label = (q: number) => `${formatQuantityWords(q)} ${kind.unit}`;

  return (
    <>
      <PageHead title={service.name} hint={`${service.productName} · ${service.fulfillmentMode === 'MANUAL' ? 'انجام دستی توسط تیم' : 'انجام خودکار'}`} back={{ href: '/admin/catalog', label: 'همه‌ی خدمات' }}>
        <ActiveSwitch serviceId={service.id} name={service.name} active={service.active} />
      </PageHead>

      {data.unitToman === null ? (
        <div className="zpa-panel"><EmptyState title="این خدمت هنوز قیمت ندارد" hint="اول باید قیمت پایه‌اش در سیستم ثبت شود (کاتالوگ اولیه)؛ بعد بسته‌ها اینجا قابل ویرایش می‌شوند." /></div>
      ) : (
        <PackageEditor key={data.packages.map(p => `${p.quantity}:${p.priceToman}:${p.pinned}`).join('|') + (data.cost?.perUnitToman ?? '')}
          serviceId={service.id} unit={kind.unit} per={kind.per} baseQuantity={base} unitToman={data.unitToman} packages={data.packages} cost={data.cost} lastChangeId={data.undoableBatchId} />
      )}

      <CostForm key={`c${data.cost?.perUnitToman ?? ''}`} serviceId={service.id} unit={kind.unit} current={data.cost?.source === 'manual' ? data.cost.perUnitToman : null} source={data.cost?.source ?? null} />
      <DetailsForm key={`d${service.name}${service.description}${service.hint}${service.sortOrder}`} serviceId={service.id} name={service.name} description={service.description ?? ''} hint={service.hint ?? ''} sortOrder={service.sortOrder} />
      {row ? <BasePriceTools draft={row.draft ? { id: row.draft.id, unitToman: row.draft.unitToman } : null} priceId={row.price?.id} confirmed={row.price?.confirmed ?? true} /> : null}

      <section className="zpa-sec" aria-labelledby="hist-h">
        <h2 id="hist-h">تاریخچه‌ی تغییر قیمت</h2>
        {history.length === 0 ? <div className="zpa-panel"><EmptyState title="هنوز تغییری ثبت نشده" hint="هر بار که قیمتی را ذخیره کنید اینجا می‌بینید که چه کسی و چه زمانی چه چیزی را عوض کرده است." /></div> : (
          <ul className="zpa-list">
            {history.map(h => (
              <li key={h.id} className="zpa-item">
                <div className="zpa-item-top">
                  <b>{h.kind === 'UNDO' ? 'برگشت به قیمت قبلی' : h.kind === 'BULK' ? 'تغییر درصدی دسته' : 'ویرایش قیمت بسته‌ها'}</b>
                  <span>{h.undone ? <span className="zpa-tag">برگردانده شد</span> : null}</span>
                </div>
                <div className="zpa-item-sub">
                  <span>{faDate(h.at)}</span>{h.by ? <span>{h.by}</span> : null}{h.note ? <span>{h.note}</span> : null}
                </div>
                <div className="zpa-item-sub">
                  {h.unit ? <span>قیمت پایه: {fa(h.unit.from ?? 0)} ← {fa(h.unit.to ?? 0)}</span> : null}
                  {h.changes.slice(0, 8).map(c => <span key={c.quantity}>{label(c.quantity)}: {toman(c.from)} ← <b>{toman(c.to)}</b></span>)}
                  {h.changes.length > 8 ? <span>و {fa(h.changes.length - 8)} مورد دیگر</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
