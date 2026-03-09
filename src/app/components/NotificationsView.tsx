/**
 * Страница уведомлений (заглушка для будущего функционала).
 */

import { ArrowLeft, Bell } from 'lucide-react';

interface NotificationsViewProps {
  onBack: () => void;
}

export function NotificationsView({ onBack }: NotificationsViewProps) {
  return (
    <div className="h-screen flex flex-col bg-[#1a1a1f] text-white">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Уведомления</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-xl mx-auto w-full">
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-gray-400">
          <Bell className="w-16 h-16 opacity-50" />
          <p className="text-center">Раздел в разработке. Здесь будут уведомления о сообщениях и событиях.</p>
        </div>
      </div>
    </div>
  );
}
