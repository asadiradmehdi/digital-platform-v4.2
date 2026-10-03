import { describe, expect, it } from 'vitest';
import { assertSafeOutboundUrl, redactSecrets } from './security';

describe('security hardening',()=>{
  it('blocks SSRF-style private destinations',()=>{
    expect(()=>assertSafeOutboundUrl('http://127.0.0.1')).toThrow();
    expect(()=>assertSafeOutboundUrl('https://10.0.0.2')).toThrow();
    expect(()=>assertSafeOutboundUrl('https://[::1]')).toThrow();
    expect(()=>assertSafeOutboundUrl('https://[fd00::1]')).toThrow();
    expect(()=>assertSafeOutboundUrl('https://user:pass@example.com')).toThrow();
  });
  it('requires HTTPS and allowlist when configured',()=>{
    expect(()=>assertSafeOutboundUrl('https://example.com',['api.example.com'])).toThrow();
    expect(assertSafeOutboundUrl('https://api.example.com/v1',['api.example.com']).hostname).toBe('api.example.com');
  });
  it('redacts sensitive log fields recursively',()=>{expect(redactSecrets({token:'abc',nested:{password:'x'},safe:'ok'})).toEqual({token:'[REDACTED]',nested:{password:'[REDACTED]'},safe:'ok'});});
});
