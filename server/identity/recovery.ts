import { randomBytes, createHash } from 'node:crypto';
import { query } from '../core/db';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function issueRecoveryCodes(userId:string,count=10){const codes:string[]=[];for(let i=0;i<count;i++){const raw=randomBytes(5).toString('hex').toUpperCase();codes.push(raw);await query(`INSERT INTO recovery_codes(user_id,code_hash) VALUES($1,$2)`,[userId,hash(raw)]);}return codes;}
export async function consumeRecoveryCode(userId:string,code:string){const r=await query<{id:string}>(`SELECT id FROM recovery_codes WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL`,[userId,hash(code)]);if(!r.rows[0])return false;await query(`UPDATE recovery_codes SET used_at=now() WHERE id=$1`,[r.rows[0].id]);return true;}
