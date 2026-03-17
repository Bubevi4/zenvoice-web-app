/**
 * Единый компонент аватара пользователя: URL, emoji (emoji:...) или fallback.
 */

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { cn } from './ui/utils';
import { toSecureContentUrl } from '../utils/contentUrl';

export interface UserAvatarProps {
  /** URL картинки или строка вида "emoji:😎" */
  avatarUrl?: string | null;
  /** Подпись для доступности */
  alt?: string;
  className?: string;
  /** Размер: sm (7), md (9), lg (12) */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-12',
};

export function UserAvatar({ avatarUrl, alt = '', className, size = 'md' }: UserAvatarProps) {
  const isEmoji = avatarUrl?.startsWith('emoji:');
  const emoji = isEmoji ? avatarUrl.slice(6) : null;
  const imgSrc = !isEmoji && avatarUrl ? toSecureContentUrl(avatarUrl) : undefined;
  const sizeClass = sizeClasses[size];

  const hasImage = Boolean(imgSrc);
  return (
    <Avatar
      className={cn(
        'shrink-0 overflow-hidden rounded-full shadow-lg',
        !hasImage && 'bg-gradient-to-br from-violet-600/50 to-purple-600/50',
        sizeClass,
        className
      )}
    >
      {imgSrc && <AvatarImage src={imgSrc} alt={alt} className="object-cover" />}
      <AvatarFallback
        className={hasImage ? 'bg-transparent' : 'bg-transparent text-lg md:text-xl flex items-center justify-center'}
        aria-hidden
      >
        {emoji ? emoji : '👤'}
      </AvatarFallback>
    </Avatar>
  );
}
