import { AppError } from './errors';

export const ORDER_STATUSES = ['CREATED','PAYMENT_PENDING','PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED','REFUND_PENDING','REFUNDED'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED:['PAYMENT_PENDING','CANCELLED'], PAYMENT_PENDING:['PAID','CANCELLED'], PAID:['QUEUED','REFUND_PENDING'],
  QUEUED:['PROCESSING','IN_PROGRESS','CANCELLED'], PROCESSING:['PROVIDER_SUBMITTED','FAILED','CANCELLED'], PROVIDER_SUBMITTED:['IN_PROGRESS','FAILED'],
  IN_PROGRESS:['COMPLETED','FAILED','REFUND_PENDING'], COMPLETED:['REFUND_PENDING'], FAILED:['REFUND_PENDING','CANCELLED'],
  CANCELLED:[], REFUND_PENDING:['REFUNDED','FAILED'], REFUNDED:[]
};
export function assertOrderTransition(from: OrderStatus, to: OrderStatus) {
  if (!transitions[from].includes(to)) throw new AppError('CONFLICT', `Invalid order transition: ${from} → ${to}.`, { from, to });
}
export function canTransitionOrder(from: OrderStatus, to: OrderStatus) { return transitions[from].includes(to); }
