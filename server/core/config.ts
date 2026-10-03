import { AppError } from './errors';
export function env(name:string, fallback?:string){const value=process.env[name]??fallback;if(!value)throw new AppError('INTERNAL_ERROR',`Missing required environment variable: ${name}`);return value;}
export function assertProductionConfig(){if(process.env.NODE_ENV!=='production')return;for(const name of ['DATABASE_URL','SECRETS_MASTER_KEY','NEXT_PUBLIC_SITE_URL'])env(name);}
