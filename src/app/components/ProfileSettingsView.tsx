/**
 * Страница настроек профиля: аватар (URL или emoji), имя, почта.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../contexts/AuthContext';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';
import { toast } from 'sonner';

const EMOJI_OPTIONS = ['😀', '😎', '🤓', '😊', '🥳', '👻', '🎮', '🚀', '⭐', '🔥', '💜', '🌸'];

interface ProfileSettingsViewProps {
  onBack: () => void;
  onRefreshToken: () => Promise<boolean>;
  onLogout: () => void;
}

export function ProfileSettingsView({ onBack, onRefreshToken, onLogout }: ProfileSettingsViewProps) {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [nametag, setNametag] = useState(user?.nametag ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarEmoji, setAvatarEmoji] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEmojiAvatar = user?.avatar_url?.startsWith('emoji:');
  const displayEmoji = isEmojiAvatar ? user!.avatar_url!.slice(6) : '';

  useEffect(() => {
    if (user?.avatar_url) {
      if (user.avatar_url.startsWith('emoji:')) {
        setAvatarEmoji(user.avatar_url.slice(6));
        setAvatarUrl('');
      } else {
        setAvatarUrl(user.avatar_url);
        setAvatarEmoji('');
      }
    } else {
      setAvatarUrl('');
      setAvatarEmoji('');
    }
  }, [user?.avatar_url]);

  useEffect(() => {
    setUsername(user?.username ?? '');
    setNametag(user?.nametag ?? '');
    setEmail(user?.email ?? '');
  }, [user?.username, user?.nametag, user?.email]);

  /** Загрузка профиля один раз при монтировании (без зависимости от колбэков — иначе цикл из-за setUser → ре-рендер App → новые onRefreshToken/onLogout). */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authApi
      .getMe()
      .then((me) => {
        if (cancelled) return;
        setUser({
          id: me.id,
          username: me.username,
          nametag: me.nametag,
          email: me.email,
          avatar_url: me.avatar_url ?? null,
        });
        setUsername(me.username);
        setNametag(me.nametag);
        setEmail(me.email);
        if (me.avatar_url?.startsWith('emoji:')) {
          setAvatarEmoji(me.avatar_url.slice(6));
          setAvatarUrl('');
        } else if (me.avatar_url) {
          setAvatarUrl(me.avatar_url);
          setAvatarEmoji('');
        }
      })
      .catch(async (e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          const ok = await onRefreshToken();
          if (ok) {
            authApi.getMe().then((me) => {
              if (cancelled) return;
              setUser({
                id: me.id,
                username: me.username,
                nametag: me.nametag,
                email: me.email,
                avatar_url: me.avatar_url ?? null,
              });
              setUsername(me.username);
              setNametag(me.nametag);
              setEmail(me.email);
              if (me.avatar_url?.startsWith('emoji:')) {
                setAvatarEmoji(me.avatar_url.slice(6));
                setAvatarUrl('');
              } else if (me.avatar_url) {
                setAvatarUrl(me.avatar_url);
                setAvatarEmoji('');
              }
            });
          } else {
            onLogout();
          }
        } else {
          toast.error('Не удалось загрузить профиль');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- загрузка только при монтировании; onRefreshToken/onLogout не в deps, чтобы не было цикла
  }, []);

  const handleSave = async () => {
    const finalAvatar = avatarEmoji ? `emoji:${avatarEmoji}` : (avatarUrl.trim() || null);
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        username: username.trim() || undefined,
        nametag: nametag.trim() || undefined,
        email: email.trim() || undefined,
        avatar_url: finalAvatar,
      });
      setUser({
        id: updated.id,
        username: updated.username,
        nametag: updated.nametag,
        email: updated.email,
        avatar_url: updated.avatar_url ?? null,
      });
      toast.success('Профиль сохранён');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await onRefreshToken();
        if (ok) return handleSave(e as unknown as React.FormEvent);
        onLogout();
      }
      toast.error(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <div className="animate-pulse">Загрузка профиля...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-white">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Назад"
              type="button"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Настройки профиля</h1>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/30 border border-green-400/60 text-green-400 transition-colors disabled:opacity-60"
            aria-label="Сохранить профиль"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 max-w-xl mx-auto w-full space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-4xl overflow-hidden shadow-lg">
              {avatarEmoji ? (
                <span>{avatarEmoji}</span>
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-white/80" />
              )}
            </div>
            <p className="text-sm text-gray-400">Аватар (URL или emoji)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Ссылка на аватар</label>
            <Input
              value={avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                if (e.target.value.trim()) setAvatarEmoji('');
              }}
              placeholder="https://..."
              className="glass-input text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Или выберите emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setAvatarEmoji(emoji);
                    setAvatarUrl('');
                  }}
                  className={`w-10 h-10 rounded-lg text-2xl flex items-center justify-center transition-colors ${
                    avatarEmoji === emoji ? 'bg-violet-600 ring-2 ring-violet-400' : 'bg-[#2a2a32] hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {avatarEmoji && (
              <button
                type="button"
                onClick={() => setAvatarEmoji('')}
                className="mt-2 text-sm text-gray-400 hover:text-white"
              >
                Убрать emoji
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Имя пользователя</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="glass-input text-white"
              minLength={2}
              maxLength={32}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Тег (nametag)</label>
            <Input
              value={nametag}
              onChange={(e) => setNametag(e.target.value)}
              placeholder="@nametag"
              className="glass-input text-white"
              minLength={2}
              maxLength={32}
            />
            <p className="text-xs text-gray-500 mt-1">По тегу вас находят в поиске</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="glass-input text-white"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
