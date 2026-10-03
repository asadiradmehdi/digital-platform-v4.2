export type ChannelType = 'instagram'|'telegram'|'tiktok'|'youtube'|'x';
export type SocialContext = { workspaceId: string; channelId: string; correlationId: string; idempotencyKey: string; signal?: AbortSignal };
export interface ChannelAdapter {
  readonly channel: ChannelType;
  getCapabilities(context: SocialContext): Promise<Record<string, boolean>>;
  publish?(input: { text?: string; mediaUrls?: string[] }, context: SocialContext): Promise<{ externalId: string }>;
  analytics?(context: SocialContext): Promise<Record<string, number>>;
}
