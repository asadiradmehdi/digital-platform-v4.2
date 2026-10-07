import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZOHALPAY',
    short_name: 'Digital',
    description: 'پلتفرم خدمات دیجیتال، هوش مصنوعی و اتوماسیون',
    start_url: '/',
    display: 'standalone',
    lang: 'fa',
    dir: 'rtl',
  };
}
