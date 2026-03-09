import React, { useState, useRef, useEffect } from 'react';
import { Hash, Users, Search, Pin, Smile, Send, Paperclip, Mic } from 'lucide-react';
import type { Message, Channel } from '../models';
import { UserAvatar } from './UserAvatar';

interface ChatViewProps {
  channel: Channel;
  messages: Message[];
  onSendMessage: (content: string) => void;
  loading?: boolean;
}

export function ChatView({ channel, messages, onSendMessage, loading }: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // При заходе в диалог (смена channel) и при новых сообщениях — прокрутка к последнему сообщению.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [channel.id, messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  /** Ключ минуты для группировки: один блок на одного пользователя в одну минуту. */
  const minuteKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1a1a1f]">
      {/* Channel header - hidden on mobile (MobileHeader shows instead) */}
      <div className="hidden md:flex h-12 px-4 items-center justify-between border-b border-white/5 bg-[#16161b]/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-white">{channel.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <Pin className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <Users className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <Search className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>
      </div>
      
      {/* Messages — скроллируемая область, можно листать историю */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 py-3 md:py-4 space-y-3 md:space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">Загрузка сообщений...</div>
        ) : (
          messages.map((message, index) => {
            const prev = messages[index - 1];
            const prevTs = prev
              ? (prev.timestamp instanceof Date ? prev.timestamp : new Date((prev as { created_at?: string }).created_at ?? 0))
              : null;
            const ts =
              message.timestamp instanceof Date
                ? message.timestamp
                : new Date((message as { created_at?: string }).created_at ?? 0);
            const prevMinuteKey = prevTs ? minuteKey(prevTs) : '';
            const currMinuteKey = minuteKey(ts);
            const sameUserAndMinute =
              prev && prev.userId === message.userId && prevMinuteKey === currMinuteKey;
            const showAvatar = index === 0 || !sameUserAndMinute;
            const timeDiff = prevTs ? ts.getTime() - prevTs.getTime() : 0;
            const showTimestamp = timeDiff > 5 * 60 * 1000; // 5 минут
            return (
              <div key={message.id}>
                {showTimestamp && (
                  <div className="flex items-center gap-2 my-3 md:my-4">
                    <div className="flex-1 h-[1px] bg-white/5" />
                    <span className="text-xs text-gray-500">
                      {ts.toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex-1 h-[1px] bg-white/5" />
                  </div>
                )}
                <div className="flex gap-2 md:gap-3 hover:bg-white/[0.02] -mx-3 md:-mx-4 px-3 md:px-4 py-1 rounded transition-colors group">
                  {showAvatar ? (
                    <div className="flex-shrink-0">
                      <UserAvatar
                        avatarUrl={
                          message.userAvatar?.startsWith('http')
                            ? message.userAvatar
                            : message.userAvatar
                              ? `emoji:${message.userAvatar}`
                              : undefined
                        }
                        alt={message.userName ?? ''}
                        size="md"
                        className="w-9 h-9 md:w-10 md:h-10"
                      />
                    </div>
                  ) : (
                    <div className="w-9 md:w-10 flex-shrink-0 flex items-start justify-center">
                      <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(ts)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline gap-2 mb-1 min-w-0">
                        <span className="font-semibold text-white text-sm truncate">
                          {message.userName ?? 'Участник'}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">
                          {formatTime(ts)}
                        </span>
                      </div>
                    )}
                    <p className="text-gray-200 text-[14px] md:text-[15px] break-words break-all leading-relaxed min-w-0">
                      {message.content ?? ''}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <div className="p-3 md:p-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="bg-[#2a2a32] rounded-lg border border-white/5 focus-within:border-violet-500/50 transition-colors">
            <div className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2.5 md:py-3">
              <button
                type="button"
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <Paperclip className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white transition-colors" />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={channel.type === 'dm' ? `Написать ${channel.name}` : `Написать в #${channel.name}`}
                className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 outline-none text-[14px] md:text-[15px]"
              />
              <button
                type="button"
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <Smile className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white transition-colors" />
              </button>
              <button
                type="button"
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <Mic className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white transition-colors" />
              </button>
              {inputValue.trim() && (
                <button
                  type="submit"
                  className="p-1.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-md hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg hover:shadow-violet-500/50"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}