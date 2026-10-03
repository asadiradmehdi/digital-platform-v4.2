import { AppError } from '../core/errors';
import { validateWorkflow, type WorkflowDefinition, type WorkflowAction } from './contracts';

export type WorkflowRunState = 'QUEUED'|'RUNNING'|'WAITING'|'COMPLETED'|'FAILED'|'CANCELLED';
export type ActionExecutor = (action:WorkflowAction, input:Record<string,unknown>)=>Promise<Record<string,unknown>>;
export type WorkflowRunContext = { runId:string; workspaceId:string; startedAt:number; maxSteps:number; stepsExecuted:number };

export function validateWorkflowForExecution(definition:WorkflowDefinition, limits={maxSteps:100,maxDelayMs:86_400_000}) {
  validateWorkflow(definition);
  if (definition.steps.length > limits.maxSteps) throw new AppError('VALIDATION_ERROR','Workflow exceeds maximum step count.');
  for (const step of definition.steps) {
    if (step.action.type === 'delay') {
      const ms = Number(step.action.config.ms);
      if (!Number.isSafeInteger(ms) || ms < 0 || ms > limits.maxDelayMs) throw new AppError('VALIDATION_ERROR','Workflow delay is outside the allowed range.');
    }
    if (step.action.type === 'http' && step.action.config.allowlist !== true) {
      throw new AppError('FORBIDDEN','HTTP workflow actions require an explicit destination allowlist.');
    }
  }
  return true;
}

export async function executeWorkflow(definition:WorkflowDefinition, input:Record<string,unknown>, executor:ActionExecutor, context:WorkflowRunContext) {
  validateWorkflowForExecution(definition);
  const byId = new Map(definition.steps.map(s=>[s.id,s]));
  let current = definition.steps[0];
  if (!current) throw new AppError('VALIDATION_ERROR','Workflow must contain at least one step.');
  let data = {...input};
  while (current) {
    if (context.stepsExecuted >= context.maxSteps) throw new AppError('RATE_LIMITED','Workflow execution step budget exceeded.');
    context.stepsExecuted += 1;
    const result = await executor(current.action,data);
    data = {...data,...result};
    const nextId = current.next?.[0];
    if (!nextId) break;
    const next = byId.get(nextId);
    if (!next) throw new AppError('INTERNAL_ERROR','Workflow target disappeared during execution.');
    current = next;
  }
  return data;
}
