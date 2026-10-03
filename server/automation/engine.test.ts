import { describe, expect, it } from 'vitest';
import { validateWorkflowForExecution } from './engine';

describe('automation execution guardrails',()=>{
  it('requires explicit allowlist for HTTP actions',()=>{expect(()=>validateWorkflowForExecution({version:1,triggers:[{type:'webhook',config:{}}],steps:[{id:'a',action:{type:'http',config:{url:'https://example.com'}}}]})).toThrow();});
  it('accepts allowlisted HTTP action',()=>{expect(validateWorkflowForExecution({version:1,triggers:[{type:'webhook',config:{}}],steps:[{id:'a',action:{type:'http',config:{allowlist:true}}}]})).toBe(true);});
});
