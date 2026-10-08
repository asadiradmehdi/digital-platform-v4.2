'use client';
import { ZIcon } from '../../../components/zp/ZIcon';

/** «دانلود PDF / چاپ»: the browser's print dialog renders the A4 print stylesheet (Save as PDF). */
export function PrintButton() {
  return (
    <button type="button" className="zp-cta big zp-press" onClick={() => window.print()}>
      <ZIcon name="save" />دانلود PDF / چاپ
    </button>
  );
}
