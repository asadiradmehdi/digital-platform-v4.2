import { describe, expect, it } from 'vitest';
import { assertOrderTransition, canTransitionOrder } from '../server/core/order-state';
import { addMoney, subtractMoney, money } from '../server/core/money';
import { validateWorkflow } from '../server/automation/contracts';

describe('domain invariants',()=>{
  it('accepts only legal order transitions',()=>{expect(canTransitionOrder('PAID','QUEUED')).toBe(true);expect(canTransitionOrder('COMPLETED','PROCESSING')).toBe(false);expect(()=>assertOrderTransition('COMPLETED','PROCESSING')).toThrow();});
  it('uses minor-unit integer money',()=>{const a=money(1000n,'IRR'),b=money(250n,'IRR');expect(addMoney(a,b).amountMinor).toBe(1250n);expect(subtractMoney(a,b).amountMinor).toBe(750n);});
  it('rejects broken workflow graphs',()=>{expect(()=>validateWorkflow({version:1,triggers:[{type:'webhook',config:{}}],steps:[{id:'a',action:{type:'http',config:{}},next:['missing']}]})).toThrow();});
});
