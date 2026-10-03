import { describe,expect,it } from 'vitest';
import { chooseProvider } from './routing';
describe('provider routing',()=>{it('never chooses unavailable provider',()=>{expect(chooseProvider([{providerId:'a',successRate:1,refundRate:0,latencyMs:1,qualityScore:1,costMinor:1,balanceHealthy:false,available:true},{providerId:'b',successRate:.9,refundRate:.01,latencyMs:10,qualityScore:.9,costMinor:2,balanceHealthy:true,available:true}]).providerId).toBe('b');});});
