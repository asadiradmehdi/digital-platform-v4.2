import { query } from './db';
import { AppError } from './errors';

export async function recordWebhook(input: { source:string; eventId:string; eventType:string; signatureValid:boolean; payload:unknown }) {
  if (!input.signatureValid) throw new AppError('UNAUTHORIZED','Invalid webhook signature.');
  const result = await query<{id:string; inserted:boolean}>(
    `INSERT INTO webhook_events(source,event_id,event_type,signature_valid,payload) VALUES($1,$2,$3,true,$4)
     ON CONFLICT(source,event_id) DO NOTHING RETURNING id`,
    [input.source,input.eventId,input.eventType,input.payload],
  );
  return { accepted: Boolean(result.rows[0]), duplicate: !result.rows[0] };
}
