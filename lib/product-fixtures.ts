import type { DashboardSummary, OrderSummary, ServiceSummary, AiUsageSummary } from '@digital-platform/api-contracts';

export const dashboardFixture: DashboardSummary = { walletBalanceMinor: 12500000, currency: 'IRR', activeOrders: 3, activeSubscription: 'Pro', aiUsagePercent: 68 };
export const aiUsageFixture: AiUsageSummary = { used: 68, limit: 100, unit: '%', periodStart: '2026-10-01', periodEnd: '2026-10-31' };
export const servicesFixture: ServiceSummary[] = [
  { id:'svc-ai-writer', slug:'ai-writer-pro', name:'AI Writer Pro', priceMinor: 6600000, currency:'IRR', available:true },
  { id:'svc-ai-image', slug:'ai-image', name:'AI Image Studio', priceMinor: 4200000, currency:'IRR', available:true },
  { id:'svc-instagram', slug:'instagram-growth', name:'Instagram Growth', priceMinor: 2900000, currency:'IRR', available:true },
  { id:'svc-automation', slug:'automation-pro', name:'Automation Pro', priceMinor: 8900000, currency:'IRR', available:true },
];
export const ordersFixture: OrderSummary[] = [
  { id:'ord-1', code:'#DP-10482', status:'PROCESSING', totalMinor:2900000, currency:'IRR', createdAt:'2026-10-02T08:18:00Z' },
  { id:'ord-2', code:'#DP-10477', status:'COMPLETED', totalMinor:6600000, currency:'IRR', createdAt:'2026-10-01T16:40:00Z' },
  { id:'ord-3', code:'#DP-10469', status:'QUEUED', totalMinor:4200000, currency:'IRR', createdAt:'2026-10-01T10:12:00Z' },
];
export const subscriptionFixture = { id:'sub-pro', plan:'Pro', status:'ACTIVE', renewalDate:'2026-10-28', priceMinor:18900000, currency:'IRR', usagePercent:68, entitlements:['AI usage','Priority routing','Automation runs','Knowledge base'] } as const;
export const walletFixture = { balanceMinor:12500000, currency:'IRR', pendingMinor:0, transactions:[
  { id:'tx-1', type:'SERVICE_CHARGE', label:'AI Writer Pro', amountMinor:-6600000, createdAt:'2026-10-02T08:20:00Z' },
  { id:'tx-2', type:'TOPUP', label:'افزایش موجودی', amountMinor:10000000, createdAt:'2026-10-01T14:00:00Z' },
  { id:'tx-3', type:'SERVICE_CHARGE', label:'Instagram Growth', amountMinor:-2900000, createdAt:'2026-10-01T10:14:00Z' },
] } as const;
export const analyticsFixture = { revenueMinor: 48600000, providerCostMinor: 17300000, paymentCostMinor: 850000, refundMinor: 1200000, contributionMinor: 29250000, activeUsers: 1240, mrrMinor: 18900000 } as const;
