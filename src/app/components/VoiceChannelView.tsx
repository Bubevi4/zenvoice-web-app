import { useState } from 'react';
import { Volume2, Mic, MicOff, Headphones, PhoneOff, Settings, UserPlus, Radio, VolumeX, Loader2 } from 'lucide-react';
import type { Channel, VoiceUser } from '../types';
import { UserAvatar } from './UserAvatar';

interface VoiceChannelViewProps {
  channel: Channel | null;
  users: VoiceUser[];
  currentUserId?: string;
  connecting?: boolean;
  onLeaveChannel: () => void;
}

export function VoiceChannelView({ channel, users, currentUserId, connecting, onLeaveChannel }: VoiceChannelViewProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  if (channel == null) return null;

  return (
    <div className="flex-1 flex flex-col glass">
      <div className="hidden md:flex h-12 px-4 items-center justify-between border-b border-white/5 glass">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-violet-400" />
          <h3 className="font-semibold text-white">{channel.name}</h3>
          {connecting ? (
            <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-amber-500/20 rounded-full">
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-xs text-amber-400 font-medium">Подключение...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-green-500/20 rounded-full">
              <Radio className="w-3 h-3 text-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Подключено</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <UserPlus className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
          <button type="button" className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <Settings className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {connecting && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin mb-4" />
            <p className="text-gray-400">Подключение к каналу...</p>
          </div>
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
          {users.map((user) => {
            const isYou = currentUserId && user.userId === currentUserId;
            return (
            <div
              key={user.id}
              className="relative group"
            >
              <div className="relative">
                <div 
                  className={`
                    w-full aspect-square rounded-2xl flex items-center justify-center overflow-hidden text-4xl md:text-6xl
                    transition-all duration-300
                    ${user.isSpeaking 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-2xl shadow-green-500/50 scale-105' 
                      : 'bg-gradient-to-br from-gray-700 to-gray-800'
                    }
                  `}
                >
                  {user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('emoji:')) ? (
                    <UserAvatar
                      avatarUrl={user.avatar}
                      alt={user.name}
                      size="lg"
                      className="w-full h-full rounded-2xl !rounded-2xl"
                    />
                  ) : (
                    <span className="select-none">{user.avatar || '🎧'}</span>
                  )}
                </div>
                
                {user.isSpeaking && (
                  <div className="absolute inset-0 rounded-2xl border-4 border-green-400 animate-pulse pointer-events-none" />
                )}
                
                <div className="absolute bottom-2 right-2 flex gap-1">
                  {user.isMuted && (
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                      <MicOff className="w-3 h-3 md:w-4 md:h-4 text-white" />
                    </div>
                  )}
                  {user.isDeafened && (
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-gray-600 flex items-center justify-center shadow-lg">
                      <VolumeX className="w-3 h-3 md:w-4 md:h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-2 md:mt-3 text-center">
                <p className="font-medium text-white text-sm md:text-base truncate">
                  {isYou ? 'Вы' : user.name}
                </p>
                <p className="text-xs md:text-sm text-gray-400">
                  {user.isSpeaking ? 'Говорит...' : user.isMuted ? 'Микрофон выкл' : isYou ? 'В канале' : 'Активен'}
                </p>
              </div>
            </div>
            );
          })}
        </div>
        )}
        
        {!connecting && users.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center mb-4">
              <Volume2 className="w-12 h-12 md:w-16 md:h-16 text-violet-400" />
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Голосовой канал пуст</h3>
            <p className="text-gray-400 text-sm md:text-base">Пригласите друзей присоединиться!</p>
          </div>
        )}
      </div>
      
      <div className="h-16 md:h-20 px-4 md:px-6 glass-panel border-t border-white/5 flex items-center justify-center gap-3 md:gap-4">
        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className={`
            w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95
            ${isMuted 
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
              : 'glass-input hover:border-white/15'
            }
          `}
        >
          {isMuted ? (
            <MicOff className="w-4 h-4 md:w-5 md:h-5 text-white" />
          ) : (
            <Mic className="w-4 h-4 md:w-5 md:h-5 text-white" />
          )}
        </button>
        
        <button
          type="button"
          onClick={() => setIsDeafened(!isDeafened)}
          className={`
            w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95
            ${isDeafened 
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
              : 'glass-input hover:border-white/15'
            }
          `}
        >
          {isDeafened ? (
            <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-white" />
          ) : (
            <Headphones className="w-4 h-4 md:w-5 md:h-5 text-white" />
          )}
        </button>
        
        <div className="w-px h-6 md:h-8 bg-white/10" />
        
        <button
          type="button"
          onClick={onLeaveChannel}
          className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-red-500/20 hover:bg-red-500 flex items-center justify-center transition-all duration-200 group shadow-lg hover:shadow-red-500/50 active:scale-95"
        >
          <PhoneOff className="w-4 h-4 md:w-5 md:h-5 text-red-400 group-hover:text-white transition-colors" />
        </button>
        
        <div className="w-px h-6 md:h-8 bg-white/10" />
        
        <button type="button" className="w-11 h-11 md:w-12 md:h-12 rounded-xl glass-input flex items-center justify-center transition-all duration-200 active:scale-95">
          <Settings className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
}
