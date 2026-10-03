import { describe,expect,it } from 'vitest';
import { evaluateRisk } from './risk-engine';
describe('risk engine',()=>{it('moves to review at threshold',()=>{expect(evaluateRisk([{key:'x',score:40,reason:'test'}]).state).toBe('REVIEW');});it('hard blocks',()=>{expect(evaluateRisk([{key:'x',score:1,reason:'test',hardBlock:true}]).state).toBe('RESTRICTED');});});
