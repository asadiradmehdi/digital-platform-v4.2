'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ZIcon, type IconName } from '../../../components/zp/ZIcon';
import { Tile } from '../../../components/zp/brand';

export type CategoryRow = { slug: string; name: string; note: string; icon: IconName; perLabel: string; price: string | null };
export type CategoryGroup = { label: string; rows: CategoryRow[] };

/** Segmented service groups (فالوور / لایک / بازدید …) with one list visible at a time — no page scroll. */
export function CategoryRows({ groups }: { groups: CategoryGroup[] }) {
  const [g, setG] = useState(0);
  const group = groups[g] ?? groups[0];
  return (
    <>
      {groups.length > 1 && (
        <div className="zp-seg" role="group" aria-label="گروه سرویس">
          {groups.map((x, k) => (
            <button key={x.label} type="button" aria-pressed={k === g} onClick={() => setG(k)}>{x.label}</button>
          ))}
        </div>
      )}
      <div className="zp-list two">
        {group.rows.map(r => (
          <Link key={r.slug} href={`/orders/new?service=${r.slug}`} className="zp-row zp-press">
            <Tile icon={r.icon} />
            <span className="t"><b>{r.name}</b><span>{r.note}</span></span>
            <span className="pr">
              {r.price ? <>{r.perLabel}<b>{r.price}<i>تومان</i></b></> : <b>مشاهده</b>}
            </span>
            <ZIcon name="chevL" className="zp-chev" />
          </Link>
        ))}
      </div>
    </>
  );
}
