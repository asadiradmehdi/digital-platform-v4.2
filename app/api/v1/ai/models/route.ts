import { NextRequest } from 'next/server';
import { query } from '../../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
export async function GET(request:NextRequest){const id=correlationId(request);try{const r=await query(`SELECT m.id,m.model_key AS "modelKey",m.display_name AS "displayName",m.capabilities,m.context_limit AS "contextLimit",p.name AS provider FROM ai_models m JOIN ai_providers p ON p.id=m.ai_provider_id WHERE m.active=true AND p.status='ACTIVE' ORDER BY m.display_name`);return json({items:r.rows},{correlationId:id});}catch(e){return handleRouteError(e,id);}}
