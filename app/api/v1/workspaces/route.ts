import { NextRequest } from 'next/server';
import { query } from '../../../../server/core/db';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
export async function GET(request:NextRequest){const id=correlationId(request);try{const userId=await requireRequestUser(request);const r=await query(`SELECT w.id,w.name,w.slug,w.status,wm.status AS "memberStatus" FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=$1 AND wm.status='ACTIVE' ORDER BY w.created_at DESC`,[userId]);return json({items:r.rows},{correlationId:id});}catch(e){return handleRouteError(e,id);}}
