import { AppError } from '../core/errors';

export type AgentPermission = 'read'|'write'|'financial'|'external_http'|'provider'|'notification'|'knowledge'|'admin';
export type AgentBudget = { maxToolCalls:number; maxRuntimeMs:number; maxEstimatedCostMinor?:bigint; currency?:string };
export type AgentDefinition = {
  id:string; workspaceId:string; active:boolean; permissions:AgentPermission[]; budget:AgentBudget;
};
export type AgentExecutionContext = {
  runId:string; agent:AgentDefinition; startedAt:number; toolCalls:number; estimatedCostMinor:bigint;
};
export type AgentTool = {
  name:string; permissions:AgentPermission[]; sideEffecting?:boolean;
  execute(input:Record<string,unknown>, context:AgentExecutionContext):Promise<unknown>;
};

export function authorizeAgentTool(agent:AgentDefinition, tool:AgentTool) {
  if (!agent.active) throw new AppError('FORBIDDEN','Agent is inactive.');
  const allowed = tool.permissions.every(p => agent.permissions.includes(p));
  if (!allowed) throw new AppError('FORBIDDEN',`Agent is not authorized for ${tool.name}.`,{requiredPermissions:tool.permissions});
}

export async function executeAgentTool(tool:AgentTool, input:Record<string,unknown>, context:AgentExecutionContext, estimatedCostMinor=0n) {
  authorizeAgentTool(context.agent, tool);
  if (context.toolCalls >= context.agent.budget.maxToolCalls) throw new AppError('RATE_LIMITED','Agent tool-call budget exceeded.');
  if (Date.now() - context.startedAt > context.agent.budget.maxRuntimeMs) throw new AppError('RATE_LIMITED','Agent runtime budget exceeded.');
  const nextCost = context.estimatedCostMinor + estimatedCostMinor;
  if (context.agent.budget.maxEstimatedCostMinor !== undefined && nextCost > context.agent.budget.maxEstimatedCostMinor) {
    throw new AppError('PAYMENT_REQUIRED','Agent estimated cost budget exceeded.');
  }
  context.toolCalls += 1;
  context.estimatedCostMinor = nextCost;
  return tool.execute(input, context);
}
