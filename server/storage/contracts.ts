export type PresignedUpload={key:string;url:string;expiresAt:string};
export interface ObjectStorage{createUpload(input:{workspaceId:string;filename:string;contentType:string;sizeBytes:number}):Promise<PresignedUpload>;delete(key:string):Promise<void>;getDownloadUrl(key:string):Promise<string>;}
