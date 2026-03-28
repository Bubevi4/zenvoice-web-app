import React from 'react';

interface UnreadBadgeProps {
  count: number;
  className?: string;
}

/** Круглый бейдж с числом непрочитанного (макс. 99+). */
export function UnreadBadge({ count, className = '' }: UnreadBadgeProps) {
  if (count <= 0) return null;
  const text = count > 99 ? '99+' : String(count);
  return (
    <span
      className={`min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none shadow-sm ${className}`}
    >
      {text}
    </span>
  );
}
