import { randomBytes, createHash } from 'node:crypto';
export const generateSecret=(bytes=32)=>randomBytes(bytes).toString('base64url');
export const hashSecret=(secret:string)=>createHash('sha256').update(secret).digest('hex');
