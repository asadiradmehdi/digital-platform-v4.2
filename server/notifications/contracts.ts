export type NotificationMessage={subject?:string;body:string;recipient:string;metadata?:Record<string,unknown>};
export interface NotificationAdapter{readonly channel:'email'|'sms'|'push'|'telegram';send(message:NotificationMessage):Promise<{providerReference:string}>;}
