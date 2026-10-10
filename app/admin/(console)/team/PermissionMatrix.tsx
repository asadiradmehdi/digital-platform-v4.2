'use client';
import { PERMISSION_GROUPS, PRESETS, matchPreset, normalizePermissions, type PermissionKey } from '../../../../lib/admin-permissions';

/** Preset chips + grouped checkboxes. `allowed` = what the person editing may hand out; other keys are shown locked. */
export function PermissionMatrix({ value, onChange, allowed, disabled }: { value: PermissionKey[]; onChange: (v: PermissionKey[]) => void; allowed: ReadonlySet<PermissionKey>; disabled?: boolean }) {
  const active = matchPreset(value);
  const has = (k: PermissionKey) => value.includes(k);
  function toggle(k: PermissionKey) {
    if (has(k)) {
      // removing a "view" key also removes everything that requires it
      const drop = new Set<PermissionKey>([k]);
      for (const g of PERMISSION_GROUPS) for (const i of g.items) if (i.requires === k) drop.add(i.key);
      onChange(value.filter(x => !drop.has(x)));
    } else onChange(normalizePermissions([...value, k]));
  }
  return (
    <div className="zpa-stack">
      <div className="zpa-field">
        <span style={{ fontWeight: 700, fontSize: 13 }}>الگوی آماده</span>
        <div className="zpa-chips" role="group" aria-label="الگوهای آماده">
          {PRESETS.map(p => {
            const ok = p.permissions.every(k => allowed.has(k));
            return <button key={p.id} type="button" className="zpa-chip" aria-pressed={active?.id === p.id} disabled={disabled || !ok} title={p.hint} onClick={() => onChange(p.permissions)}>{p.label}</button>;
          })}
        </div>
        {active ? <small>{active.hint}</small> : <small>دسترسی سفارشی</small>}
      </div>
      {PERMISSION_GROUPS.map(g => (
        <fieldset key={g.id} className="zpa-perm-group">
          <legend>{g.label}</legend>
          {g.items.map(i => {
            const locked = !allowed.has(i.key);
            return (
              <label key={i.key} className="zpa-perm" data-locked={locked || undefined}>
                <input type="checkbox" checked={has(i.key)} disabled={disabled || (locked && !has(i.key))} onChange={() => toggle(i.key)} />
                <span><b>{i.label}</b><small>{locked && !has(i.key) ? 'خودتان این دسترسی را ندارید' : i.hint}</small></span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
