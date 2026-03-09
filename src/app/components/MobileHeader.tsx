import { Menu, Hash, Volume2, X, Radio } from 'lucide-react';
import type { Channel } from '../types';

interface MobileHeaderProps {
  channel: Channel | null;
  onMenuClick: () => void;
  isMenuOpen: boolean;
}

export function MobileHeader({ channel, onMenuClick, isMenuOpen }: MobileHeaderProps) {
  if (channel == null) return null;
  const isVoiceChannel = channel.type === 'voice';
  
  return (
    <div
      className={`
        md:hidden h-14 px-4 flex items-center justify-between border-b border-white/5 backdrop-blur-sm sticky top-0 z-50 shrink-0
        ${isVoiceChannel
          ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 border-violet-500/30'
          : 'bg-[#16161b]/95'
        }
      `}
    >
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
      >
        {isMenuOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>
      
      <div className="flex items-center gap-2 flex-1 justify-center">
        {channel.type === 'text' ? (
          <>
            <Hash className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-white">{channel.name}</h3>
          </>
        ) : (
          <>
            <Volume2 className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold text-white">{channel.name}</h3>
            <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-green-500/20 rounded-full">
              <Radio className="w-2.5 h-2.5 text-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium">Подключено</span>
            </div>
          </>
        )}
      </div>
      
      <div className="w-10" /> {/* Spacer for centering */}
    </div>
  );
}