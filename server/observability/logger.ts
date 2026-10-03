import { redactSecrets } from '../core/security';
export type LogContext={correlationId?:string;workspaceId?:string;userId?:string;requestId?:string;agentRunId?:string;workflowRunId?:string};
function emit(level:'info'|'warn'|'error',message:string,context:LogContext={},data?:Record<string,unknown>){process.stdout.write(JSON.stringify({timestamp:new Date().toISOString(),level,message,...context,data:redactSecrets(data)})+'\n');}
export const logger={info:(m:string,c?:LogContext,d?:Record<string,unknown>)=>emit('info',m,c,d),warn:(m:string,c?:LogContext,d?:Record<string,unknown>)=>emit('warn',m,c,d),error:(m:string,c?:LogContext,d?:Record<string,unknown>)=>emit('error',m,c,d)};
