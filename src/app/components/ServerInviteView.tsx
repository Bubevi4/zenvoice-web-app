/**
 * Экран вступления на сервер по инвайту.
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from './ui/button';
import { ApiError } from '../api/client';
import * as chatApi from '../api/chat';
import { toast } from 'sonner';

interface ServerInviteViewProps {
  token: string;
  onBack: () => void;
  onJoined: (serverId: string) => Promise<void> | void;
}

export function ServerInviteView({ token, onBack, onJoined }: ServerInviteViewProps) {
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [info, setInfo] = useState<{
    name: string;
    icon_url?: string | null;
    description?: string | null;
    members_count: number;
    server_id: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    chatApi
      .getInviteInfo(token)
      .then((res) => setInfo(res))
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : 'Не удалось загрузить инвайт');
        setInfo(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const server = await chatApi.joinByInvite(token);
      toast.success(`Вы вступили на сервер «${server.name}»`);
      await onJoined(server.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Не удалось вступить');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1f] text-white">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Приглашение на сервер</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-xl mx-auto w-full">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Загрузка...</div>
        ) : !info ? (
          <div className="py-12 text-center text-gray-400">Инвайт недоступен</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 overflow-hidden flex items-center justify-center text-3xl shadow-lg">
                {info.icon_url?.startsWith('emoji:') ? (
                  <span>{info.icon_url.slice(6)}</span>
                ) : info.icon_url ? (
                  <img src={info.icon_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>🏠</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-semibold truncate">{info.name}</div>
                <div className="text-sm text-gray-400 truncate">
                  {info.description?.trim() ? info.description : 'Описание не задано'}
                </div>
                <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                  <Users className="w-4 h-4" />
                  {info.members_count} участник(ов)
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#16161b]/50 p-4 text-sm text-gray-300">
              Вы были приглашены на сервер. Нажмите кнопку ниже, чтобы вступить.
            </div>

            <Button
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white"
            >
              {joining ? 'Вступаем...' : 'Вступить на сервер'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

