import { AppError } from './errors';
export type RiskState = 'NORMAL' | 'REVIEW' | 'RESTRICTED';
export function assertActionAllowed(state: RiskState) { if (state === 'RESTRICTED') throw new AppError('FORBIDDEN', 'This workspace is restricted.'); if (state === 'REVIEW') throw new AppError('RISK_REVIEW', 'This action requires review.'); }
