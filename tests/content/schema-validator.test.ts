import { describe, it, expect } from 'vitest';
import { validateStructuredData, validateEntityStructuredData } from '../../server/content/schema-validator';

describe('validateStructuredData', () => {
  it('passes a valid Organization schema', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme Corp',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when @context is missing', () => {
    const result = validateStructuredData({ '@type': 'Organization', name: 'X' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing @context');
  });

  it('fails when @context is not https://schema.org', () => {
    const result = validateStructuredData({ '@context': 'http://schema.org', '@type': 'Organization', name: 'X' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('@context'))).toBe(true);
  });

  it('fails when @type is missing', () => {
    const result = validateStructuredData({ '@context': 'https://schema.org', name: 'X' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing @type');
  });

  it('reports missing required field for Article (headline, author, datePublished)', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Article',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('headline'))).toBe(true);
    expect(result.errors.some(e => e.includes('author'))).toBe(true);
    expect(result.errors.some(e => e.includes('datePublished'))).toBe(true);
  });

  it('reports missing itemListElement for BreadcrumbList', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('itemListElement'))).toBe(true);
  });

  it('passes a valid FAQPage schema', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'What?', acceptedAnswer: { '@type': 'Answer', text: 'This.' } }],
    });
    expect(result.valid).toBe(true);
  });

  it('passes an unknown @type without required-field errors (no matching template)', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'UnknownType',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails a Product schema with empty name string', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: '',   // empty string is treated as missing
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });
});

describe('validateEntityStructuredData', () => {
  it('returns invalid when jsonLd field is missing', () => {
    const result = validateEntityStructuredData({ title: 'No jsonLd here' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Entity data missing jsonLd field');
  });

  it('delegates to validateStructuredData when jsonLd is present', () => {
    const result = validateEntityStructuredData({
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Test Org',
      },
    });
    expect(result.valid).toBe(true);
  });
});
