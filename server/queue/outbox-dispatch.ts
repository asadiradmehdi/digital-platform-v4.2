import { query } from '../core/db';
export async function claimOutboxBatch(limit=50){return query(`WITH claimed AS (SELECT id FROM outbox_events WHERE published_at IS NULL ORDER BY occurred_at FOR UPDATE SKIP LOCKED LIMIT $1) SELECT o.* FROM outbox_events o JOIN claimed c ON c.id=o.id`,[limit]);}
export async function markOutboxPublished(id:string){await query(`UPDATE outbox_events SET published_at=now() WHERE id=$1 AND published_at IS NULL`,[id]);}
export async function markOutboxFailed(id:string,error:string){await query(`UPDATE outbox_events SET attempts=attempts+1,last_error=$2 WHERE id=$1`,[id,error.slice(0,2000)]);}
