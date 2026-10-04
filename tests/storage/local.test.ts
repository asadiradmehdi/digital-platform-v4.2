/**
 * Unit tests for server/storage/local.ts
 * createUpload: URL shape, token structure, expiry, size limit
 * getDownloadUrl: URL shape, token structure
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We use real crypto, just mock Date.now to control expiry
const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

describe('localObjectStorage.createUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a url, key, and expiresAt', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const result = await localObjectStorage.createUpload({
      workspaceId: 'ws-1',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    });
    expect(result.key).toBeTruthy();
    expect(result.url).toBeTruthy();
    expect(result.expiresAt).toBeTruthy();
  });

  it('key is prefixed with workspaceId', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const result = await localObjectStorage.createUpload({
      workspaceId: 'ws-abc',
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
    });
    expect(result.key.startsWith('ws-abc/')).toBe(true);
  });

  it('key contains sanitized filename (special chars replaced with underscore)', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const result = await localObjectStorage.createUpload({
      workspaceId: 'ws-1',
      filename: 'my file (v2).jpg',
      contentType: 'image/jpeg',
      sizeBytes: 100,
    });
    // The filename portion in the key should have spaces and parens replaced
    const keyParts = result.key.split('/');
    const sanitizedFilename = keyParts[keyParts.length - 1];
    expect(sanitizedFilename).not.toContain(' ');
    expect(sanitizedFilename).not.toContain('(');
    expect(sanitizedFilename).not.toContain(')');
  });

  it('url contains base64url-encoded token with key, workspaceId, expiresAt', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const result = await localObjectStorage.createUpload({
      workspaceId: 'ws-token-test',
      filename: 'test.txt',
      contentType: 'text/plain',
      sizeBytes: 10,
    });
    // Extract token from URL
    const url = new URL(result.url, 'http://localhost');
    const tokenParam = url.searchParams.get('token');
    expect(tokenParam).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(tokenParam!, 'base64url').toString('utf8'));
    expect(decoded.workspaceId).toBe('ws-token-test');
    expect(decoded.key).toBe(result.key);
    expect(decoded.expiresAt).toBeTruthy();
  });

  it('expiresAt is 15 minutes from now', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const result = await localObjectStorage.createUpload({
      workspaceId: 'ws-2',
      filename: 'file.txt',
      contentType: 'text/plain',
      sizeBytes: 1,
    });
    const expectedExpiry = new Date(FIXED_NOW + 15 * 60 * 1000).toISOString();
    expect(result.expiresAt).toBe(expectedExpiry);
  });

  it('throws when file exceeds 50 MB limit', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const TOO_BIG = 50 * 1024 * 1024 + 1;
    await expect(
      localObjectStorage.createUpload({
        workspaceId: 'ws-1',
        filename: 'big.bin',
        contentType: 'application/octet-stream',
        sizeBytes: TOO_BIG,
      })
    ).rejects.toThrow('50');
  });

  it('accepts file of exactly 50 MB (boundary)', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const EXACTLY_50MB = 50 * 1024 * 1024;
    await expect(
      localObjectStorage.createUpload({
        workspaceId: 'ws-1',
        filename: 'boundary.bin',
        contentType: 'application/octet-stream',
        sizeBytes: EXACTLY_50MB,
      })
    ).resolves.toBeTruthy();
  });
});

describe('localObjectStorage.getDownloadUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a URL with a base64url token containing the key', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const url = await localObjectStorage.getDownloadUrl('ws-1/uuid/file.txt');
    expect(url).toContain('token=');
    const parsed = new URL(url, 'http://localhost');
    const token = parsed.searchParams.get('token');
    const decoded = JSON.parse(Buffer.from(token!, 'base64url').toString('utf8'));
    expect(decoded.key).toBe('ws-1/uuid/file.txt');
  });

  it('download token expiresAt is 1 hour from now', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    const url = await localObjectStorage.getDownloadUrl('ws-1/uuid/file.txt');
    const parsed = new URL(url, 'http://localhost');
    const token = parsed.searchParams.get('token');
    const decoded = JSON.parse(Buffer.from(token!, 'base64url').toString('utf8'));
    const expectedExpiry = new Date(FIXED_NOW + 60 * 60 * 1000).toISOString();
    expect(decoded.expiresAt).toBe(expectedExpiry);
  });
});

describe('localObjectStorage.delete', () => {
  it('resolves without error (local no-op)', async () => {
    const { localObjectStorage } = await import('../../server/storage/local');
    await expect(localObjectStorage.delete('ws-1/uuid/file.txt')).resolves.toBeUndefined();
  });
});
