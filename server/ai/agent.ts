import { AppError } from '../core/errors';
export type AgentTool = { name:string; scopes:string[]; execute(input:Record<string,unknown>):Promise<unknown> };
export class AgentToolExecutor {
  constructor(private readonly tools:AgentTool[]){}
  async execute(toolName:string,input:Record<string,unknown>,grantedScopes:string[]){const tool=this.tools.find(t=>t.name===toolName);if(!tool)throw new AppError('NOT_FOUND',`Tool ${toolName} not found.`);const allowed=tool.scopes.every(scope=>grantedScopes.includes(scope));if(!allowed)throw new AppError('FORBIDDEN',`Agent is not authorized for ${toolName}.`,{requiredScopes:tool.scopes});return tool.execute(input);}
}
