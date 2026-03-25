import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ServerList, HOME_SERVER_ID } from './components/ServerList';
import { ChannelList } from './components/ChannelList';
import { ChatView } from './components/ChatView';
import { VoiceChannelView } from './components/VoiceChannelView';
import { MobileHeader } from './components/MobileHeader';
import { MobileDrawer } from './components/MobileDrawer';
import { LoginView } from './components/LoginView';
import { HomeView } from './components/HomeView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { AppSettingsView } from './components/AppSettingsView';
import { NotificationsView } from './components/NotificationsView';
import { CreateServerModal } from './components/CreateServerModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { ServerInviteModal } from './components/ServerInviteModal';
import { ServerInviteView } from './components/ServerInviteView';
import { ServerSettingsView } from './components/ServerSettingsView';
import { LandingView } from './components/LandingView';
import { useAuth } from './contexts/AuthContext';
import { VoiceConnection } from './voice/mediasoupClient';
import * as chatApi from './api/chat';
import * as mediaApi from './api/media';
import type { Server, Channel, Message, VoiceUser } from './models';
import { mapApiMessageToMessage } from './models';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { ApiError } from './api/client';
import { useIsMobile } from './components/ui/use-mobile';



export default function App() {
  const { accessToken, user, logout, refreshAccessToken } = useAuth();
  const isMobile = useIsMobile();
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageHistoryState, setMessageHistoryState] = useState<
    Record<string, { cursor: string | null; hasMore: boolean }>
  >({});
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  /** На экране DMs на мобильном: показывать ли панель серверов (свайп вправо открывает) */
  const [homeServerPanelVisible, setHomeServerPanelVisible] = useState(false);
  const [createServerModalOpen, setCreateServerModalOpen] = useState(false);
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);
  const [createChannelServerId, setCreateChannelServerId] = useState<string | null>(null);
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice'>('text');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteServerId, setInviteServerId] = useState<string | null>(null);
  type Overlay =
    | { kind: 'profile' }
    | { kind: 'appSettings' }
    | { kind: 'notifications' }
    | { kind: 'serverSettings'; serverId: string }
    | { kind: 'inviteJoin'; token: string };

  const [overlayStack, setOverlayStack] = useState<Overlay[]>([]);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadChannelCounts, setUnreadChannelCounts] = useState<Record<string, number>>({});
  const [voiceUsersByChannel, setVoiceUsersByChannel] = useState<Record<string, VoiceUser[]>>({});
  const [voiceConnectingChannelId, setVoiceConnectingChannelId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const activeChannelIdRef = useRef<string | null>(null);
  const subscribedChannelRef = useRef<string | null>(null);
  const desiredChannelRef = useRef<string | null>(null);
  const activeVoiceConnectionRef = useRef<import('./voice/mediasoupClient').VoiceConnection | null>(null);
  const voiceEventUnsubsRef = useRef<Array<() => void>>([]);
  const voiceHeartbeatRef = useRef<number | null>(null);
  const voiceRecoveryInProgressRef = useRef(false);
  const voiceRecoveryAttemptsRef = useRef(0);

  const mapVoicePeersToVoiceUsers = useCallback(
    (peers: Array<{ id: string; userId?: string; username?: string }>): VoiceUser[] => {
      if (!user) return [];
      const byUser: Record<string, VoiceUser> = {};
      for (const p of peers) {
        const key = p.userId ?? p.id;
        const isSelf = p.userId === user.id;
        byUser[key] = {
          id: p.id,
          userId: p.userId,
          name: isSelf ? user.nametag ?? user.username : p.username ?? 'Участник',
          avatar: isSelf ? user.avatar_url ?? '🎧' : '🎧',
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
        };
      }
      return Object.values(byUser);
    },
    [user]
  );

  const currentOverlay = overlayStack.length > 0 ? overlayStack[overlayStack.length - 1] : null;
  const pushOverlay = (o: Overlay) => setOverlayStack((prev) => [...prev, o]);
  const popOverlay = () =>
    setOverlayStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));

  // Hash-роутинг для инвайтов: /#/i/<token>
  useEffect(() => {
    const parse = () => {
      const h = window.location.hash || '';
      const m = h.match(/^#\/i\/(.+)$/);
      setPendingInviteToken(m ? decodeURIComponent(m[1]) : null);
    };
    parse();
    window.addEventListener('hashchange', parse);
    return () => window.removeEventListener('hashchange', parse);
  }, []);

  // После логина, если в URL есть инвайт — открываем экран вступления.
  useEffect(() => {
    if (!accessToken || !pendingInviteToken) return;
    if (currentOverlay?.kind === 'inviteJoin' && currentOverlay.token === pendingInviteToken) return;
    pushOverlay({ kind: 'inviteJoin', token: pendingInviteToken });
  }, [accessToken, pendingInviteToken]);

  const loadServers = useCallback(async () => {
    if (!accessToken) return;
    try {
      const list = await chatApi.getServers();
      setServers(list);
      setActiveServerId((prev) => {
        if (list.length === 0) return HOME_SERVER_ID;
        if (!prev || prev === HOME_SERVER_ID) return list[0].id;
        return prev;
      });
      if (list.length === 0) {
        setChannels([]);
        setActiveChannelId(null);
        setMessages([]);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return loadServers();
        logout();
      }
      toast.error('Не удалось загрузить серверы');
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, refreshAccessToken, logout]);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        subscribedChannelRef.current = null;
        desiredChannelRef.current = null;
      }
      return;
    }
    loadServers();
  }, [accessToken, loadServers]);

  // WebSocket для получения событий чата в реальном времени
  useEffect(() => {
    if (!accessToken) {
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
        const channelId = String(msg.channel_id);
        const current = activeChannelIdRef.current;
        if (current && channelId !== current) {
          setUnreadChannelCounts((prev) => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
        }
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

  useEffect(() => {
    if (!activeServerId || activeServerId === HOME_SERVER_ID || !accessToken) {
      setChannels([]);
      setActiveChannelId(null);
      return;
    }
    setLoadingChannels(true);
    chatApi
      .getChannelsByServer(activeServerId)
      .then((list) => {
        setChannels(list);
        if (list.length > 0) {
          const first = list[0];
          setActiveChannelId(first.id);
        } else {
          setActiveChannelId(null);
          setMessages([]);
        }
      })
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await refreshAccessToken();
          if (ok) {
            await loadServers();
            return;
          }
          logout();
        } else {
          toast.error('Не удалось загрузить каналы');
        }
        setChannels([]);
      })
      .finally(() => setLoadingChannels(false));
  }, [activeServerId, accessToken, refreshAccessToken, loadServers]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    if (activeChannelId) {
      setUnreadChannelCounts((prev) => {
        const next = { ...prev };
        delete next[activeChannelId];
        return next;
      });
    }
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId || !accessToken) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    chatApi
      .getMessageHistory(activeChannelId, 50)
      .then(({ items, nextCursor, hasMore }) => {
        setMessages(items);
        setMessageHistoryState((prev) => ({
          ...prev,
          [activeChannelId]: { cursor: nextCursor, hasMore },
        }));
      })
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await refreshAccessToken();
          if (ok) {
            await loadServers();
            return;
          }
          logout();
        } else {
          toast.error('Не удалось загрузить сообщения');
        }
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
  }, [activeChannelId, accessToken, refreshAccessToken, loadServers]);

  const handleLoadMoreMessages = async () => {
    if (!activeChannelId || !accessToken) return;
    const state = messageHistoryState[activeChannelId];
    if (!state || !state.hasMore || !state.cursor) return;
    try {
      const { items, nextCursor, hasMore } = await chatApi.getMessageHistory(
        activeChannelId,
        50,
        state.cursor
      );
      if (items.length === 0) {
        setMessageHistoryState((prev) => ({
          ...prev,
          [activeChannelId]: { cursor: null, hasMore: false },
        }));
        return;
      }
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = items.filter((m) => !existingIds.has(m.id));
        return [...unique, ...prev];
      });
      setMessageHistoryState((prev) => ({
        ...prev,
        [activeChannelId]: { cursor: nextCursor, hasMore },
      }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) return handleLoadMoreMessages();
        logout();
      }
    }
  };

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;
  const serverChannels = channels.filter((c) => c.serverId === activeServerId || c.server_id === activeServerId);
  const activeChannel = serverChannels.find((c) => c.id === activeChannelId) ?? serverChannels[0] ?? null;

  const voiceChannelIdsKey = useMemo(() => {
    if (!activeServerId || activeServerId === HOME_SERVER_ID) return '';
    return channels
      .filter(
        (c) =>
          (c.serverId === activeServerId || c.server_id === activeServerId) && c.type === 'voice'
      )
      .map((c) => c.id)
      .sort()
      .join('|');
  }, [channels, activeServerId]);

  /** Сбрасываем карту голоса при смене сервера — дальше её заполняет polling. */
  useEffect(() => {
    setVoiceUsersByChannel({});
  }, [activeServerId]);

  /** Участники голосовых каналов для сайдбара: работает и без подключения к голосу (HTTP к media). */
  useEffect(() => {
    if (!accessToken || !user || !voiceChannelIdsKey) return;
    const voiceIds = voiceChannelIdsKey.split('|').filter(Boolean);

    let cancelled = false;
    const tick = async () => {
      const rows = await Promise.all(
        voiceIds.map(async (id) => {
          try {
            const peers = await mediaApi.getVoiceRoomPeers(id);
            return { id, users: mapVoicePeersToVoiceUsers(peers) };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setVoiceUsersByChannel((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (row) next[row.id] = row.users;
        }
        return next;
      });
    };

    void tick();
    const interval = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [accessToken, user, voiceChannelIdsKey, mapVoicePeersToVoiceUsers]);

  /** Главная = ЛС или нет выбранного сервера (чтобы не рендерить ChannelList с null). */
  const isHomeView =
    activeServerId === HOME_SERVER_ID || activeServerId == null || activeServer == null;
  const showChannelLayout =
    activeServerId != null && activeServerId !== HOME_SERVER_ID && activeServer != null;

  // При переходе на экран DMs на мобильном панель серверов скрыта по умолчанию
  useEffect(() => {
    if (activeServerId === HOME_SERVER_ID && isMobile) setHomeServerPanelVisible(false);
  }, [activeServerId, isMobile]);

  const handleServerClick = (newServerId: string) => {
    setActiveServerId(newServerId);
    const firstChannel = channels.filter((c) => c.serverId === newServerId || c.server_id === newServerId)[0];
    if (firstChannel) setActiveChannelId(firstChannel.id);
    else setActiveChannelId(null);
    setIsMobileMenuOpen(false);
  };

  const cleanupVoiceRuntime = (resetRecoveryState = true) => {
    voiceEventUnsubsRef.current.forEach((unsub) => unsub());
    voiceEventUnsubsRef.current = [];
    if (voiceHeartbeatRef.current != null) {
      window.clearInterval(voiceHeartbeatRef.current);
      voiceHeartbeatRef.current = null;
    }
    if (resetRecoveryState) {
      voiceRecoveryInProgressRef.current = false;
      voiceRecoveryAttemptsRef.current = 0;
    }
  };

  const handleChannelClick = (newChannelId: string) => {
    setActiveChannelId(newChannelId);
    setUnreadChannelCounts((prev) => {
      const next = { ...prev };
      delete next[newChannelId];
      return next;
    });
    setIsMobileMenuOpen(false);

    const ch = serverChannels.find((c) => c.id === newChannelId);
    if (ch && ch.type === 'voice') {
      setVoiceError(null);
      void joinVoiceChannel(ch);
    } else {
      // Переход в текстовый канал: выходим из голосового канала
      setVoiceError(null);
      cleanupVoiceRuntime();
      if (activeVoiceConnectionRef.current) {
        void activeVoiceConnectionRef.current.disconnect();
        activeVoiceConnectionRef.current = null;
      }
    }
  };

  const joinVoiceChannel = async (channel: Channel, options?: { preserveRecoveryState?: boolean }) => {
    if (!user) return;
    setVoiceError(null);
    setVoiceConnectingChannelId(channel.id);
    cleanupVoiceRuntime(!(options?.preserveRecoveryState ?? false));
    if (activeVoiceConnectionRef.current) {
      try {
        await activeVoiceConnectionRef.current.disconnect();
      } catch {
        /* ignore */
      }
      activeVoiceConnectionRef.current = null;
    }

    const syncVoicePeers = async (conn: VoiceConnection, targetChannelId: string) => {
      const peers = await conn.getPeers();
      setVoiceUsersByChannel((prev) => ({
        ...prev,
        [targetChannelId]: mapVoicePeersToVoiceUsers(peers),
      }));
    };

    const peerId = `${user.id}:${crypto.randomUUID?.() ?? Date.now().toString()}`;
    const conn = new VoiceConnection(channel.id, peerId, user.id, user.username);
    activeVoiceConnectionRef.current = conn;

    const startHeartbeat = () => {
      if (voiceHeartbeatRef.current != null) {
        window.clearInterval(voiceHeartbeatRef.current);
      }
      voiceHeartbeatRef.current = window.setInterval(() => {
        const current = activeVoiceConnectionRef.current;
        if (!current) return;
        void current.ping().catch(async () => {
          if (voiceRecoveryInProgressRef.current) return;
          if (voiceRecoveryAttemptsRef.current >= 3) {
            setVoiceError('Потеряно соединение с голосовым сервером. Переподключитесь к каналу.');
            cleanupVoiceRuntime();
            return;
          }
          voiceRecoveryInProgressRef.current = true;
          voiceRecoveryAttemptsRef.current += 1;
          try {
            await joinVoiceChannel(channel, { preserveRecoveryState: true });
            setVoiceError(null);
          } catch {
            // joinVoiceChannel сам проставляет ошибку
          } finally {
            voiceRecoveryInProgressRef.current = false;
          }
        });
      }, 15000);
    };

    try {
      await conn.connect();
      await syncVoicePeers(conn, channel.id);
      voiceEventUnsubsRef.current = [
        conn.onProducerAdded(() => {
          void syncVoicePeers(conn, channel.id);
        }),
        conn.onProducerRemoved(() => {
          void syncVoicePeers(conn, channel.id);
        }),
        conn.onDisconnected(() => {
          if (voiceRecoveryInProgressRef.current) return;
          if (voiceRecoveryAttemptsRef.current >= 3) {
            setVoiceError('WebSocket голосового канала закрыт. Переподключитесь к каналу.');
            cleanupVoiceRuntime();
            return;
          }
          voiceRecoveryInProgressRef.current = true;
          voiceRecoveryAttemptsRef.current += 1;
          void joinVoiceChannel(channel, { preserveRecoveryState: true }).finally(() => {
            voiceRecoveryInProgressRef.current = false;
          });
        }),
      ];
      startHeartbeat();
      voiceRecoveryAttemptsRef.current = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось подключиться к голосовому каналу';
      setVoiceError(message);
      toast.error(message);
      activeVoiceConnectionRef.current = null;
      cleanupVoiceRuntime();
    } finally {
      setVoiceConnectingChannelId(null);
    }
  };

  // Подписка на активный канал по WebSocket
  useEffect(() => {
    desiredChannelRef.current = activeChannelId ?? null;
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const prev = subscribedChannelRef.current;
    if (prev && prev !== activeChannelId) {
      try {
        ws.send(JSON.stringify({ action: 'unsubscribe', channel_id: prev }));
      } catch {
        // ignore
      }
    }
    if (activeChannelId) {
      try {
        ws.send(JSON.stringify({ action: 'subscribe', channel_id: activeChannelId }));
        subscribedChannelRef.current = activeChannelId;
      } catch {
        // ignore
      }
    }
  }, [activeChannelId]);

  const reloadChannelsForServer = async (serverId: string) => {
    setLoadingChannels(true);
    try {
      const list = await chatApi.getChannelsByServer(serverId);
      setChannels(list);
      if (list.length > 0) {
        const first = list[0];
        setActiveChannelId(first.id);
      } else {
        setActiveChannelId(null);
        setMessages([]);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          return reloadChannelsForServer(serverId);
        }
        logout();
      } else {
        toast.error('Не удалось загрузить каналы');
      }
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleAddTextChannel = (serverId: string) => {
    setCreateChannelServerId(serverId);
    setCreateChannelType('text');
    setCreateChannelModalOpen(true);
  };

  const handleAddVoiceChannel = (serverId: string) => {
    setCreateChannelServerId(serverId);
    setCreateChannelType('voice');
    setCreateChannelModalOpen(true);
  };

  const handleOpenServerSettings = (serverId: string) => {
    pushOverlay({ kind: 'serverSettings', serverId });
  };

  const handleInviteToServer = (serverId: string) => {
    setInviteServerId(serverId);
    setInviteModalOpen(true);
  };

  const handleCreateChannel = async (name: string) => {
    if (!createChannelServerId) {
      throw new Error('Не выбран сервер для создания канала');
    }
    const serverId = createChannelServerId;
    const type = createChannelType;

    const attempt = async (): Promise<void> => {
      try {
        const channel = await chatApi.createChannel(serverId, type, name);
        await reloadChannelsForServer(serverId);
        setActiveServerId(serverId);
        setActiveChannelId(channel.id);
        toast.success(type === 'text' ? 'Текстовый канал создан' : 'Голосовой канал создан');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await refreshAccessToken();
          if (ok) return attempt();
          logout();
        }
        toast.error(
          e instanceof ApiError
            ? e.message
            : type === 'text'
            ? 'Не удалось создать текстовый канал'
            : 'Не удалось создать голосовой канал'
        );
        throw e;
      }
    };

    return attempt();
  };

  const handleRenameChannel = useCallback(
    async (channelId: string, newName: string) => {
      if (!activeServerId || activeServerId === HOME_SERVER_ID) return;
      try {
        await chatApi.updateChannel(channelId, newName);
        await reloadChannelsForServer(activeServerId);
        toast.success('Канал переименован');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await refreshAccessToken();
          if (ok) return handleRenameChannel(channelId, newName);
          logout();
        }
        toast.error(e instanceof ApiError ? e.message : 'Не удалось переименовать канал');
        throw e;
      }
    },
    [activeServerId, refreshAccessToken, logout]
  );

  const handleDeleteChannel = useCallback(
    async (channelId: string) => {
      if (!activeServerId || activeServerId === HOME_SERVER_ID) return;
      try {
        await chatApi.deleteChannel(channelId);
        if (activeChannelId === channelId) {
          setActiveChannelId(null);
        }
        await reloadChannelsForServer(activeServerId);
        toast.success('Канал удалён');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          const ok = await refreshAccessToken();
          if (ok) return handleDeleteChannel(channelId);
          logout();
        }
        toast.error(e instanceof ApiError ? e.message : 'Не удалось удалить канал');
        throw e;
      }
    },
    [activeServerId, activeChannelId, refreshAccessToken, logout]
  );

  const handleSendMessage = async (content: string) => {
    if (!activeChannelId || !activeChannel || activeChannel.type !== 'text') return;
    try {
      const sent = await chatApi.postMessage(activeChannelId, content);
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) return handleSendMessage(content);
        logout();
      }
      toast.error(e instanceof ApiError ? e.message : 'Не удалось отправить сообщение');
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleAddServer = () => {
    setCreateServerModalOpen(true);
  };

  const handleCreateServer = useCallback(
    async (name: string) => {
      const attempt = async (): Promise<void> => {
        try {
          const server = await chatApi.createServer(name);
          await loadServers();
          setActiveServerId(server.id);
          setActiveChannelId(null);
          toast.success('Сервер создан');
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            const ok = await refreshAccessToken();
            if (ok) return attempt();
            logout();
          }
          throw e;
        }
      };
      return attempt();
    },
    [loadServers, refreshAccessToken, logout]
  );

  const handleLeaveVoiceChannel = () => {
    setVoiceError(null);
    cleanupVoiceRuntime();
    if (activeVoiceConnectionRef.current) {
      void activeVoiceConnectionRef.current.disconnect();
      activeVoiceConnectionRef.current = null;
    }
    toast.success('Вы покинули голосовой канал');
    const firstText = serverChannels.find((c) => c.type === 'text');
    if (firstText) handleChannelClick(firstText.id);
  };

  useEffect(() => {
    return () => {
      cleanupVoiceRuntime();
    };
  }, []);

  const channelMessages = activeChannelId
    ? messages.filter((m) => m.channelId === activeChannelId || m.channel_id === activeChannelId)
    : [];

  if (!accessToken) {
    return (
      <>
        <LoginView />
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </>
    );
  }

  if (loading && servers.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  const handleBack = () => {
    if (currentOverlay?.kind === 'inviteJoin') {
      window.location.hash = '';
    }
    popOverlay();
  };

  if (currentOverlay?.kind === 'profile') {
    return (
      <>
        <ProfileSettingsView onBack={handleBack} onRefreshToken={refreshAccessToken} onLogout={logout} />
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </>
    );
  }

  if (currentOverlay?.kind === 'appSettings') {
    return (
      <>
        <AppSettingsView onBack={handleBack} />
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </>
    );
  }

  if (currentOverlay?.kind === 'notifications') {
    return (
      <>
        <NotificationsView onBack={handleBack} />
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </>
    );
  }

  if (currentOverlay?.kind === 'serverSettings') {
    return (
      <>
        <ServerSettingsView serverId={currentOverlay.serverId} onBack={handleBack} />
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </>
    );
  }

  if (currentOverlay?.kind === 'inviteJoin') {
    return (
      <>
        <ServerInviteView
          token={currentOverlay.token}
          onBack={handleBack}
          onJoined={async (serverId) => {
            await loadServers();
            setActiveServerId(serverId);
            setActiveChannelId(null);
            window.location.hash = '';
            popOverlay();
          }}
        />
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </>
    );
  }

  if (showChannelLayout && !activeChannel && loadingChannels) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <div className="animate-pulse">Загрузка каналов...</div>
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </div>
    );
  }

  if (showChannelLayout && !activeChannel && !loadingChannels) {
    return (
      <div className="h-screen flex text-white overflow-hidden">
        <div className="hidden md:flex">
          <ServerList
            servers={servers}
            activeServerId={activeServerId ?? ''}
            onServerClick={handleServerClick}
            onAddServer={handleAddServer}
            onOpenProfile={() => pushOverlay({ kind: 'profile' })}
            onOpenAppSettings={() => pushOverlay({ kind: 'appSettings' })}
            onOpenNotifications={() => pushOverlay({ kind: 'notifications' })}
            currentUserAvatar={user?.avatar_url}
          />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-gray-400">Нет каналов в этом сервере</p>
        </div>
        <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex text-white overflow-hidden md:h-screen no-select">
      <div
        className={
          isHomeView
            ? isMobile
              ? homeServerPanelVisible
                ? 'flex shrink-0'
                : 'hidden'
              : 'flex shrink-0'
            : 'hidden md:flex'
        }
      >
        <ServerList
          servers={servers}
          activeServerId={activeServerId ?? ''}
          onServerClick={handleServerClick}
          onAddServer={handleAddServer}
          onOpenProfile={() => pushOverlay({ kind: 'profile' })}
          onOpenAppSettings={() => pushOverlay({ kind: 'appSettings' })}
          onOpenNotifications={() => pushOverlay({ kind: 'notifications' })}
          currentUserAvatar={user?.avatar_url}
        />
      </div>
      {isHomeView ? (
        <div className="flex-1 flex flex-col min-w-0">
          <HomeView
            onRefreshToken={refreshAccessToken}
            onLogout={logout}
            onOpenProfile={() => pushOverlay({ kind: 'profile' })}
            onOpenAppSettings={() => pushOverlay({ kind: 'appSettings' })}
            onOpenNotifications={() => pushOverlay({ kind: 'notifications' })}
            currentUserAvatar={user?.avatar_url}
            serverPanelVisible={homeServerPanelVisible}
            onServerPanelVisibleChange={setHomeServerPanelVisible}
          />
        </div>
      ) : activeServer != null ? (
        <div className="flex-1 flex min-h-0 min-w-0">
          {/* Десктоп: панель каналов слева, чат справа в один ряд */}
          {activeServer && (
            <div className="hidden md:flex shrink-0">
              <ChannelList
                server={activeServer}
                channels={serverChannels}
                activeChannelId={activeChannelId ?? ''}
                unreadCounts={unreadChannelCounts}
                voiceUsersByChannel={voiceUsersByChannel}
                onChannelClick={handleChannelClick}
                onAddTextChannel={handleAddTextChannel}
                onAddVoiceChannel={handleAddVoiceChannel}
                onOpenServerSettings={handleOpenServerSettings}
                onInviteToServer={handleInviteToServer}
                onOpenProfile={() => pushOverlay({ kind: 'profile' })}
                onOpenAppSettings={() => pushOverlay({ kind: 'appSettings' })}
                onOpenNotifications={() => pushOverlay({ kind: 'notifications' })}
                currentUserAvatar={user?.avatar_url}
                onRenameChannel={handleRenameChannel}
                onDeleteChannel={handleDeleteChannel}
              />
            </div>
          )}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* На мобильном: шапка в самом верху, под ней — drawer и контент канала */}
            {isMobile && activeChannel != null && (
              <MobileHeader
                channel={activeChannel}
                onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                isMenuOpen={isMobileMenuOpen}
              />
            )}
            <MobileDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
              <div className="flex w-full h-full">
                <ServerList
                  servers={servers}
                  activeServerId={activeServerId ?? ''}
                  onServerClick={handleServerClick}
                  onAddServer={handleAddServer}
                  onOpenProfile={() => pushOverlay({ kind: 'profile' })}
                  onOpenAppSettings={() => pushOverlay({ kind: 'appSettings' })}
                  onOpenNotifications={() => pushOverlay({ kind: 'notifications' })}
                  currentUserAvatar={user?.avatar_url}
                />
                {activeServer && (
                  <ChannelList
                    server={activeServer}
                    channels={serverChannels}
                    activeChannelId={activeChannelId ?? ''}
                    unreadCounts={unreadChannelCounts}
                    voiceUsersByChannel={voiceUsersByChannel}
                    onChannelClick={handleChannelClick}
                    onAddTextChannel={handleAddTextChannel}
                    onAddVoiceChannel={handleAddVoiceChannel}
                    onOpenServerSettings={handleOpenServerSettings}
                    onInviteToServer={handleInviteToServer}
                    onOpenProfile={() => pushOverlay({ kind: 'profile' })}
                    onOpenAppSettings={() => pushOverlay({ kind: 'appSettings' })}
                    onOpenNotifications={() => pushOverlay({ kind: 'notifications' })}
                    currentUserAvatar={user?.avatar_url}
                    onRenameChannel={handleRenameChannel}
                    onDeleteChannel={handleDeleteChannel}
                  />
                )}
              </div>
            </MobileDrawer>
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {activeChannel != null ? (
                <>
                  {activeChannel.type === 'text' ? (
                    <ChatView
                      channel={activeChannel}
                      messages={channelMessages}
                      onSendMessage={handleSendMessage}
                      onDeleteMessage={handleDeleteMessage}
                      loading={loadingMessages}
                      onLoadMore={handleLoadMoreMessages}
                    />
                  ) : (
                    <VoiceChannelView
                      channel={activeChannel}
                      users={voiceUsersByChannel[activeChannel.id] ?? []}
                      currentUserId={user?.id}
                      connecting={voiceConnectingChannelId === activeChannel.id}
                      error={voiceError}
                      onLeaveChannel={handleLeaveVoiceChannel}
                    />
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  {loadingChannels ? 'Загрузка каналов...' : 'Выберите канал'}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          <HomeView
            onRefreshToken={refreshAccessToken}
            onLogout={logout}
            onOpenProfile={() => pushOverlay({ kind: 'profile' })}
            onOpenAppSettings={() => pushOverlay({ kind: 'appSettings' })}
            onOpenNotifications={() => pushOverlay({ kind: 'notifications' })}
            currentUserAvatar={user?.avatar_url}
          />
        </div>
      )}
      <CreateServerModal
        open={createServerModalOpen}
        onClose={() => setCreateServerModalOpen(false)}
        onCreate={handleCreateServer}
      />
      <CreateChannelModal
        open={createChannelModalOpen}
        type={createChannelType}
        onClose={() => setCreateChannelModalOpen(false)}
        onCreate={handleCreateChannel}
      />
      <ServerInviteModal
        open={inviteModalOpen}
        serverId={inviteServerId}
        serverName={servers.find((s) => s.id === inviteServerId)?.name ?? null}
        onClose={() => {
          setInviteModalOpen(false);
          setInviteServerId(null);
        }}
      />
      <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'md:mr-0 mr-0' }} />
    </div>
  );
}
