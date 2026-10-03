import { describe, expect, it } from 'vitest';
import { executeAgentTool, type AgentTool } from './agent-framework';

describe('agent execution guardrails',()=>{
  const tool:AgentTool={name:'refund',permissions:['financial'],sideEffecting:true,execute:async()=>({ok:true})};
  it('requires permission',async()=>{const c:any={runId:'r',startedAt:Date.now(),toolCalls:0,estimatedCostMinor:0n,agent:{id:'a',workspaceId:'w',active:true,permissions:['read'],budget:{maxToolCalls:2,maxRuntimeMs:1000}}};await expect(executeAgentTool(tool,{},c)).rejects.toThrow();});
  it('enforces tool-call budget',async()=>{const c:any={runId:'r',startedAt:Date.now(),toolCalls:1,estimatedCostMinor:0n,agent:{id:'a',workspaceId:'w',active:true,permissions:['financial'],budget:{maxToolCalls:1,maxRuntimeMs:1000}}};await expect(executeAgentTool(tool,{},c)).rejects.toThrow();});
});
