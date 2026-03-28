/**
 * Карточка профиля пользователя: аватар, тег (@nametag), статус, действия.
 */
import React, { useState } from 'react';
import { X, MessageCircle, Link2, Ban, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from './UserAvatar';
import { Button } from './ui/button';
import { toastCopy } from '../utils/toastMessages';
import { toSecureContentUrl } from '../utils/contentUrl';

export type UserPresenceStatus = 'online' | 'offline' | 'dnd';

const statusLabel: Record<UserPresenceStatus, string> = {
  online: 'В сети',
  offline: 'Не в сети',
  dnd: 'Не беспокоить',
};

const statusDot: Record<UserPresenceStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  dnd: 'bg-red-500',
};

export interface UserProfileOverlayProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  nametag?: string | null;
  avatarUrl?: string | null;
  presence?: UserPresenceStatus;
  onMessageClick: () => void;
  showMessageButton?: boolean;
}

export function UserProfileOverlay({
  open,
  onClose,
  userId,
  username,
  nametag,
  avatarUrl,
  presence = 'offline',
  onMessageClick,
  showMessageButton = true,
}: UserProfileOverlayProps) {
  const [avatarFullscreen, setAvatarFullscreen] = useState(false);

  if (!open) return null;

  const tag = nametag?.trim() ? `@${nametag}` : `@${username}`;
  const resolvedAvatar =
    avatarUrl?.startsWith('http') || avatarUrl?.startsWith('emoji:')
      ? avatarUrl
      : avatarUrl
        ? `emoji:${avatarUrl}`
        : undefined;

  const profileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}?user=${encodeURIComponent(userId)}`
      : '';

  const isEmojiAvatar = resolvedAvatar?.startsWith('emoji:');
  const fullscreenImgSrc =
    resolvedAvatar && !isEmojiAvatar ? toSecureContentUrl(resolvedAvatar) : null;

  const copyText = async (text: string, okToast: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okToast);
    } catch {
      toast.error(toastCopy.copyFailed);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="w-full max-w-sm rounded-2xl glass-modal border border-white/10 text-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="flex justify-end p-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="px-6 pb-8 flex flex-col items-center text-center gap-4">
            <button
              type="button"
              className="w-48 h-48 md:w-52 md:h-52 rounded-full overflow-hidden shadow-xl ring-2 ring-white/10 shrink-0 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              onClick={() => setAvatarFullscreen(true)}
              aria-label="Открыть аватар"
            >
              <UserAvatar
                avatarUrl={resolvedAvatar}
                alt={username}
                size="lg"
                className="!size-full !rounded-full"
              />
            </button>
            <div className="w-full">
              <h2 className="text-xl font-semibold truncate max-w-full">{username}</h2>
              <button
                type="button"
                className="text-sm text-violet-300 mt-1 font-mono hover:text-violet-200 underline-offset-2 hover:underline cursor-pointer mx-auto block"
                onClick={() => void copyText(tag, toastCopy.copied)}
              >
                {tag}
              </button>
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-300">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot[presence]}`}
                  aria-hidden
                />
                <span>{statusLabel[presence]}</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/15 text-gray-200 hover:bg-white/10 gap-2 justify-start"
                onClick={() => void copyText(profileUrl, toastCopy.copiedLink)}
              >
                <Link2 className="w-4 h-4 shrink-0" />
                Скопировать ссылку на профиль
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/15 text-gray-200 hover:bg-white/10 gap-2 justify-start"
                onClick={() => toast.info(toastCopy.featureSoon)}
              >
                <Ban className="w-4 h-4 shrink-0" />
                Заблокировать
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/15 text-gray-200 hover:bg-white/10 gap-2 justify-start"
                onClick={() => toast.info(toastCopy.featureSoon)}
              >
                <Flag className="w-4 h-4 shrink-0" />
                Пожаловаться
              </Button>
            </div>

            {showMessageButton && (
              <Button
                type="button"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white gap-2"
                onClick={() => {
                  onMessageClick();
                  onClose();
                }}
              >
                <MessageCircle className="w-4 h-4" />
                Написать сообщение
              </Button>
            )}
          </div>
        </div>
      </div>

      {avatarFullscreen && (
        <div
          className="fixed inset-0 z-[110] bg-black flex items-center justify-center p-4"
          role="presentation"
          onClick={() => setAvatarFullscreen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 z-10"
            aria-label="Закрыть"
            onClick={(e) => {
              e.stopPropagation();
              setAvatarFullscreen(false);
            }}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div
            className="max-h-[90vh] max-w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {isEmojiAvatar ? (
              <span className="text-[min(25vw,120px)] leading-none select-none">
                {resolvedAvatar!.slice(6)}
              </span>
            ) : fullscreenImgSrc ? (
              <img
                src={fullscreenImgSrc}
                alt=""
                className="max-h-[90vh] max-w-full object-contain rounded-lg"
              />
            ) : (
              <UserAvatar
                avatarUrl={resolvedAvatar}
                alt={username}
                size="lg"
                className="!w-32 !h-32 md:!w-40 md:!h-40"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
