import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession } from '../../../../../server/identity/sessions';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { SESSION_COOKIE_NAME, clearSessionCookie } from '../../../../../server/identity/session-cookie';
export async function POST(request:NextRequest){const id=correlationId(request);try{assertSameOrigin(request);const store=await cookies();const name=SESSION_COOKIE_NAME;const token=store.get(name)?.value;if(token)await revokeSession(token);const response=json({ok:true},{correlationId:id});clearSessionCookie(response);return response;}catch(e){return handleRouteError(e,id);}}
