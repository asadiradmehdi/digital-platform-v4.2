export type PaymentCreateInput={amountMinor:bigint;currency:string;orderId?:string;returnUrl:string;idempotencyKey:string;metadata?:Record<string,unknown>};
export type PaymentCreateResult={gatewayReference:string;redirectUrl:string};
export interface PaymentGateway{readonly name:string;createPayment(input:PaymentCreateInput):Promise<PaymentCreateResult>;verifyPayment(input:{gatewayReference:string;amountMinor:bigint;currency:string}):Promise<{paid:boolean;raw?:unknown}>;refund(input:{gatewayReference:string;amountMinor:bigint;idempotencyKey:string}):Promise<{refunded:boolean;raw?:unknown}>;}
