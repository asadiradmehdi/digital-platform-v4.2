import { query } from './db';
export async function enqueueEvent(input: { aggregateType: string; aggregateId: string; eventType: string; payload: Record<string, unknown> }) {
  const result = await query<{ id: string }>(`INSERT INTO outbox_events(aggregate_type, aggregate_id, event_type, payload) VALUES($1,$2,$3,$4) RETURNING id`, [input.aggregateType, input.aggregateId, input.eventType, input.payload]);
  return result.rows[0].id;
}
