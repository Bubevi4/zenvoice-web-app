/**
 * Модалка "Пригласить пользователя на сервер": генерирует инвайт-ссылку и позволяет отправить в ЛС.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Send, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { UserAvatar } from './UserAvatar';
import { toast } from 'sonner';
import * as chatApi from '../api/chat';
import type { DMChannel } from '../api/chat';
import { ApiError } from '../api/client';

interface ServerInviteModalProps {
  open: boolean;
  serverId: string | null;
  serverName?: string | null;
  onClose: () => void;
}

export function ServerInviteModal({ open, serverId, serverName, onClose }: ServerInviteModalProps) {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [oneTime, setOneTime] = useState(false);

  const inviteUrl = useMemo(() => {
    if (!token) return '';
    // Короткий, удобный формат ссылки: /i/<token>
    return `${window.location.origin}/#/i/${encodeURIComponent(token)}`;
  }, [token]);

  useEffect(() => {
    if (!open) {
      setToken(null);
      setExpiresAt(null);
      setDmChannels([]);
      setSendingTo(null);
      setOneTime(false);
      return;
    }
    if (!serverId) return;
    setLoading(true);
    Promise.all([chatApi.createServerInvite(serverId), chatApi.getDmChannels()])
      .then(([inv, dms]) => {
        setToken(inv.token);
        setExpiresAt(inv.expires_at ?? null);
        setDmChannels(dms);
      })
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : 'Не удалось создать приглашение');
      })
      .finally(() => setLoading(false));
  }, [open, serverId]);

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать');
    }
  }, [inviteUrl]);

  const handleSendToDm = useCallback(
    async (dmId: string) => {
      if (!inviteUrl) return;
      setSendingTo(dmId);
      try {
        await chatApi.postMessage(dmId, inviteUrl);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Не удалось отправить');
      } finally {
        setSendingTo(null);
      }
    },
    [inviteUrl]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-modal border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-violet-400" />
            Пригласить на сервер
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            {serverName ? `Сервер: ${serverName}` : 'Создайте ссылку-приглашение и отправьте её пользователю.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Ссылка-приглашение</label>
            <div className="flex gap-2">
              <Input
                value={inviteUrl || (loading ? 'Создание ссылки...' : '')}
                readOnly
                className="glass-input text-white"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                disabled={!inviteUrl}
                className="border-white/10 text-gray-300 hover:bg-white/5"
                title="Скопировать"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {expiresAt && (
              <p className="mt-1 text-xs text-gray-500">
                Ссылка будет недействительна{' '}
                {new Date(expiresAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="one-time-invite"
              type="checkbox"
              checked={oneTime}
              onChange={(e) => setOneTime(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-transparent"
            />
            <label htmlFor="one-time-invite" className="text-sm text-gray-300 select-none">
              Одноразовая ссылка (MVP, пока без ограничения по числу использований)
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Отправить ссылку в ЛС
            </label>
            {dmChannels.length === 0 ? (
              <div className="text-sm text-gray-500">
                Нет диалогов. Создайте ЛС на главном экране и вернитесь сюда.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border border-white/10">
                {dmChannels.map((dm) => (
                  <button
                    key={dm.id}
                    type="button"
                    onClick={() => handleSendToDm(dm.id)}
                    disabled={!inviteUrl || sendingTo === dm.id}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed text-left"
                  >
                    <UserAvatar
                      avatarUrl={dm.other_user.avatar_url}
                      alt={dm.other_user.username}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{dm.other_user.username}</div>
                      <div className="text-xs text-gray-500 truncate">@{dm.other_user.nametag}</div>
                    </div>
                    <Send className="w-4 h-4 text-gray-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

