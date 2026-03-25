/**
 * API чата: серверы, каналы, сообщения.
 */

import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './client';
import type {
  Server,
  Channel,
  MessageHistoryResponse,
  Message,
} from '../types';
import type { UserProfile } from '../models/user';
import {
  mapApiServerToServer,
  mapApiChannelToChannel,
  mapApiMessageToMessage,
} from '../types';

const CHAT_PREFIX = '/api/chat';

export async function getServers(): Promise<Server[]> {
  const list = await apiGet<Array<{ id: string; name: string; icon_url?: string | null }>>(
    `${CHAT_PREFIX}/servers`
  );
  return list.map(mapApiServerToServer);
}

export async function createServer(name: string, iconUrl?: string | null): Promise<Server> {
  const raw = await apiPost<{ id: string; name: string; icon_url?: string | null }>(
    `${CHAT_PREFIX}/servers`,
    { name: name.trim(), icon_url: iconUrl ?? undefined }
  );
  return mapApiServerToServer(raw);
}

export async function getChannelsByServer(serverId: string): Promise<Channel[]> {
  const list = await apiGet<Array<{
    id: string;
    server_id: string | null;
    type: string;
    name: string | null;
    position?: number;
  }>>(`${CHAT_PREFIX}/channels/server/${serverId}`);
  return list.map((c) => mapApiChannelToChannel({ ...c, server_id: c.server_id ?? serverId }));
}

export async function createChannel(
  serverId: string,
  type: 'text' | 'voice',
  name: string
): Promise<Channel> {
  const raw = await apiPost<{
    id: string;
    server_id: string | null;
    type: string;
    name: string | null;
    position?: number;
  }>(`${CHAT_PREFIX}/channels/server/${serverId}`, {
    type,
    name,
  });
  return mapApiChannelToChannel({
    ...raw,
    server_id: raw.server_id ?? serverId,
  });
}

export async function createServerInvite(serverId: string): Promise<{ token: string; expires_at?: string | null }> {
  const raw = await apiPost<{ token: string; expires_at?: string | null }>(
    `${CHAT_PREFIX}/invites/servers/${serverId}`
  );
  return { token: raw.token, expires_at: raw.expires_at ?? null };
}

export async function getInviteInfo(token: string): Promise<{
  token: string;
  server_id: string;
  name: string;
  icon_url?: string | null;
  description?: string | null;
  members_count: number;
}> {
  const raw = await apiGet<{
    token: string;
    server_id: string;
    name: string;
    icon_url?: string | null;
    description?: string | null;
    members_count: number;
  }>(`${CHAT_PREFIX}/invites/${encodeURIComponent(token)}`);
  return raw;
}

export async function joinByInvite(token: string): Promise<Server> {
  const raw = await apiPost<{ id: string; name: string; icon_url?: string | null }>(
    `${CHAT_PREFIX}/invites/${encodeURIComponent(token)}/join`
  );
  return mapApiServerToServer(raw);
}

export async function getChannel(channelId: string): Promise<Channel> {
  const c = await apiGet<{
    id: string;
    server_id: string | null;
    type: string;
    name: string | null;
    position?: number;
  }>(`${CHAT_PREFIX}/channels/${channelId}`);
  return mapApiChannelToChannel({
    ...c,
    server_id: c.server_id ?? undefined,
  });
}

export async function updateChannel(channelId: string, name: string): Promise<Channel> {
  const raw = await apiPatch<{
    id: string;
    server_id: string | null;
    type: string;
    name: string | null;
    position?: number;
  }>(`${CHAT_PREFIX}/channels/${channelId}`, { name: name.trim() });
  return mapApiChannelToChannel({
    ...raw,
    server_id: raw.server_id ?? undefined,
  });
}

export async function deleteChannel(channelId: string): Promise<void> {
  await apiDelete(`${CHAT_PREFIX}/channels/${channelId}`);
}

export async function getMessageHistory(
  channelId: string,
  limit = 50,
  before?: string
): Promise<{ items: Message[]; nextCursor: string | null; hasMore: boolean }> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (before) params.set('before', before);
  const url = `${CHAT_PREFIX}/messages/channels/${channelId}/history?${params}`;
  const res = await apiGet<MessageHistoryResponse>(url);
  const items = (res.items ?? []).map((item) =>
    mapApiMessageToMessage(item, channelId)
  );
  return {
    items,
    nextCursor: res.next_cursor ?? null,
    hasMore: res.has_more ?? false,
  };
}

export interface DMChannel {
  id: string;
  type: 'dm';
  name: string | null;
  server_id: string | null;
  position: number;
  other_user: UserProfile;
}

export async function getDmChannels(): Promise<DMChannel[]> {
  const list = await apiGet<DMChannel[]>(`${CHAT_PREFIX}/dm/channels`);
  return list;
}

export async function createOrGetDm(targetUserId: string): Promise<DMChannel> {
  const ch = await apiPost<DMChannel>(`${CHAT_PREFIX}/dm/channels`, {
    target_user_id: targetUserId,
  });
  return ch;
}

export async function postMessage(channelId: string, content: string): Promise<Message> {
  const raw = await apiPost<{
    id: string;
    channel_id: string;
    user_id: string;
    content: string | null;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    attachments?: unknown[];
    reply_to?: string | null;
    author_username?: string | null;
    author_avatar_url?: string | null;
  }>(`${CHAT_PREFIX}/messages/channels/${channelId}/messages`, {
    content,
    attachments: [],
  });
  return mapApiMessageToMessage(
    {
      ...raw,
      created_at: raw.created_at,
    },
    channelId
  );
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiDelete(`${CHAT_PREFIX}/messages/${messageId}`);
}

export async function postVideoCircleMessage(
  channelId: string,
  file: Blob,
  durationMs: number
): Promise<Message> {
  const form = new FormData();
  const type = file.type || '';
  let extension = 'webm';
  if (type.includes('mp4')) {
    extension = 'mp4';
  } else if (type.includes('quicktime') || type.includes('mov')) {
    extension = 'mov';
  }
  form.append('file', file, `video-circle.${extension}`);
  form.append('duration_ms', String(Math.max(0, Math.floor(durationMs))));

  const raw = await apiPostForm<{
    id: string;
    channel_id: string;
    user_id: string;
    content: string | null;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    attachments?: unknown[];
    reply_to?: string | null;
    author_username?: string | null;
    author_avatar_url?: string | null;
  }>(`${CHAT_PREFIX}/messages/channels/${channelId}/video-circle`, form);

  return mapApiMessageToMessage(
    {
      ...raw,
      created_at: raw.created_at,
    },
    channelId
  );
}

export async function postAttachments(
  channelId: string,
  files: File[],
  content?: string
): Promise<Message> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  if (content && content.trim()) {
    form.append('content', content.trim());
  }

  const raw = await apiPostForm<{
    id: string;
    channel_id: string;
    user_id: string;
    content: string | null;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    attachments?: unknown[];
    reply_to?: string | null;
    author_username?: string | null;
    author_avatar_url?: string | null;
  }>(`${CHAT_PREFIX}/messages/channels/${channelId}/attachments`, form);

  return mapApiMessageToMessage(
    {
      ...raw,
      created_at: raw.created_at,
    },
    channelId
  );
}
