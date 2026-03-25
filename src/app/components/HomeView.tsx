/**
 * Главная страница: Личные сообщения (когда нет серверов).
 * Поиск по @nametag, список ЛС, чат.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Bell, MessageCircle, Search, Settings } from 'lucide-react';
import { ChatView } from './ChatView';
import { UserAvatar } from './UserAvatar';
import * as authApi from '../api/auth';
import * as chatApi from '../api/chat';
import type { Message } from '../models';
import { mapApiMessageToMessage } from '../models';
import type { DMChannel } from '../api/chat';
import { ApiError } from '../api/client';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface HomeViewProps {
  onRefreshToken: () => Promise<boolean>;
  onLogout: () => void;
  onOpenProfile?: () => void;
  onOpenAppSettings?: () => void;
  onOpenNotifications?: () => void;
  currentUserAvatar?: string | null;
  /** На мобильном: видна ли панель серверов (для свайпов) */
  serverPanelVisible?: boolean;
  onServerPanelVisibleChange?: (visible: boolean) => void;
}

const SWIPE_THRESHOLD_PX = 60;

export function HomeView({
  onRefreshToken,
  onLogout,
  onOpenProfile,
  onOpenAppSettings,
  onOpenNotifications,
  currentUserAvatar,
  serverPanelVisible = false,
  onServerPanelVisibleChange,
}: HomeViewProps) {
  const { user, accessToken } = useAuth();
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyState, setHistoryState] = useState<
    Record<string, { cursor: string | null; hasMore: boolean }>
  >({});
  const [loadingDms, setLoadingDms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<authApi.UserSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedChannelRef = useRef<string | null>(null);
  const desiredChannelRef = useRef<string | null>(null);
  const activeDmIdRef = useRef<string | null>(null);
  const lastOpenDmIdRef = useRef<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const loadDmChannels = useCallback(async () => {
    setLoadingDms(true);
    try {
      const list = await chatApi.getDmChannels();
      setDmChannels(list);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await onRefreshToken();
        if (ok) return loadDmChannels();
        onLogout();
      }
      toast.error('Не удалось загрузить чаты');
      setDmChannels([]);
    } finally {
      setLoadingDms(false);
    }
  }, [onRefreshToken, onLogout]);

  useEffect(() => {
    loadDmChannels();
  }, [loadDmChannels]);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.replace(/^@/, '').trim();
    if (!q) {
      setSearchResult(null);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      let u: authApi.UserSearchResult;
      try {
        u = await authApi.searchUserByNametag(q);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await onRefreshToken();
          if (!ok) {
            onLogout();
            return;
          }
          u = await authApi.searchUserByNametag(q);
        } else {
          throw e;
        }
      }
      if (u.id === user?.id) {
        setSearchError('Это вы');
        setSearchResult(null);
      } else {
        setSearchResult(u);
        setSearchError(null);
      }
    } catch (e) {
      setSearchResult(null);
      setSearchError(e instanceof ApiError && e.status === 404 ? 'Пользователь не найден' : 'Ошибка поиска');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, user?.id, onRefreshToken, onLogout]);

  const handleStartDm = useCallback(async (targetUserId: string) => {
    try {
      const dm = await chatApi.createOrGetDm(targetUserId);
      setDmChannels((prev) => {
        const exists = prev.some((c) => c.id === dm.id);
        if (exists) return prev.map((c) => (c.id === dm.id ? dm : c));
        return [dm, ...prev];
      });
      setActiveDmId(dm.id);
      setSearchResult(null);
      setSearchQuery('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await onRefreshToken();
        if (ok) return handleStartDm(targetUserId);
        onLogout();
      }
      toast.error(e instanceof ApiError ? e.message : 'Не удалось создать чат');
    }
  }, [onRefreshToken, onLogout]);

  const activeDm = activeDmId ? dmChannels.find((d) => d.id === activeDmId) : null;

  // WebSocket для DM: подключение
  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        subscribedChannelRef.current = null;
        desiredChannelRef.current = null;
      }
      return;
    }

    let wsBase: string;
    const envUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
    try {
      if (envUrl) {
        const u = new URL(envUrl);
        const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${proto}//${u.host}`;
      } else if (typeof window !== 'undefined') {
        const { protocol, hostname, port } = window.location;
        const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
        const p = port && port !== '80' && port !== '443' ? `:${port}` : '';
        wsBase = `${wsProto}//${hostname}${p}`;
      } else {
        wsBase = 'ws://localhost';
      }
    } catch {
      wsBase = 'ws://localhost';
    }

    const url = `${wsBase}/api/chat/ws?token=${encodeURIComponent(accessToken)}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      const desired = desiredChannelRef.current;
      if (desired) {
        ws.send(JSON.stringify({ action: 'subscribe', channel_id: desired }));
        subscribedChannelRef.current = desired;
      }
    };

    ws.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (
        typeof data === 'object' &&
        data !== null &&
        'event' in data &&
        (data as any).event === 'message.new'
      ) {
        const msg = (data as any).message;
        if (!msg || !msg.id || !msg.channel_id || !msg.user_id || !msg.created_at) return;

        // Интересуют только сообщения текущего активного DM
        const channelId = String(msg.channel_id);
        const currentDmId = activeDmIdRef.current;
        if (currentDmId && channelId !== currentDmId) {
          setUnreadCounts((prev) => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
        }
        if (!currentDmId || channelId !== currentDmId) return;

        const mapped = mapApiMessageToMessage(
          {
            id: String(msg.id),
            channel_id: String(msg.channel_id),
            user_id: String(msg.user_id),
            content: msg.content ?? null,
            attachments: msg.attachments ?? [],
            reply_to: msg.reply_to ?? null,
            created_at: String(msg.created_at),
            edited_at: msg.edited_at ?? null,
            deleted_at: msg.deleted_at ?? null,
            author_username: msg.author_username ?? null,
            author_avatar_url: msg.author_avatar_url ?? null,
          } as any,
          String(msg.channel_id)
        );
        setMessages((prev) => {
          if (prev.some((m) => m.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
      } else if (
        typeof data === 'object' &&
        data !== null &&
        'event' in data &&
        (data as any).event === 'message.deleted'
      ) {
        const messageId = String((data as any).message_id ?? '');
        if (!messageId) return;
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    };

    ws.onclose = () => {
      if (socketRef.current === ws) {
        socketRef.current = null;
        subscribedChannelRef.current = null;
      }
    };

    return () => {
      ws.close();
    };
  }, [accessToken]);

  // Обновляем ref активного DM и сбрасываем счётчик непрочитанных при открытии
  useEffect(() => {
    activeDmIdRef.current = activeDmId;
    if (activeDmId) {
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[activeDmId];
        return next;
      });
    }
  }, [activeDmId]);

  useEffect(() => {
    if (!activeDmId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    chatApi
      .getMessageHistory(activeDmId, 50)
      .then(({ items, nextCursor, hasMore }) => {
        setMessages(items);
        setHistoryState((prev) => ({
          ...prev,
          [activeDmId]: { cursor: nextCursor, hasMore },
        }));
      })
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await onRefreshToken();
          if (ok) {
            await loadDmChannels();
            return;
          }
          onLogout();
        } else {
          toast.error('Не удалось загрузить сообщения');
        }
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
  }, [activeDmId, onRefreshToken, loadDmChannels]);

  const handleLoadMoreMessages = useCallback(async () => {
    if (!activeDmId) return;
    const state = historyState[activeDmId];
    if (!state || !state.hasMore || !state.cursor) return;
    try {
      const { items, nextCursor, hasMore } = await chatApi.getMessageHistory(
        activeDmId,
        50,
        state.cursor
      );
      if (items.length === 0) {
        setHistoryState((prev) => ({
          ...prev,
          [activeDmId]: { cursor: null, hasMore: false },
        }));
        return;
      }
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = items.filter((m) => !existingIds.has(m.id));
        return [...unique, ...prev];
      });
      setHistoryState((prev) => ({
        ...prev,
        [activeDmId]: { cursor: nextCursor, hasMore },
      }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await onRefreshToken();
        if (ok) return handleLoadMoreMessages();
        onLogout();
      }
    }
  }, [activeDmId, historyState, onRefreshToken, onLogout]);

  // Подписка по WebSocket на активный DM‑канал
  useEffect(() => {
    desiredChannelRef.current = activeDmId ?? null;
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const prev = subscribedChannelRef.current;
    if (prev && prev !== activeDmId) {
      try {
        ws.send(JSON.stringify({ action: 'unsubscribe', channel_id: prev }));
      } catch {
        // ignore
      }
    }
    if (activeDmId) {
      try {
        ws.send(JSON.stringify({ action: 'subscribe', channel_id: activeDmId }));
        subscribedChannelRef.current = activeDmId;
      } catch {
        // ignore
      }
    }
  }, [activeDmId]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeDmId || !activeDm) return;
      try {
        const sent = await chatApi.postMessage(activeDmId, content);
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await onRefreshToken();
          if (ok) return handleSendMessage(content);
          onLogout();
        }
        toast.error(e instanceof ApiError ? e.message : 'Не удалось отправить');
      }
    },
    [activeDmId, activeDm, onRefreshToken, onLogout]
  );

  const handleSendVideoCircle = useCallback(
    async (file: Blob, durationMs: number) => {
      if (!activeDmId || !activeDm) return;
      try {
        const sent = await chatApi.postVideoCircleMessage(activeDmId, file, durationMs);
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await onRefreshToken();
          if (ok) return handleSendVideoCircle(file, durationMs);
          onLogout();
        }
        toast.error(e instanceof ApiError ? e.message : 'Не удалось отправить видео');
      }
    },
    [activeDmId, activeDm, onRefreshToken, onLogout]
  );

  const channelForChat = activeDm
    ? {
        id: activeDm.id,
        name: activeDm.other_user.username,
        type: 'dm' as const,
        serverId: '',
      }
    : null;

  const handleBackToDmList = useCallback(() => {
    if (activeDmId) lastOpenDmIdRef.current = activeDmId;
    setActiveDmId(null);
  }, [activeDmId]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || !onServerPanelVisibleChange) return;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    [onServerPanelVisibleChange]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.changedTouches.length !== 1 || !touchStartRef.current || !onServerPanelVisibleChange) return;
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const end = e.changedTouches[0];
      const deltaX = end.clientX - start.x;
      const deltaY = end.clientY - start.y;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;
      if (deltaX > 0) {
        onServerPanelVisibleChange(true);
      } else {
        if (serverPanelVisible) {
          onServerPanelVisibleChange(false);
        } else if (lastOpenDmIdRef.current) {
          setActiveDmId(lastOpenDmIdRef.current);
        }
      }
    },
    [onServerPanelVisibleChange, serverPanelVisible]
  );

  return (
    <div
      className="h-full flex text-white overflow-hidden pb-[max(12px,env(safe-area-inset-bottom))] md:pb-0"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Список DM: на мобильном скрывается при открытом чате; без выбранного чата — тянется на весь экран */}
      <div
        className={`border-r border-white/5 flex-col min-h-0 glass-panel ${
          activeDmId ? 'hidden md:flex w-72 shrink-0' : 'flex w-72 md:w-72 flex-1 min-w-0'
        }`}
      >
        <div className="p-3 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Личные сообщения
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="@nametag"
              className="flex-1 px-3 py-2 rounded-lg glass-input text-white placeholder-gray-500 focus:border-violet-500/50 outline-none text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          {searchError && <p className="text-xs text-red-400 mt-1">{searchError}</p>}
          {searchResult && (
            <button
              type="button"
              onClick={() => handleStartDm(searchResult.id)}
              className="mt-2 p-2 rounded-lg glass flex items-center justify-between w-full text-left hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar avatarUrl={searchResult.avatar_url} size="sm" alt={searchResult.username} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{searchResult.username}</p>
                  <p className="text-xs text-gray-500 truncate">@{searchResult.nametag}</p>
                </div>
              </div>
              <MessageCircle className="w-4 h-4 text-violet-300 flex-shrink-0" />
            </button>
          )}
        </div>

        {/* Список DM — скроллируется, если чаты не помещаются на экран */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loadingDms ? (
            <div className="p-4 text-gray-400 text-sm">Загрузка...</div>
          ) : dmChannels.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">
              Нет диалогов. Найдите пользователя по @nametag
            </div>
          ) : (
            <div className="py-2">
              {dmChannels.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setActiveDmId(dm.id)}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${
                    activeDmId === dm.id ? 'bg-violet-600/20 border-l-2 border-violet-500' : ''
                  }`}
                >
                  <UserAvatar
                    avatarUrl={dm.other_user.avatar_url}
                    alt={dm.other_user.username}
                    size="md"
                  />
                  <div className="min-w-0 flex-1 relative">
                    <p className="font-medium truncate">{dm.other_user.username}</p>
                    {unreadCounts[dm.id] > 0 && (
                      <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-violet-500 text-[11px] font-semibold text-white">
                        {unreadCounts[dm.id] > 99 ? '99+' : unreadCounts[dm.id]}
                      </span>
                    )}
                  </div>
                  <MessageCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User panel (как в ChannelList): профиль, настройки, уведомления */}
        <div className="h-14 px-2 glass-panel border-t border-white/5 flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenProfile}
            className="shrink-0 active:scale-95 transition-transform"
            title="Профиль"
          >
            <UserAvatar avatarUrl={currentUserAvatar} size="sm" alt="" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">Вы</div>
            <div className="text-xs text-green-400 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              В сети
            </div>
          </div>
          <button
            onClick={onOpenAppSettings}
            className="p-1.5 hover:bg-white/10 rounded transition-colors shrink-0"
            title="Настройки приложения"
          >
            <Settings className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
          <button
            onClick={onOpenNotifications}
            className="p-1.5 hover:bg-white/10 rounded transition-colors shrink-0"
            title="Уведомления"
          >
            <Bell className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* На мобильном: без выбранного чата правую колонку не показываем (экран 1 = только серверы + список чатов) */}
      <div
        className={`flex-1 flex flex-col min-h-0 min-w-0 ${
          !channelForChat ? 'hidden md:flex' : ''
        }`}
      >
        {channelForChat ? (
          <>
            <div className="h-12 shrink-0 px-2 md:px-4 flex items-center gap-2 border-b border-white/5 glass">
              <button
                type="button"
                onClick={handleBackToDmList}
                className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Назад к списку чатов"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <MessageCircle className="w-5 h-5 text-violet-400 shrink-0" />
              <h3 className="font-semibold truncate flex-1 min-w-0">{channelForChat.name}</h3>
            </div>
            <ChatView
              channel={channelForChat}
              messages={messages}
              onSendMessage={handleSendMessage}
              onDeleteMessage={(messageId) => setMessages((prev) => prev.filter((m) => m.id !== messageId))}
              onSendVideoCircle={handleSendVideoCircle}
              onLoadMore={handleLoadMoreMessages}
              loading={loadingMessages}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4">
            <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg mb-2">Выберите чат или найдите пользователя</p>
            <p className="text-sm">Введите @nametag в поле поиска</p>
          </div>
        )}
      </div>
    </div>
  );
}
