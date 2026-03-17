/**
 * Landing page для ZenVoice — ранний доступ и презентация платформы.
 */

import React, { useState } from 'react';
import { ApiError } from '../api/client';
import { toast } from 'sonner';

export function LandingView() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Введите email');
      return;
    }
    setLoading(true);
    try {
      // Здесь будет вызов API для подписки на ранний доступ
      // await api.subscribeEarlyAccess(email);
      await new Promise((res) => setTimeout(res, 800)); // mock
      setSubscribed(true);
      toast.success('Вы в списке раннего доступа!');
      setEmail('');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ошибка подписки';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-violet-900/10 to-purple-900/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600" />
          <span className="text-xl font-semibold">ZenVoice</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Возможности</a>
          <a href="#preview" className="hover:text-white transition-colors">Предпросмотр</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Разработка в процессе
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold leading-tight mb-6">
            Голосовое общение{' '}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              нового поколения
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Платформа для команд и сообществ: голосовые каналы, текстовый чат, 
            серверы и приватные комнаты — всё в одном месте с фокусом на приватность.
          </p>

          {/* CTA Form */}
          <form onSubmit={handleSubmit} id="access" className="max-w-md mx-auto mb-8">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading || subscribed}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-violet-500/50 outline-none transition-colors disabled:opacity-50"
                required
              />
              <button
                type="submit"
                disabled={loading || subscribed}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {subscribed ? '✓ В списке' : loading ? '...' : 'Получить доступ'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Нажимая кнопку, вы соглашаетесь с условиями обработки данных
            </p>
          </form>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span>🔒 End-to-end шифрование</span>
            <span>•</span>
            <span>🌍 Low-latency серверы</span>
            <span>•</span>
            <span>🎙️ HD-голос</span>
          </div>
        </div>
      </section>

      {/* App Preview */}
      <section id="preview" className="relative z-10 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-[#111118] p-2 shadow-2xl">
            <div className="rounded-xl overflow-hidden bg-[#1a1a1f] aspect-video flex items-center justify-center">
              {/* Mock UI preview */}
              <div className="text-center p-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center">
                  <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-gray-400">Интерфейс платформы в разработке</p>
                <p className="text-sm text-gray-600 mt-1">Скоро здесь будет интерактивный превью</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-12">Возможности платформы</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: 'Серверы и каналы',
                desc: 'Организуйте пространство: текстовые и голосовые каналы, роли, права доступа.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ),
                title: 'HD-голос и видео',
                desc: 'Кристально чистый звук с шумоподавлением и опциональное видео в одном клике.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: 'Приватность',
                desc: 'E2E-шифрование для личных чатов, контроль данных и прозрачная политика.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 px-6 py-20 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-12">Частые вопросы</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Когда запуск?',
                a: 'Закрытое бета-тестирование начнётся в Q2 2026. Подписчики раннего доступа получат приглашение первыми.',
              },
              {
                q: 'Будет ли мобильное приложение?',
                a: 'Да, нативные приложения для iOS и Android в планах первого релиза. Веб-версия адаптирована под мобильные устройства.',
              },
              {
                q: 'Какие системы оплаты?',
                a: 'Планируем поддержку ЮKassa, Тинькофф и криптовалют. Детали тарифов будут опубликованы перед запуском.',
              },
            ].map((item, i) => (
              <details
                key={i}
                className="group p-4 rounded-xl bg-white/5 border border-white/10 open:border-violet-500/30 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none font-medium">
                  {item.q}
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-400 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600" />
            <span>ZenVoice © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="hover:text-white transition-colors">Условия использования</a>
            <a href="#" className="hover:text-white transition-colors">Контакты</a>
          </div>
        </div>
      </footer>
    </div>
  );
}