// Server-side validation of the customer's order inputs (parameters.target / parameters.brief).
// The form spec is shared with the UI (lib/catalog-ui.ts) but only this check is authoritative.
import { AppError } from '../core/errors';
import { CREATIVE_SERVICES, TARGET_MAX } from '../../lib/catalog-ui';

// Control characters other than tab / newline never belong in a brief or a link.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function text(value: unknown, field: string): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new AppError('VALIDATION_ERROR', `${field} باید متن باشد.`);
  return value.replace(CONTROL, '').replace(/\r\n?/g, '\n').trim();
}

/**
 * Returns the parameters to store on the order item.
 * - Creative (team-fulfilled) services accept exactly { target?, brief }: the brief is required and both
 *   are length-bounded, so the team always receives a usable request.
 * - Other services keep their parameters as before, but a `target` must be a bounded string.
 */
export function validateOrderParameters(slug: string, raw: unknown): Record<string, unknown> {
  if (raw != null && (typeof raw !== 'object' || Array.isArray(raw))) throw new AppError('VALIDATION_ERROR', 'Order parameters must be an object.');
  const params = (raw ?? {}) as Record<string, unknown>;
  const spec = CREATIVE_SERVICES[slug];
  const target = text(params.target, spec?.target.label ?? 'لینک');
  if (target.length > TARGET_MAX) throw new AppError('VALIDATION_ERROR', `${spec?.target.label ?? 'لینک'} حداکثر ${TARGET_MAX.toLocaleString('fa-IR')} نویسه است.`);
  if (!spec) return params.target === undefined ? params : { ...params, target };

  if (spec.target.required && !target) throw new AppError('VALIDATION_ERROR', `${spec.target.label} را وارد کنید.`);
  const brief = text(params.brief, spec.brief.label);
  if (brief.length < spec.brief.min) throw new AppError('VALIDATION_ERROR', `${spec.brief.label} را کامل‌تر بنویسید (دست‌کم ${spec.brief.min.toLocaleString('fa-IR')} نویسه).`);
  if (brief.length > spec.brief.max) throw new AppError('VALIDATION_ERROR', `${spec.brief.label} حداکثر ${spec.brief.max.toLocaleString('fa-IR')} نویسه است.`);
  return target ? { target, brief } : { brief };
}
