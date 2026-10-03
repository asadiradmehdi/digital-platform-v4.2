import { describe,expect,it } from 'vitest';
import { calculateAICost } from './cost-accounting';
describe('AI cost accounting',()=>{it('calculates mixed usage cost',()=>{expect(calculateAICost([{unit:'1K_INPUT_TOKENS',quantity:10n,priceMinor:2n,currency:'USD'},{unit:'1K_OUTPUT_TOKENS',quantity:4n,priceMinor:3n,currency:'USD'}]).totalMinor).toBe(32n);});});
