import { AppError } from '../core/errors';
export type PaymentWebhook={gateway:string;eventId:string;type:string;reference:string;payload:Record<string,unknown>};
export function validatePaymentWebhook(input:PaymentWebhook){if(!input.gateway||!input.eventId||!input.reference)throw new AppError('VALIDATION_ERROR','Invalid payment webhook.');return input;}
