import { describe, expect, it } from 'vitest';
import { assertSafeOutboundUrl } from '../../server/core/security';

describe('SSRF guard — assertSafeOutboundUrl', () => {
  // Private IPv4 ranges
  it('blocks 127.x loopback', () => {
    expect(() => assertSafeOutboundUrl('https://127.0.0.1')).toThrow();
    expect(() => assertSafeOutboundUrl('https://127.0.0.100')).toThrow();
  });

  it('blocks 10.x private range', () => {
    expect(() => assertSafeOutboundUrl('https://10.0.0.1')).toThrow();
    expect(() => assertSafeOutboundUrl('https://10.255.255.255')).toThrow();
  });

  it('blocks 172.16-31.x private range', () => {
    expect(() => assertSafeOutboundUrl('https://172.16.0.1')).toThrow();
    expect(() => assertSafeOutboundUrl('https://172.31.255.255')).toThrow();
  });

  it('does not block 172.15.x or 172.32.x (outside private range)', () => {
    // These are public IPs; no throw expected (unless you have no allowlist)
    expect(() => assertSafeOutboundUrl('https://172.15.0.1')).not.toThrow();
    expect(() => assertSafeOutboundUrl('https://172.32.0.1')).not.toThrow();
  });

  it('blocks 192.168.x private range', () => {
    expect(() => assertSafeOutboundUrl('https://192.168.1.1')).toThrow();
    expect(() => assertSafeOutboundUrl('https://192.168.0.0')).toThrow();
  });

  // AWS/GCP metadata endpoint
  it('blocks 169.254.x link-local / metadata', () => {
    expect(() => assertSafeOutboundUrl('https://169.254.169.254')).toThrow();
    expect(() => assertSafeOutboundUrl('https://169.254.0.1')).toThrow();
  });

  // Blocked hostnames
  it('blocks localhost hostname', () => {
    expect(() => assertSafeOutboundUrl('https://localhost')).toThrow();
    expect(() => assertSafeOutboundUrl('https://localhost/api')).toThrow();
  });

  it('blocks metadata.google.internal', () => {
    expect(() => assertSafeOutboundUrl('https://metadata.google.internal')).toThrow();
  });

  it('blocks host.docker.internal', () => {
    expect(() => assertSafeOutboundUrl('https://host.docker.internal')).toThrow();
  });

  // IPv6 private ranges
  it('blocks ::1 loopback IPv6', () => {
    expect(() => assertSafeOutboundUrl('https://[::1]')).toThrow();
  });

  it('blocks fd00::/8 unique-local IPv6 (ULA)', () => {
    expect(() => assertSafeOutboundUrl('https://[fd00::1]')).toThrow();
    expect(() => assertSafeOutboundUrl('https://[fd12:3456::1]')).toThrow();
  });

  it('blocks fc00::/7 unique-local IPv6', () => {
    expect(() => assertSafeOutboundUrl('https://[fc00::1]')).toThrow();
  });

  // URL credentials
  it('blocks URLs with embedded credentials', () => {
    expect(() => assertSafeOutboundUrl('https://user:pass@example.com')).toThrow();
    expect(() => assertSafeOutboundUrl('https://admin@example.com')).toThrow();
  });

  // Protocol enforcement
  it('blocks non-HTTPS URLs', () => {
    expect(() => assertSafeOutboundUrl('http://example.com')).toThrow();
    expect(() => assertSafeOutboundUrl('ftp://example.com')).toThrow();
  });

  it('blocks invalid URLs', () => {
    expect(() => assertSafeOutboundUrl('not-a-url')).toThrow();
    expect(() => assertSafeOutboundUrl('')).toThrow();
  });

  // Allowlist enforcement
  it('allows public HTTPS URLs without an allowlist', () => {
    const url = assertSafeOutboundUrl('https://api.example.com/v1');
    expect(url.hostname).toBe('api.example.com');
  });

  it('enforces allowlist when provided — rejects non-listed host', () => {
    expect(() => assertSafeOutboundUrl('https://evil.com', ['api.example.com'])).toThrow();
  });

  it('enforces allowlist when provided — allows listed host', () => {
    const url = assertSafeOutboundUrl('https://api.example.com/v1', ['api.example.com']);
    expect(url.hostname).toBe('api.example.com');
  });

  it('enforces allowlist — allows subdomain match', () => {
    const url = assertSafeOutboundUrl('https://sub.api.example.com/v1', ['api.example.com']);
    expect(url.hostname).toBe('sub.api.example.com');
  });
});
