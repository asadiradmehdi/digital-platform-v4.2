import { randomUUID } from 'node:crypto';
import type { ObjectStorage, PresignedUpload } from './contracts';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function storageBaseUrl(): string {
  return process.env.STORAGE_BASE_URL ?? 'http://localhost:3000/api/v1/storage';
}

function storageSecret(): string {
  return process.env.STORAGE_SECRET ?? 'dev-storage-secret';
}

export const localObjectStorage: ObjectStorage = {
  async createUpload(input: { workspaceId: string; filename: string; contentType: string; sizeBytes: number }): Promise<PresignedUpload> {
    if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
    }
    const key = `${input.workspaceId}/${randomUUID()}/${input.filename.replace(/[^a-z0-9._-]/gi, '_')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const token = Buffer.from(JSON.stringify({ key, workspaceId: input.workspaceId, expiresAt })).toString('base64url');
    const url = `${storageBaseUrl()}/upload?token=${token}&secret=${storageSecret().slice(0, 8)}`;
    return { key, url, expiresAt };
  },

  async delete(key: string): Promise<void> {
    // In production, call S3/R2 DeleteObject; locally, no-op
    void key;
  },

  async getDownloadUrl(key: string): Promise<string> {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const token = Buffer.from(JSON.stringify({ key, expiresAt })).toString('base64url');
    return `${storageBaseUrl()}/download?token=${token}`;
  },
};
