import React, { useState, useRef, useEffect } from 'react';
import { Hash, Users, Search, Pin, Smile, Send, Paperclip, Mic, Camera } from 'lucide-react';
import { toast } from 'sonner';
import type { Message, Channel } from '../models';
import { UserAvatar } from './UserAvatar';
import * as chatApi from '../api/chat';
import { useIsMobile } from './ui/use-mobile';
import { toSecureContentUrl } from '../utils/contentUrl';
import { useAuth } from '../contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ChatViewProps {
  channel: Channel;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSendVideoCircle?: (file: Blob, durationMs: number) => void;
  onLoadMore?: () => void;
  loading?: boolean;
  onDeleteMessage?: (messageId: string) => void;
}

export function ChatView({
  channel,
  messages,
  onSendMessage,
  onSendVideoCircle,
  onLoadMore,
  loading,
  onDeleteMessage,
}: ChatViewProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef<number | null>(null);
  const circleVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const overlayCircleVideoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRecordingVideoRef = useRef<HTMLVideoElement | null>(null);
  const isMobile = useIsMobile();
  const isTouchDevice =
    typeof window !== 'undefined' &&
    (('ontouchstart' in window) || (navigator as any).maxTouchPoints > 0);
  const recordPressTimeoutRef = useRef<number | null>(null);
  const [contextMessageId, setContextMessageId] = useState<string | null>(null);

  // Привязка live-просмотра к актуальному mediaStream, в том числе при повторной записи
  useEffect(() => {
    const video = overlayRecordingVideoRef.current;
    const stream = mediaStreamRef.current;
    if (isRecording && video && stream) {
      try {
        (video as HTMLVideoElement & { srcObject?: MediaStream | null }).srcObject = stream;
        void video.play();
      } catch {
        // ignore preview errors
      }
    }
    if (!isRecording && video) {
      try {
        (video as HTMLVideoElement & { srcObject?: MediaStream | null }).srcObject = null;
      } catch {
        // ignore
      }
    }
  }, [isRecording]);

  // При заходе в диалог и при появлении нового последнего сообщения —
  // прокрутка к низу (не трогаем скролл при подгрузке истории сверху).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [channel.id, messages[messages.length - 1]?.id]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      const prefix = replyToMessage ? `↪ ${replyToMessage.userName ?? 'Пользователь'}: ` : '';
      onSendMessage(`${prefix}${inputValue}`);
      setInputValue('');
      setReplyToMessage(null);
      setShowEmojiPicker(false);
    }
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const cleanupMedia = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    mediaStreamRef.current = null;
    // Сбрасываем превью, чтобы при следующей записи не оставался старый поток
    if (overlayRecordingVideoRef.current) {
      try {
        (overlayRecordingVideoRef.current as HTMLVideoElement & { srcObject?: MediaStream | null }).srcObject =
          null;
      } catch {
        // ignore
      }
    }
    recordChunksRef.current = [];
    recordStartedAtRef.current = null;
  };

  const startVideoRecording = async () => {
    if (!onSendVideoCircle || channel.type !== 'dm') {
      toast.info('Видеосообщения доступны только в личных сообщениях');
      return;
    }
    if (!isTouchDevice) {
      toast.info('Запись видеосообщений доступна только на мобильных устройствах');
      return;
    }
    if (isRecording) return;

    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function' ||
        typeof MediaRecorder === 'undefined'
      ) {
        if (videoInputRef.current) {
          videoInputRef.current.click();
          return;
        }
        toast.error('Запись видео не поддерживается в этом браузере');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      mediaStreamRef.current = stream;
      let mimeType = 'video/webm;codecs=vp8';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
          mimeType = 'video/mp4;codecs=h264';
        }
      }
      const recorder = new MediaRecorder(stream, { mimeType });
      recordChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const startedAt = recordStartedAtRef.current;
        const durationMs = startedAt ? Date.now() - startedAt : 0;
        const blob = new Blob(recordChunksRef.current, { type: mimeType });
        cleanupMedia();
        setIsRecording(false);
        if (blob.size === 0) return;
        void onSendVideoCircle(blob, durationMs);
      };
      mediaRecorderRef.current = recorder;
      recordStartedAtRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      cleanupMedia();
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Доступ к камере/микрофону запрещён'
          : 'Не удалось запустить запись видео';
      toast.error(message);
    }
  };

  const stopVideoRecording = () => {
    if (!isRecording) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupMedia();
      setIsRecording(false);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбрасываем value, чтобы можно было выбрать тот же файл ещё раз
    e.target.value = '';
    if (!file) return;

    if (!onSendVideoCircle || channel.type !== 'dm') {
      toast.info('Видеосообщения доступны только в личных сообщениях');
      return;
    }

    // Пока не считаем точную длительность — backend корректно обрабатывает duration_ms = 0.
    void onSendVideoCircle(file, 0);
  };

  const handleVoiceRecordPressStart = () => {
    if (!isMobile || channel.type !== 'dm') return;
    if (inputValue.trim()) return;
    toast.info('Голосовые сообщения пока в разработке');
  };

  const handleVoiceRecordPressEnd = () => {
    // Заглушка под будущее внедрение записи голоса
  };

  const handleVideoRecordPressStart = () => {
    if (!isMobile || channel.type !== 'dm') return;
    if (inputValue.trim()) return;
    void startVideoRecording();
  };

  const handleVideoRecordPressEnd = () => {
    if (!isMobile || channel.type !== 'dm') return;
    if (isRecording) {
      stopVideoRecording();
    }
  };

  /** Ключ минуты для группировки: один блок на одного пользователя в одну минуту. */
  const minuteKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;

  const pauseAllCircleVideos = () => {
    Object.values(circleVideoRefs.current).forEach((video) => {
      if (!video) return;
      video.muted = true;
      video.pause();
    });
  };

  const handleCircleClick = (messageId: string) => {
    if (activeCircleId === messageId) {
      setActiveCircleId(null);
      pauseAllCircleVideos();
      if (overlayCircleVideoRef.current) {
        overlayCircleVideoRef.current.pause();
        overlayCircleVideoRef.current.currentTime = 0;
      }
    } else {
      setActiveCircleId(messageId);
      pauseAllCircleVideos();
    }
  };

  const handleAttachFiles = async (files: File[]) => {
    if (!files.length) return;
    if (!channel.id) return;
    try {
      await chatApi.postAttachments(channel.id, files);
      toast.success('Файлы отправлены');
    } catch (e) {
      toast.error('Не удалось отправить файлы');
    }
  };

  const EMOJIS = ['😀', '😁', '😂', '😍', '👍', '🔥', '❤️', '🙏', '🎧', '🎥', '😉', '😎'];
  const LONG_PRESS_MS = 500;

  const openMessageMenuByLongPress = (messageId: string) => {
    if (recordPressTimeoutRef.current != null) {
      window.clearTimeout(recordPressTimeoutRef.current);
    }
    recordPressTimeoutRef.current = window.setTimeout(() => {
      setContextMessageId(messageId);
    }, LONG_PRESS_MS);
  };

  const closeMessageMenuLongPress = () => {
    if (recordPressTimeoutRef.current != null) {
      window.clearTimeout(recordPressTimeoutRef.current);
      recordPressTimeoutRef.current = null;
    }
  };

  const handleCopyMessage = async (message: Message) => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Текст сообщения скопирован');
    } catch {
      toast.error('Не удалось скопировать текст');
    }
  };

  const handleForwardMessage = async (message: Message) => {
    if (!message.content) {
      toast.info('Пересылка вложений будет добавлена позже');
      return;
    }
    try {
      const dmChannels = await chatApi.getDmChannels();
      if (dmChannels.length === 0) {
        toast.info('Нет доступных диалогов для пересылки');
        return;
      }
      const variants = dmChannels
        .slice(0, 9)
        .map((dm, idx) => `${idx + 1}. ${dm.other_user.username}`)
        .join('\n');
      const raw = window.prompt(`Выберите диалог для пересылки:\n${variants}\n\nВведите номер:`);
      if (!raw) return;
      const selected = Number(raw) - 1;
      if (!Number.isInteger(selected) || selected < 0 || selected >= Math.min(dmChannels.length, 9)) {
        toast.error('Неверный номер диалога');
        return;
      }
      await chatApi.postMessage(dmChannels[selected].id, message.content);
      toast.success('Сообщение переслано');
    } catch {
      toast.error('Не удалось переслать сообщение');
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    const isOwn = user?.id === message.userId;
    if (!isOwn) {
      if (channel.type === 'dm') {
        toast.error('В личных сообщениях можно удалять только свои сообщения');
      } else {
        toast.info('Удаление чужих сообщений на сервере будет доступно после ролевой модели');
      }
      return;
    }
    try {
      await chatApi.deleteMessage(message.id);
      onDeleteMessage?.(message.id);
      toast.success('Сообщение удалено');
    } catch {
      toast.error('Не удалось удалить сообщение');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 glass">
      {/* Channel header - hidden on mobile (MobileHeader shows instead) */}
      <div className="hidden md:flex h-12 px-4 items-center justify-between border-b border-white/5 glass">
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
      <div
        className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 py-3 md:py-4 space-y-3 md:space-y-4"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files || []);
          void handleAttachFiles(files);
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop < 80) {
            onLoadMore?.();
          }
        }}
      >
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
                <DropdownMenu
                  open={contextMessageId === message.id}
                  onOpenChange={(open) => {
                    if (!open) setContextMessageId(null);
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <div
                      className="flex gap-2 md:gap-3 hover:bg-white/[0.02] -mx-3 md:-mx-4 px-3 md:px-4 py-1 rounded transition-colors group"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMessageId(message.id);
                      }}
                      onTouchStart={() => openMessageMenuByLongPress(message.id)}
                      onTouchEnd={closeMessageMenuLongPress}
                      onTouchCancel={closeMessageMenuLongPress}
                    >
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
                        {message.attachments && message.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {message.attachments.map((att: any, idx: number) => {
                          if (!att) return null;
                          if (att.type === 'video_circle' && idx === 0) {
                            return (
                              <div
                                key={`${message.id}-circle`}
                                className="inline-flex items-center justify-center rounded-full bg-black/40 overflow-hidden w-32 h-32 md:w-40 md:h-40 cursor-pointer group/video"
                                onClick={() => handleCircleClick(message.id)}
                              >
                                <video
                                  ref={(el) => {
                                    circleVideoRefs.current[message.id] = el;
                                  }}
                                  src={toSecureContentUrl(att.url) ?? ''}
                                  muted
                                  playsInline
                                  loop
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            );
                          }
                          if (att.type === 'image') {
                            return (
                              <div key={`${message.id}-img-${idx}`} className="inline-block max-w-xs rounded-xl overflow-hidden border border-white/10 bg-black/20">
                                <img
                                  src={toSecureContentUrl(att.url) ?? ''}
                                  alt={att.filename ?? 'image'}
                                  className="max-h-72 w-full object-contain"
                                />
                              </div>
                            );
                          }
                          if (att.type === 'video') {
                            return (
                              <div
                                key={`${message.id}-video-${idx}`}
                                className="inline-block max-w-xs rounded-xl overflow-hidden border border-white/10 bg-black/30"
                              >
                                <video
                                  src={toSecureContentUrl(att.url) ?? ''}
                                  controls
                                  playsInline
                                  className="max-h-72 w-full object-contain bg-black"
                                />
                              </div>
                            );
                          }
                          if (att.type === 'file') {
                            const filename: string = att.filename ?? 'file';
                            const dotIndex = filename.lastIndexOf('.');
                            const baseName =
                              dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
                            const ext =
                              dotIndex > 0 ? filename.slice(dotIndex + 1).toUpperCase() : '';
                            return (
                              <a
                                key={`${message.id}-file-${idx}`}
                                href={toSecureContentUrl(att.url) ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#22222b] border border-white/10 hover:border-violet-500/60 hover:bg-[#262636] transition-colors max-w-xs"
                              >
                                <div className="w-8 h-8 rounded-md bg-violet-600/80 flex items-center justify-center text-xs font-semibold">
                                  {ext || 'FILE'}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm text-white truncate">{baseName}</div>
                                  {ext && (
                                    <div className="text-[11px] text-gray-400 uppercase">
                                      {ext} файл
                                    </div>
                                  )}
                                </div>
                              </a>
                            );
                          }
                          return null;
                        })}
                        {message.content && (
                          <p className="text-gray-200 text-[14px] md:text-[15px] break-words leading-relaxed min-w-0 selectable-text">
                            {message.content
                              .split(/(https?:\/\/[^\s]+)/g)
                              .map((part, idx) =>
                                /^https?:\/\//.test(part) ? (
                                  <a
                                    key={idx}
                                    href={part}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-violet-400 hover:underline break-all"
                                  >
                                    {part}
                                  </a>
                                ) : (
                                  <span key={idx}>{part}</span>
                                )
                              )}
                          </p>
                        )}
                      </div>
                ) : (
                  <p className="text-gray-200 text-[14px] md:text-[15px] break-words leading-relaxed min-w-0 selectable-text">
                    {message.content
                      ?.split(/(https?:\/\/[^\s]+)/g)
                      .map((part, idx) =>
                        /^https?:\/\//.test(part) ? (
                          <a
                            key={idx}
                            href={part}
                            target="_blank"
                            rel="noreferrer"
                            className="text-violet-400 hover:underline break-all"
                          >
                            {part}
                          </a>
                        ) : (
                          <span key={idx}>{part}</span>
                        )
                      ) ?? ''}
                  </p>
                )}
                  </div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="glass-modal border-white/10 text-white min-w-[200px]">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setReplyToMessage(message)}
                    >
                      Ответить на сообщение
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => void handleCopyMessage(message)}
                    >
                      Копировать текст
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => void handleForwardMessage(message)}
                    >
                      Переслать в другой диалог
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => toast.info('Закрепление сообщений будет добавлено позже')}
                    >
                      Закрепить
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-red-400 focus:text-red-300"
                      onClick={() => void handleDeleteMessage(message)}
                    >
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Overlay для активного кружка */}
      {activeCircleId && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center"
          onClick={() => {
            setActiveCircleId(null);
            pauseAllCircleVideos();
            if (overlayCircleVideoRef.current) {
              overlayCircleVideoRef.current.pause();
              overlayCircleVideoRef.current.currentTime = 0;
            }
          }}
        >
          {messages
            .filter((m) => m.id === activeCircleId)
            .map((m) => {
              const att = m.attachments?.[0] as any;
              if (!att || att.type !== 'video_circle') return null;
              return (
                <div
                  key={m.id}
                  className="relative w-[320px] h-[320px] md:w-[380px] md:h-[380px] rounded-full overflow-hidden bg-black"
                >
                  <video
                    ref={overlayCircleVideoRef}
                    src={toSecureContentUrl(att.url) ?? ''}
                    autoPlay
                    playsInline
                    muted={false}
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
              );
            })}
        </div>
      )}

      {/* Overlay живого предпросмотра во время записи кружка */}
      {isRecording && mediaStreamRef.current && (
        <div className="fixed inset-0 z-[55] bg-black/80 flex items-center justify-center">
          <div className="relative w-[320px] h-[320px] md:w-[380px] md:h-[380px] rounded-full overflow-hidden bg-black">
            <video
              ref={overlayRecordingVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Message input + media / voice-video controls */}
      <div className="p-3 md:p-4">
        {replyToMessage && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-2">
            <div className="text-xs text-gray-300 truncate">
              Ответ: {replyToMessage.userName ?? 'Пользователь'}
            </div>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-white"
              onClick={() => setReplyToMessage(null)}
            >
              Отмена
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end gap-2 md:gap-3">
            {/* Big media attach button (outside input) */}
            <button
              type="button"
              onClick={() => attachInputRef.current?.click()}
              className="flex-shrink-0 h-11 w-11 md:h-12 md:w-12 rounded-full glass-input flex items-center justify-center hover:border-violet-500/60 transition-colors shadow-sm"
            >
              <Paperclip className="w-5 h-5 md:w-6 md:h-6 text-gray-300" />
            </button>

            {/* Text input with emoji / send (send button справа внутри поля) */}
            <div className="flex-1 glass-input rounded-lg focus-within:border-violet-500/50 transition-colors">
              <div className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2.5 md:py-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    channel.type === 'dm'
                      ? `Написать ${channel.name}`
                      : `Написать в #${channel.name}`
                  }
                  className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 outline-none text-[14px] md:text-[15px]"
                />
                {inputValue.trim() ? (
                  <button
                    type="submit"
                    className="flex-shrink-0 p-1.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg"
                    aria-label="Отправить сообщение"
                  >
                    <Send className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <Smile className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white transition-colors" />
                  </button>
                )}
              </div>
            </div>

            {/* Voice / video record buttons — только на мобильных устройствах и в ЛС */}
            {isMobile && channel.type === 'dm' && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onMouseDown={handleVoiceRecordPressStart}
                  onMouseUp={handleVoiceRecordPressEnd}
                  onMouseLeave={handleVoiceRecordPressEnd}
                  onTouchStart={handleVoiceRecordPressStart}
                  onTouchEnd={handleVoiceRecordPressEnd}
                  className="flex-shrink-0 h-9 w-9 md:h-10 md:w-10 rounded-full glass-input flex items-center justify-center hover:border-white/15 transition-colors"
                  aria-label="Записать голосовое сообщение"
                >
                  <Mic className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
                <button
                  type="button"
                  onMouseDown={handleVideoRecordPressStart}
                  onMouseUp={handleVideoRecordPressEnd}
                  onMouseLeave={handleVideoRecordPressEnd}
                  onTouchStart={handleVideoRecordPressStart}
                  onTouchEnd={handleVideoRecordPressEnd}
                  className="flex-shrink-0 h-9 w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-tr from-violet-700 to-purple-700 flex items-center justify-center shadow-lg hover:from-violet-500 hover:to-purple-500 transition-all"
                  aria-label="Записать видеосообщение"
                >
                  <Camera className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
              </div>
            )}
          </div>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="user"
            className="hidden"
            onChange={handleVideoFileChange}
          />
          <input
            ref={attachInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              void handleAttachFiles(files);
            }}
          />
          {showEmojiPicker && (
            <div className="absolute bottom-16 left-14 md:left-16 z-20 rounded-xl glass-panel p-2 flex flex-wrap gap-1 w-56 shadow-xl">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-lg"
                  onClick={() => setInputValue((prev) => prev + emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}