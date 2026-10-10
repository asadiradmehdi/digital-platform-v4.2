'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../adminFetch';
import { ConfirmSheet, Sheet, useToast } from '../kit';
import { EmptyState, faDate } from '../ui';
import { PermissionMatrix } from './PermissionMatrix';
import { matchPreset, permissionLabel, type PermissionKey } from '../../../../lib/admin-permissions';
import type { TeamMember, TeamOverview } from '../../../../server/admin/team';

type Editing = { mode: 'add' } | { mode: 'edit'; member: TeamMember } | null;
type Confirm = { kind: 'suspend' | 'activate' | 'remove'; member: TeamMember } | { kind: 'invite'; id: string; contact: string } | null;

export function TeamClient({ team }: { team: TeamOverview }) {
  const router = useRouter();
  const toast = useToast();
  const allowed = new Set<PermissionKey>(team.me.permissions);
  const [editing, setEditing] = useState<Editing>(null);
  const [contact, setContact] = useState('');
  const [title, setTitle] = useState('');
  const [perms, setPerms] = useState<PermissionKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  function openAdd() { setContact(''); setTitle(''); setPerms([]); setEditing({ mode: 'add' }); }
  function openEdit(m: TeamMember) { setTitle(m.title ?? ''); setPerms(m.permissions); setEditing({ mode: 'edit', member: m }); }

  async function call(body: Record<string, unknown>, done: string, after?: () => void) {
    setBusy(true);
    const r = await adminSend('/api/v1/admin/team', body);
    setBusy(false);
    if (r.ok) { toast.ok(done); after?.(); router.refresh(); return true; }
    toast.err(r.message); return false;
  }
  async function save() {
    if (!editing) return;
    if (editing.mode === 'add') await call({ action: 'add', contact, title, permissions: perms }, 'عضو اضافه شد', () => setEditing(null));
    else await call({ action: 'update', userId: editing.member.userId, title, permissions: perms }, 'دسترسی‌ها ذخیره شد', () => setEditing(null));
  }
  async function doConfirm() {
    if (!confirm) return;
    if (confirm.kind === 'invite') await call({ action: 'revoke_invite', inviteId: confirm.id }, 'دعوت‌نامه لغو شد', () => setConfirm(null));
    else if (confirm.kind === 'remove') await call({ action: 'remove', userId: confirm.member.userId }, 'عضو حذف شد', () => setConfirm(null));
    else await call({ action: 'status', userId: confirm.member.userId, status: confirm.kind === 'suspend' ? 'SUSPENDED' : 'ACTIVE' }, confirm.kind === 'suspend' ? 'عضو تعلیق شد' : 'عضو فعال شد', () => setConfirm(null));
  }
  const canSave = perms.length > 0 && (editing?.mode !== 'add' || contact.trim().length >= 5);

  return (
    <>
      <div className="zpa-row-flex" style={{ marginBottom: 14 }}>
        <button type="button" className="zpa-btn lg" onClick={openAdd}>+ افزودن عضو</button>
      </div>

      <section className="zpa-sec" aria-labelledby="tm-own"><h2 id="tm-own">مالک</h2>
        <ul className="zpa-list">{team.owners.map(o => (
          <li key={o.userId} className="zpa-item"><div className="zpa-item-top"><b>{o.name}</b><span className="zpa-tag ok">مالک · همه‌ی دسترسی‌ها</span></div>{o.email ? <div className="zpa-item-sub"><span className="zpa-ltr">{o.email}</span></div> : null}</li>
        ))}</ul>
      </section>

      <section className="zpa-sec" aria-labelledby="tm-mem"><h2 id="tm-mem">اعضا</h2>
        {team.members.length === 0 ? <div className="zpa-panel"><EmptyState title="هنوز عضوی اضافه نکرده‌اید" hint="با دکمه‌ی «افزودن عضو» ایمیل یا موبایل همکارتان را بزنید و دسترسی‌اش را تعیین کنید." /></div> : (
          <ul className="zpa-list">{team.members.map(m => {
            const preset = matchPreset(m.permissions);
            return (
              <li key={m.userId} className="zpa-item">
                <div className="zpa-item-top"><b>{m.name}{m.title ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {m.title}</span> : null}</b><span className={`zpa-tag ${m.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{m.status === 'ACTIVE' ? 'فعال' : 'تعلیق'}</span></div>
                <div className="zpa-item-sub">
                  {m.phone ? <span className="zpa-ltr">{m.phone}</span> : m.email ? <span className="zpa-ltr">{m.email}</span> : null}
                  <span>{preset ? preset.label : `${new Intl.NumberFormat('fa-IR').format(m.permissions.length)} دسترسی سفارشی`}</span>
                  {m.parentName ? <span>زیر نظر {m.parentName}</span> : null}
                  <span>از {faDate(m.createdAt)}</span>
                </div>
                {!preset ? <div className="zpa-item-sub">{m.permissions.map(k => <span key={k} className="zpa-tag">{permissionLabel(k)}</span>)}</div> : null}
                {m.editable ? (
                  <div className="zpa-row-flex" style={{ marginTop: 10 }}>
                    <button type="button" className="zpa-btn ghost sm" onClick={() => openEdit(m)}>ویرایش دسترسی</button>
                    <button type="button" className="zpa-btn ghost sm" onClick={() => setConfirm({ kind: m.status === 'ACTIVE' ? 'suspend' : 'activate', member: m })}>{m.status === 'ACTIVE' ? 'تعلیق' : 'فعال‌سازی'}</button>
                    <button type="button" className="zpa-btn danger sm" onClick={() => setConfirm({ kind: 'remove', member: m })}>حذف</button>
                  </div>
                ) : null}
              </li>
            );
          })}</ul>
        )}
      </section>

      {team.invites.length > 0 ? (
        <section className="zpa-sec" aria-labelledby="tm-inv"><h2 id="tm-inv">دعوت‌نامه‌های منتظر</h2>
          <ul className="zpa-list">{team.invites.map(i => (
            <li key={i.id} className="zpa-item">
              <div className="zpa-item-top"><b className="zpa-ltr">{i.contact}</b><span className="zpa-tag warn">منتظر ثبت‌نام</span></div>
              <div className="zpa-item-sub"><span>{i.title ?? matchPreset(i.permissions)?.label ?? 'دسترسی سفارشی'}</span><span>تا {faDate(i.expiresAt)}</span></div>
              <div style={{ marginTop: 8 }}><button type="button" className="zpa-btn ghost sm" onClick={() => setConfirm({ kind: 'invite', id: i.id, contact: i.contact })}>لغو دعوت</button></div>
            </li>
          ))}</ul>
          <p className="zpa-muted" style={{ fontSize: 12 }}>وقتی این شخص با همین ایمیل/موبایل (تأییدشده) وارد شود، خودکار عضو تیم می‌شود.</p>
        </section>
      ) : null}

      <Sheet open={editing !== null} onClose={() => { if (!busy) setEditing(null); }} busy={busy}
        title={editing?.mode === 'add' ? 'افزودن عضو' : `دسترسی‌های ${editing?.mode === 'edit' ? editing.member.name : ''}`}
        footer={<>
          <button type="button" className="zpa-btn ghost lg" disabled={busy} onClick={() => setEditing(null)}>انصراف</button>
          <button type="button" className="zpa-btn lg" disabled={busy || !canSave} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
        </>}>
        {editing?.mode === 'add' ? (
          <div className="zpa-field"><label htmlFor="tm-c">ایمیل یا موبایل</label>
            <input id="tm-c" dir="ltr" inputMode="email" autoComplete="off" value={contact} maxLength={200} onChange={e => setContact(e.target.value)} placeholder="name@example.com یا ۰۹۱۲…" />
            <small>اگر حساب دارد همین حالا اضافه می‌شود؛ وگرنه دعوت‌نامه ثبت می‌شود.</small></div>
        ) : null}
        <div className="zpa-field"><label htmlFor="tm-t">عنوان (اختیاری)</label><input id="tm-t" value={title} maxLength={60} onChange={e => setTitle(e.target.value)} placeholder="مثلاً پشتیبان شیفت شب" /></div>
        <PermissionMatrix value={perms} onChange={setPerms} allowed={allowed} disabled={busy} />
        {team.me.kind !== 'owner' ? <small>فقط تا حد دسترسی‌های خودتان می‌توانید به دیگران دسترسی بدهید.</small> : null}
      </Sheet>

      <ConfirmSheet open={confirm !== null} onClose={() => { if (!busy) setConfirm(null); }} busy={busy} danger={confirm?.kind === 'remove' || confirm?.kind === 'suspend'}
        title={!confirm ? '' : confirm.kind === 'invite' ? 'لغو دعوت‌نامه' : confirm.kind === 'remove' ? `حذف ${confirm.member.name}` : confirm.kind === 'suspend' ? `تعلیق ${confirm.member.name}` : `فعال‌سازی ${confirm.member.name}`}
        confirmLabel={!confirm ? '' : confirm.kind === 'invite' ? 'لغو دعوت' : confirm.kind === 'remove' ? 'حذف عضو' : confirm.kind === 'suspend' ? 'تعلیق' : 'فعال شود'} onConfirm={doConfirm}>
        <p style={{ margin: 0 }}>{!confirm ? '' : confirm.kind === 'remove' ? 'همه‌ی دسترسی‌های این شخص همین الان قطع می‌شود. زیرمجموعه‌هایش به مدیر بالاترش منتقل می‌شوند.' : confirm.kind === 'suspend' ? 'تا زمان فعال‌سازی دوباره هیچ دسترسی‌ای ندارد؛ تنظیمات او حفظ می‌شود.' : confirm.kind === 'activate' ? 'با همان دسترسی‌های قبلی دوباره کار می‌کند.' : `دعوت ${"contact" in confirm ? confirm.contact : ""} لغو می‌شود.`}</p>
      </ConfirmSheet>
    </>
  );
}
