export type WorkflowTrigger = { type: 'webhook'|'schedule'|'order_event'|'payment_event'|'subscription_event'; config: Record<string, unknown> };
export type WorkflowAction = { type: 'ai'|'notification'|'http'|'provider'|'branch'|'delay'; config: Record<string, unknown> };
export type WorkflowDefinition = { version: number; triggers: WorkflowTrigger[]; steps: Array<{ id: string; action: WorkflowAction; next?: string[] }> };
export function validateWorkflow(definition: WorkflowDefinition) {
  if (definition.version < 1 || definition.steps.length === 0) throw new Error('Workflow must have a version and at least one step.');
  const ids = new Set<string>(); for (const step of definition.steps) { if (ids.has(step.id)) throw new Error(`Duplicate workflow step: ${step.id}`); ids.add(step.id); }
  for (const step of definition.steps) for (const next of step.next ?? []) if (!ids.has(next)) throw new Error(`Unknown workflow target: ${next}`);
  return true;
}
