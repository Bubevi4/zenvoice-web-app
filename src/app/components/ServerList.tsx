import { Plus } from 'lucide-react';
import type { Server } from '../types';
import { UnreadBadge } from './UnreadBadge';

export const HOME_SERVER_ID = 'home';

interface ServerListProps {
  servers: Server[];
  activeServerId: string;
  onServerClick: (serverId: string) => void;
  onAddServer: () => void;
  onOpenProfile?: () => void;
  onOpenAppSettings?: () => void;
  onOpenNotifications?: () => void;
  currentUserAvatar?: string | null;
  homeUnreadCount?: number;
  serverUnreadById?: Record<string, number>;
}

export function ServerList({
  servers,
  activeServerId,
  onServerClick,
  onAddServer,
  homeUnreadCount = 0,
  serverUnreadById = {},
}: ServerListProps) {
  return (
    <div className="w-[72px] glass-panel flex flex-col items-center py-3 gap-2 border-r border-white/5 shrink-0">
      <button
        onClick={() => onServerClick(HOME_SERVER_ID)}
        className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 hover:rounded-xl active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl shadow-lg hover:shadow-violet-500/50 ${
          activeServerId === HOME_SERVER_ID ? 'rounded-xl ring-2 ring-white/30' : ''
        }`}
        title="Личные сообщения"
      >
        <img src="/favicon.ico" alt="DMs" className="w-7 h-7 rounded-lg" />
        <span className="absolute -top-0.5 -right-0.5 flex min-w-[16px] justify-center pointer-events-none">
          <UnreadBadge count={homeUnreadCount} />
        </span>
      </button>

      <div className="w-8 h-[2px] bg-white/10 rounded-full my-1" />

      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide flex-1">
        {servers.map((server) => {
          const srvUnread = serverUnreadById[server.id] ?? 0;
          return (
            <button
              key={server.id}
              onClick={() => onServerClick(server.id)}
              className={`
              relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
              transition-all duration-200 group active:scale-95
              ${activeServerId === server.id 
                ? 'rounded-xl shadow-lg' 
                : 'hover:rounded-xl opacity-80 hover:opacity-100'
              }
            `}
              style={{
                backgroundColor: server.color ?? '#7c3aed',
                boxShadow: activeServerId === server.id 
                  ? `0 0 20px ${(server.color ?? '#7c3aed')}50` 
                  : 'none'
              }}
              title={server.name}
            >
              {server.icon ?? server.icon_url ?? '🏠'}
              {activeServerId === server.id && (
                <div 
                  className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                  style={{ backgroundColor: server.color ?? '#7c3aed' }}
                />
              )}
              <span className="absolute -top-0.5 -right-0.5 flex min-w-[16px] justify-center pointer-events-none">
                <UnreadBadge count={srvUnread} />
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onAddServer}
        className="w-12 h-12 rounded-2xl glass hover:bg-gradient-to-br hover:from-green-600 hover:to-emerald-600 hover:rounded-xl active:scale-95 transition-all duration-200 flex items-center justify-center group"
        title="Добавить сервер"
      >
        <Plus className="w-6 h-6 text-green-500 group-hover:text-white transition-colors" />
      </button>
    </div>
  );
}
