import { Bell, Plus, Settings, User } from 'lucide-react';
import type { Server } from '../types';

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
}

export function ServerList({
  servers,
  activeServerId,
  onServerClick,
  onAddServer,
  onOpenProfile,
  onOpenAppSettings,
  onOpenNotifications,
  currentUserAvatar,
}: ServerListProps) {
  return (
    <div className="w-[72px] glass-panel flex flex-col items-center py-3 gap-2 border-r border-white/5 shrink-0">
      {/* Home — личные чаты (ЛС) */}
      <button
        onClick={() => onServerClick(HOME_SERVER_ID)}
        className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 hover:rounded-xl active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl shadow-lg hover:shadow-violet-500/50 ${
          activeServerId === HOME_SERVER_ID ? 'rounded-xl ring-2 ring-white/30' : ''
        }`}
      >
        🏠
      </button>
      
      <div className="w-8 h-[2px] bg-white/10 rounded-full my-1" />
      
      {/* Server list */}
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide flex-1">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => onServerClick(server.id)}
            className={`
              w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
              transition-all duration-200 relative group active:scale-95
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
          >
            {server.icon ?? server.icon_url ?? '🏠'}
            {activeServerId === server.id && (
              <div 
                className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                style={{ backgroundColor: server.color ?? '#7c3aed' }}
              />
            )}
          </button>
        ))}
      </div>
      
      {/* Add server button */}
      <button
        onClick={onAddServer}
        className="w-12 h-12 rounded-2xl glass hover:bg-gradient-to-br hover:from-green-600 hover:to-emerald-600 hover:rounded-xl active:scale-95 transition-all duration-200 flex items-center justify-center group"
      >
        <Plus className="w-6 h-6 text-green-500 group-hover:text-white transition-colors" />
      </button>
    </div>
  );
}