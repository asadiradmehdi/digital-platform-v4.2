export type Job<T=unknown>={id:string;type:string;payload:T;attempt:number;availableAt:string};
export interface JobQueue{enqueue<T>(type:string,payload:T,options?:{delayMs?:number;dedupeKey?:string}):Promise<string>;dequeue<T>(types?:string[]):Promise<Job<T>|null>;ack(jobId:string):Promise<void>;fail(jobId:string,error:string,retryAt?:string):Promise<void>;}
