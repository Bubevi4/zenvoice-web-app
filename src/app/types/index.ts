/**
 * Типы, соответствующие API бэкенда.
 * Server, Channel — из Chat API; Message — из Messages API с маппингом для UI.
 */

export interface Server {
  id: string;
  name: string;
  icon?: string;
  icon_url?: string | null;
  color?: string;
}

export interface Channel {
  id: string;
  name: string | null;
  type: 'text' | 'voice' | 'dm';
  serverId: string;
  server_id?: string | null;
  category?: string;
  position?: number;
}

export type MessageAttachment =
  | {
      type: 'video_circle';
      bucket: string;
      key: string;
      url: string | null;
      duration_ms: number;
      mime_type: string;
      target_height?: number;
      target_fps?: number;
    }
  | {
      // запасной вариант для будущих типов вложений
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };

/** Статус автора с бэкенда (по last_seen и privacy_settings). */
export type AuthorPresence = 'online' | 'offline' | 'dnd';

export interface Message {
  id: string;
  channelId: string;
  channel_id?: string;
  userId: string;
  user_id?: string;
  userName?: string;
  userAvatar?: string;
  /** Тег @nametag из API сообщений */
  userNametag?: string;
  /** Расчёт на сервере */
  userPresence?: AuthorPresence;
  content: string | null;
  timestamp: Date;
  created_at?: string;
  attachments?: MessageAttachment[];
  reply_to?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
}

export interface VoiceUser {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

/** Ответ API: список серверов */
export type ServersResponse = Server[];

/** Ответ API: список каналов */
export type ChannelsResponse = Channel[];

/** Ответ API: история сообщений */
export interface MessageHistoryResponse {
  items: Array<{
    id: string;
    channel_id: string;
    user_id: string;
    content: string | null;
    attachments?: unknown[];
    reply_to?: string | null;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    author_username?: string | null;
    author_avatar_url?: string | null;
    author_nametag?: string | null;
    author_presence?: string | null;
  }>;
  next_cursor?: string | null;
  has_more?: boolean;
}

function parseAuthorPresence(s: string | null | undefined): AuthorPresence | undefined {
  if (s === 'online' || s === 'offline' || s === 'dnd') return s;
  return undefined;
}

/** Преобразование сообщения из API в формат UI (ник и аватар из author_* или emoji: префикса). */
export function mapApiMessageToMessage(
  item: MessageHistoryResponse['items'][0],
  channelId: string
): Message {
  const avatarUrl = item.author_avatar_url ?? undefined;
  const userAvatar =
    avatarUrl?.startsWith('emoji:') ? avatarUrl.slice(6) : (avatarUrl ?? undefined);
  return {
    id: item.id,
    channelId: channelId,
    userId: item.user_id,
    userName: item.author_username ?? undefined,
    userNametag: item.author_nametag ?? undefined,
    userPresence: parseAuthorPresence(item.author_presence ?? undefined),
    userAvatar,
    content: item.content,
    timestamp: new Date(item.created_at),
    created_at: item.created_at,
    attachments: item.attachments,
    reply_to: item.reply_to,
    edited_at: item.edited_at,
    deleted_at: item.deleted_at,
  };
}

/** Нормализация сервера из API (icon_url -> icon для UI) */
export function mapApiServerToServer(s: { id: string; name: string; icon_url?: string | null }): Server {
  return {
    id: String(s.id),
    name: s.name,
    icon: s.icon_url ?? '🏠',
    icon_url: s.icon_url ?? null,
    color: '#7c3aed',
  };
}

/** Нормализация канала из API */
export function mapApiChannelToChannel(
  c: { id: string; server_id?: string | null; type: string; name: string | null; position?: number }
): Channel {
  return {
    id: String(c.id),
    name: c.name ?? '',
    type: c.type as Channel['type'],
    serverId: c.server_id ? String(c.server_id) : '',
    server_id: c.server_id,
    position: c.position ?? 0,
  };
}
