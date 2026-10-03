export type StructuredDataType =
  | 'Organization'
  | 'Product'
  | 'BreadcrumbList'
  | 'Article'
  | 'FAQPage'
  | 'SoftwareApplication'
  | 'WebSite'
  | 'Service';

type ValidationResult = { valid: boolean; errors: string[] };

const REQUIRED_FIELDS: Partial<Record<StructuredDataType, string[]>> = {
  Organization: ['@type', '@context', 'name'],
  Product: ['@type', '@context', 'name'],
  BreadcrumbList: ['@type', '@context', 'itemListElement'],
  Article: ['@type', '@context', 'headline', 'author', 'datePublished'],
  FAQPage: ['@type', '@context', 'mainEntity'],
  SoftwareApplication: ['@type', '@context', 'name', 'applicationCategory'],
  WebSite: ['@type', '@context', 'url'],
  Service: ['@type', '@context', 'name', 'provider'],
};

export function validateStructuredData(data: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const type = data['@type'] as string | undefined;

  if (!data['@context']) errors.push('Missing @context');
  if (!type) errors.push('Missing @type');
  if (data['@context'] !== 'https://schema.org') errors.push('@context must be "https://schema.org"');

  if (type && type in REQUIRED_FIELDS) {
    const required = REQUIRED_FIELDS[type as StructuredDataType] ?? [];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateEntityStructuredData(entityData: Record<string, unknown>): ValidationResult {
  const jsonLd = entityData.jsonLd as Record<string, unknown> | undefined;
  if (!jsonLd) return { valid: false, errors: ['Entity data missing jsonLd field'] };
  return validateStructuredData(jsonLd);
}
