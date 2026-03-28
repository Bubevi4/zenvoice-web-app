import React, { useCallback, useRef, useState } from 'react';
import { Hash, Volume2, ChevronDown, Settings, Bell, Pencil, Trash2, Plus } from 'lucide-react';
import type { Channel, Server, VoiceUser } from '../models';
import { UserAvatar } from './UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { UnreadBadge } from './UnreadBadge';

const LONG_PRESS_MS = 500;

interface ChannelListProps {
  server: Server | null;
  channels: Channel[];
  activeChannelId: string;
  unreadCounts?: Record<string, number>;
  voiceUsersByChannel?: Record<string, VoiceUser[]>;
  onChannelClick: (channelId: string) => void;
  onAddTextChannel?: (serverId: string) => void;
  onAddVoiceChannel?: (serverId: string) => void;
  onOpenServerSettings?: (serverId: string) => void;
  onInviteToServer?: (serverId: string) => void;
  onOpenProfile?: () => void;
  onOpenAppSettings?: () => void;
  onOpenNotifications?: () => void;
  currentUserAvatar?: string | null;
  onRenameChannel?: (channelId: string, newName: string) => Promise<void>;
  onDeleteChannel?: (channelId: string) => Promise<void>;
  /** Сумма непрочитанных по всему приложению — бейдж на колокольчике. */
  notificationsUnreadTotal?: number;
}

export function ChannelList({
  server,
  channels,
  activeChannelId,
  unreadCounts = {},
  onChannelClick,
  onAddTextChannel,
  onAddVoiceChannel,
  onOpenServerSettings,
  onInviteToServer,
  onOpenProfile,
  onOpenAppSettings,
  onOpenNotifications,
  currentUserAvatar,
  onRenameChannel,
  onDeleteChannel,
  voiceUsersByChannel = {},
  notificationsUnreadTotal = 0,
}: ChannelListProps) {
  const [contextMenuChannelId, setContextMenuChannelId] = useState<string | null>(null);
  const [renameChannelId, setRenameChannelId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmChannelId, setDeleteConfirmChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressChannelIdRef = useRef<string | null>(null);
  const longPressFiredRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressChannelIdRef.current = null;
  }, []);

  const startLongPress = useCallback((channelId: string) => {
    longPressFiredRef.current = false;
    longPressChannelIdRef.current = channelId;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      setContextMenuChannelId(channelId);
    }, LONG_PRESS_MS);
  }, []);

  const handleChannelClick = useCallback(
    (channelId: string, e: React.MouseEvent) => {
      if (longPressFiredRef.current) {
        e.preventDefault();
        longPressFiredRef.current = false;
        return;
      }
      clearLongPress();
      onChannelClick(channelId);
    },
    [clearLongPress, onChannelClick]
  );

  const openRenameDialog = useCallback((channel: Channel) => {
    setContextMenuChannelId(null);
    setRenameChannelId(channel.id);
    setRenameValue(channel.name ?? '');
  }, []);

  const openDeleteConfirm = useCallback((channelId: string) => {
    setContextMenuChannelId(null);
    setDeleteConfirmChannelId(channelId);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameChannelId || !onRenameChannel || !renameValue.trim()) return;
    setLoading(true);
    try {
      await onRenameChannel(renameChannelId, renameValue.trim());
      setRenameChannelId(null);
      setRenameValue('');
    } finally {
      setLoading(false);
    }
  }, [renameChannelId, renameValue, onRenameChannel]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmChannelId || !onDeleteChannel) return;
    setLoading(true);
    try {
      await onDeleteChannel(deleteConfirmChannelId);
      setDeleteConfirmChannelId(null);
    } finally {
      setLoading(false);
    }
  }, [deleteConfirmChannelId, onDeleteChannel]);

  if (server == null) return null;

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  return (
    <div className="w-60 glass-panel flex flex-col border-r border-white/5 shrink-0">
      {/* Server header */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="h-12 px-4 flex items-center justify-between border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group shrink-0">
            <h2 className="font-semibold text-white truncate">{server.name}</h2>
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors shrink-0" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="glass-modal border-white/10 text-white min-w-[220px]"
        >
          <DropdownMenuItem
            onClick={() => onOpenServerSettings?.(server.id)}
            className="cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Настройки сервера
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={() => onInviteToServer?.(server.id)}
            className="cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Пригласить пользователя
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Channels */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Text channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Текстовые каналы
            </span>
            <button
              type="button"
              onClick={() => onAddTextChannel?.(server.id)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Создать текстовый канал"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {textChannels.map((channel) => {
            const unread = unreadCounts[channel.id] ?? 0;
            return (
              <DropdownMenu
                key={channel.id}
                open={contextMenuChannelId === channel.id}
                onOpenChange={(open) => {
                  if (!open) setContextMenuChannelId(null);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    className={`
                      w-full flex items-center justify-start gap-2 px-2 py-1.5 rounded-md mb-0.5
                      transition-all duration-150 group active:scale-[0.98]
                      ${activeChannelId === channel.id
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }
                    `}
                    onMouseDown={() => startLongPress(channel.id)}
                    onMouseUp={clearLongPress}
                    onMouseLeave={clearLongPress}
                    onTouchStart={() => startLongPress(channel.id)}
                    onTouchEnd={clearLongPress}
                    onClick={(e) => handleChannelClick(channel.id, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenuChannelId(channel.id);
                    }}
                  >
                    <Hash className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm truncate flex-1 min-w-0 text-left">{channel.name}</span>
                    <UnreadBadge count={unread} className="shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="glass-modal border-white/10 text-white min-w-[180px]"
                >
                  <DropdownMenuItem
                    className="cursor-pointer text-gray-200 focus:bg-white/10 focus:text-white"
                    onClick={() => openRenameDialog(channel)}
                  >
                    <Pencil className="w-4 h-4" />
                    Переименовать
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                    onClick={() => openDeleteConfirm(channel.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
        
        {/* Voice channels */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Голосовые каналы
            </span>
            <button
              type="button"
              onClick={() => onAddVoiceChannel?.(server.id)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Создать голосовой канал"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {voiceChannels.map((channel) => {
            const voiceUsers = voiceUsersByChannel[channel.id] ?? [];
            const isActiveVoice = activeChannelId === channel.id;
            return (
              <div key={channel.id} className="mb-0.5">
                <DropdownMenu
                  open={contextMenuChannelId === channel.id}
                  onOpenChange={(open) => {
                    if (!open) setContextMenuChannelId(null);
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`
                        w-full flex items-center justify-start gap-2 px-2 py-1.5 rounded-md
                        transition-all duration-150 group active:scale-[0.98]
                        ${isActiveVoice
                          ? 'bg-violet-600/20 text-violet-300'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        }
                      `}
                      onMouseDown={() => startLongPress(channel.id)}
                      onMouseUp={clearLongPress}
                      onMouseLeave={clearLongPress}
                      onTouchStart={() => startLongPress(channel.id)}
                      onTouchEnd={clearLongPress}
                      onClick={(e) => handleChannelClick(channel.id, e)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenuChannelId(channel.id);
                      }}
                    >
                      <Volume2 className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate flex-1 min-w-0 text-left">{channel.name}</span>
                      {isActiveVoice && (
                        <span className="text-[10px] text-green-400 font-medium shrink-0" title="Вы в этом канале">
                          в канале
                        </span>
                      )}
                      {voiceUsers.length > 0 && (
                        <span className="text-[11px] text-violet-300 ml-1 shrink-0">
                          {voiceUsers.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="glass-modal border-white/10 text-white min-w-[180px]"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer text-gray-200 focus:bg-white/10 focus:text-white"
                      onClick={() => openRenameDialog(channel)}
                    >
                      <Pencil className="w-4 h-4" />
                      Переименовать
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                      onClick={() => openDeleteConfirm(channel.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {voiceUsers.length > 0 && (
                  <ul
                    className="mt-1 w-full min-w-0 pl-2 pr-2 space-y-0.5 border-l border-white/10 ml-2"
                    aria-label={`Участники канала ${channel.name ?? ''}`}
                  >
                    {voiceUsers.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-2 w-full min-w-0 py-1 px-2 rounded-md text-[12px] text-gray-200 bg-white/[0.04] border border-white/5"
                        title={u.name}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" aria-hidden />
                        <UserAvatar
                          avatarUrl={
                            u.avatar?.startsWith('http') || u.avatar?.startsWith('emoji:')
                              ? u.avatar
                              : u.avatar
                                ? `emoji:${u.avatar}`
                                : undefined
                          }
                          alt={u.name}
                          size="sm"
                          className="!size-5 shrink-0"
                        />
                        <span className="truncate flex-1 min-w-0 text-left">{u.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* User panel (аватар → профиль, шестерёнка → настройки приложения, колокольчик → уведомления) */}
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
          className="relative p-1.5 hover:bg-white/10 rounded transition-colors shrink-0"
          title="Уведомления"
        >
          <Bell className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          <span className="absolute -top-0.5 -right-0.5 flex min-w-[16px] justify-center pointer-events-none">
            <UnreadBadge count={notificationsUnreadTotal} />
          </span>
        </button>
      </div>

      {/* Диалог переименования канала */}
      <Dialog open={!!renameChannelId} onOpenChange={(open) => { if (!open) setRenameChannelId(null); }}>
        <DialogContent className="glass-modal border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переименовать канал</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Название канала"
              className="glass-input text-white"
              maxLength={100}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-gray-300 hover:bg-white/5"
              onClick={() => setRenameChannelId(null)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-500 text-white"
              disabled={!renameValue.trim() || loading}
              onClick={handleRenameSubmit}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение удаления канала */}
      <Dialog open={!!deleteConfirmChannelId} onOpenChange={(open) => { if (!open) setDeleteConfirmChannelId(null); }}>
        <DialogContent className="glass-modal border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить канал?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm py-2">
            Канал будет удалён безвозвратно. Все сообщения в нём будут потеряны.
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-gray-300 hover:bg-white/5"
              onClick={() => setDeleteConfirmChannelId(null)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={loading}
              onClick={handleDeleteConfirm}
            >
              {loading ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}