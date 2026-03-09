import { useState } from 'react';
import { Volume2, Mic, MicOff, Headphones, PhoneOff, Settings, UserPlus, Radio, VolumeX } from 'lucide-react';
import type { Channel, VoiceUser } from '../types';

interface VoiceChannelViewProps {
  channel: Channel | null;
  users: VoiceUser[];
  onLeaveChannel: () => void;
}

export function VoiceChannelView({ channel, users, onLeaveChannel }: VoiceChannelViewProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  if (channel == null) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1f]">
      {/* Channel header - hidden on mobile (MobileHeader shows instead) */}
      <div className="hidden md:flex h-12 px-4 items-center justify-between border-b border-white/5 bg-gradient-to-r from-violet-600/10 to-purple-600/10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-violet-400" />
          <h3 className="font-semibold text-white">{channel.name}</h3>
          <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-green-500/20 rounded-full">
            <Radio className="w-3 h-3 text-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Подключено</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <UserPlus className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <Settings className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>
      </div>
      
      {/* Voice users grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
          {users.map((user) => (
            <div
              key={user.id}
              className="relative group"
            >
              <div className="relative">
                {/* Avatar */}
                <div 
                  className={`
                    w-full aspect-square rounded-2xl flex items-center justify-center text-4xl md:text-6xl
                    transition-all duration-300
                    ${user.isSpeaking 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-2xl shadow-green-500/50 scale-105' 
                      : 'bg-gradient-to-br from-gray-700 to-gray-800'
                    }
                  `}
                >
                  {user.avatar}
                </div>
                
                {/* Speaking indicator */}
                {user.isSpeaking && (
                  <div className="absolute inset-0 rounded-2xl border-4 border-green-400 animate-pulse" />
                )}
                
                {/* Status indicators */}
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
              
              {/* User name */}
              <div className="mt-2 md:mt-3 text-center">
                <p className="font-medium text-white text-sm md:text-base truncate">{user.name}</p>
                <p className="text-xs md:text-sm text-gray-400">
                  {user.isSpeaking ? 'Говорит...' : user.isMuted ? 'Микрофон выкл' : 'Активен'}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Empty state */}
        {users.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center mb-4">
              <Volume2 className="w-12 h-12 md:w-16 md:h-16 text-violet-400" />
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Голосовой канал пуст</h3>
            <p className="text-gray-400 text-sm md:text-base">Пригласите друзей присоединиться!</p>
          </div>
        )}
      </div>
      
      {/* Voice controls */}
      <div className="h-16 md:h-20 px-4 md:px-6 bg-[#0f0f12] border-t border-white/5 flex items-center justify-center gap-3 md:gap-4">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`
            w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95
            ${isMuted 
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
              : 'bg-[#2a2a32] hover:bg-[#35353f]'
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
          onClick={() => setIsDeafened(!isDeafened)}
          className={`
            w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95
            ${isDeafened 
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
              : 'bg-[#2a2a32] hover:bg-[#35353f]'
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
          onClick={onLeaveChannel}
          className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-red-500/20 hover:bg-red-500 flex items-center justify-center transition-all duration-200 group shadow-lg hover:shadow-red-500/50 active:scale-95"
        >
          <PhoneOff className="w-4 h-4 md:w-5 md:h-5 text-red-400 group-hover:text-white transition-colors" />
        </button>
        
        <div className="w-px h-6 md:h-8 bg-white/10" />
        
        <button className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-[#2a2a32] hover:bg-[#35353f] flex items-center justify-center transition-all duration-200 active:scale-95">
          <Settings className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
}