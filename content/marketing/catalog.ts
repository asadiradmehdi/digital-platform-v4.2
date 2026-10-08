export type PublicEntity = {
  slug: string;
  name: string;
  title: string;
  description: string;
  category: string;
  audience: string[];
  capabilities: string[];
  requirements: string[];
  pricingModel: string;
  limitations: string[];
  href: string;
  updatedAt: string;
};

export const publicEntities: PublicEntity[] = [
  {
    slug: 'ai-writing',
    name: 'AI Writing',
    title: 'دستیار نوشتاری هوش مصنوعی',
    description: 'ابزارهای تولید و بازنویسی متن برای سناریوهای محتوایی و کاری.',
    category: 'ai',
    audience: ['تولیدکنندگان محتوا', 'تیم‌های بازاریابی', 'کسب‌وکارها'],
    capabilities: ['تولید متن', 'بازنویسی', 'ایده‌پردازی', 'لحن و ساختار'],
    requirements: ['نوع درخواست و سطح دسترسی Workspace'],
    pricingModel: 'مصرف بر اساس مدل و واحد مصرف فعال.',
    limitations: ['مدل‌ها، سقف مصرف و قابلیت‌ها ممکن است بر اساس پلن تغییر کنند.'],
    href: '/ai/writing',
    updatedAt: '2026-10-02',
  },
  {
    slug: 'workflow-automation',
    name: 'Workflow Automation',
    title: 'اتوماسیون Workflow',
    description: 'ساخت فرآیندهای قابل ردیابی با Trigger، Condition، Action، Schedule و Webhook.',
    category: 'automation',
    audience: ['کسب‌وکارها', 'تیم‌های عملیات', 'آژانس‌ها', 'توسعه‌دهندگان'],
    capabilities: ['Trigger', 'Condition', 'Action', 'Delay', 'Schedule', 'Webhook'],
    requirements: ['Workspace و اتصال‌های مورد نیاز Workflow'],
    pricingModel: 'بر اساس پلن و میزان اجرای Workflow.',
    limitations: ['هر Action به اتصال و سطح دسترسی مورد نیاز خود وابسته است.'],
    href: '/automation/workflows',
    updatedAt: '2026-10-02',
  },
];

export function getEntityBySlug(slug: string, category?: string) {
  return publicEntities.find((entity) => entity.slug === slug && (!category || entity.category === category));
}
export function getEntitiesByCategory(category: string) { return publicEntities.filter((entity) => entity.category === category); }
export function getPublicEntityPaths() { return publicEntities.filter((entity) => entity.href.startsWith('/')).map((entity) => entity.href); }
