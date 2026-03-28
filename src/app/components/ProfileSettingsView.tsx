/**
 * Страница настроек профиля: аватар (загрузка файла), имя, почта.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, Pencil, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from './ui/utils';
import { useAuth } from '../contexts/AuthContext';
import * as authApi from '../api/auth';
import * as chatApi from '../api/chat';
import { ApiError } from '../api/client';
import { toast } from 'sonner';
import { toastCopy, toastUserError } from '../utils/toastMessages';

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
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarFilePreview, setAvatarFilePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [presenceMode, setPresenceMode] = useState<'online' | 'dnd'>('online');
  const [loadingPrivacy, setLoadingPrivacy] = useState(true);
  const [editUsername, setEditUsername] = useState(false);
  const [editNametag, setEditNametag] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [editPhone, setEditPhone] = useState(false);
  const [editBirthDate, setEditBirthDate] = useState(false);
  const [editGender, setEditGender] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEmojiAvatar = user?.avatar_url?.startsWith('emoji:');
  const displayEmoji = isEmojiAvatar ? user!.avatar_url!.slice(6) : '';

  useEffect(() => {
    if (user?.avatar_url) {
      if (user.avatar_url.startsWith('emoji:')) {
        setAvatarUrl('');
        setAvatarFilePreview('');
      } else {
        setAvatarUrl(user.avatar_url);
        setAvatarFilePreview('');
      }
    } else {
      setAvatarUrl('');
      setAvatarFilePreview('');
    }
  }, [user?.avatar_url]);

  useEffect(() => {
    setUsername(user?.username ?? '');
    setNametag(user?.nametag ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setBirthDate(user?.birth_date ?? '');
    setGender(user?.gender ?? '');
  }, [user?.username, user?.nametag, user?.email, user?.phone, user?.birth_date, user?.gender]);

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
          phone: me.phone ?? null,
          birth_date: me.birth_date ?? null,
          gender: me.gender ?? null,
        });
        setUsername(me.username);
        setNametag(me.nametag);
        setEmail(me.email);
        setPhone(me.phone ?? '');
        setBirthDate(me.birth_date ?? '');
        setGender(me.gender ?? '');
        if (me.avatar_url?.startsWith('emoji:')) {
          setAvatarUrl('');
        } else if (me.avatar_url) {
          setAvatarUrl(me.avatar_url);
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
                phone: me.phone ?? null,
                birth_date: me.birth_date ?? null,
                gender: me.gender ?? null,
              });
              setUsername(me.username);
              setNametag(me.nametag);
              setEmail(me.email);
              setPhone(me.phone ?? '');
              setBirthDate(me.birth_date ?? '');
              setGender(me.gender ?? '');
              if (me.avatar_url?.startsWith('emoji:')) {
                setAvatarUrl('');
              } else if (me.avatar_url) {
                setAvatarUrl(me.avatar_url);
              }
            });
          } else {
            onLogout();
          }
        } else {
          toast.error(toastCopy.loadFailed);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    chatApi
      .getMyPrivacy()
      .then((p) => {
        if (!cancelled) setPresenceMode(p.presence === 'dnd' ? 'dnd' : 'online');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPrivacy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePresenceChange = async (v: 'online' | 'dnd') => {
    if (v === presenceMode) return;
    try {
      await chatApi.patchMyPrivacy(v);
      setPresenceMode(v);
      toast.success('Статус обновлён');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await onRefreshToken();
        if (ok) return handlePresenceChange(v);
        onLogout();
      } else {
        toastUserError(e);
      }
    }
  };

  const handleAvatarFile = async (file: File) => {
    try {
      setSaving(true);
      const blobUrl = URL.createObjectURL(file);
      setAvatarFilePreview(blobUrl);
      const updated = await authApi.uploadAvatar(file);
      setUser({
        id: updated.id,
        username: updated.username,
        nametag: updated.nametag,
        email: updated.email,
        avatar_url: updated.avatar_url ?? null,
        phone: updated.phone ?? null,
        birth_date: updated.birth_date ?? null,
        gender: updated.gender ?? null,
      });
      setAvatarUrl(updated.avatar_url ?? '');
      toast.success('Аватар обновлён');
    } catch (err) {
      const e2 = err;
      if (e2 instanceof ApiError && e2.status === 401) {
        const ok = await onRefreshToken();
        if (ok) return;
        onLogout();
      }
      toastUserError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const finalAvatar =
      avatarUrl.trim() ||
      (user?.avatar_url?.startsWith('emoji:') ? user.avatar_url : null) ||
      null;
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        username: username.trim() || undefined,
        nametag: nametag.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        birth_date: birthDate.trim() || undefined,
        gender: gender.trim() || undefined,
        avatar_url: finalAvatar,
      });
      setUser({
        id: updated.id,
        username: updated.username,
        nametag: updated.nametag,
        email: updated.email,
        avatar_url: updated.avatar_url ?? null,
        phone: updated.phone ?? null,
        birth_date: updated.birth_date ?? null,
        gender: updated.gender ?? null,
      });
      toast.success('Изменения сохранены');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const ok = await onRefreshToken();
        if (ok) return handleSave();
        onLogout();
      }
      toastUserError(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-white pb-[max(2rem,env(safe-area-inset-bottom))]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              aria-label="Назад"
              type="button"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold truncate">Настройки профиля</h1>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/30 border border-green-400/60 text-green-400 transition-colors disabled:opacity-60 shrink-0"
            aria-label="Сохранить профиль"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto w-full space-y-8">
          <div className="flex items-start gap-4 md:gap-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 focus:outline-none focus:ring-2 focus:ring-violet-500/50 rounded-full"
              title="Нажмите, чтобы сменить аватар"
            >
              <div
              className={cn(
                'w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center text-5xl md:text-6xl overflow-hidden shadow-xl ring-2 ring-white/10',
                isEmojiAvatar || (!avatarUrl && !avatarFilePreview)
                  ? 'bg-gradient-to-br from-violet-600 to-purple-600'
                  : 'bg-transparent'
              )}
              >
                {isEmojiAvatar && displayEmoji ? (
                  <span>{displayEmoji}</span>
                ) : avatarFilePreview ? (
                  <img src={avatarFilePreview} alt="" className="w-full h-full object-cover" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 md:w-20 md:h-20 text-white/80" />
                )}
              </div>
            </button>
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Имя пользователя</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="glass-input text-white"
                    minLength={2}
                    maxLength={32}
                    disabled={!editUsername}
                  />
                  <button
                    type="button"
                    onClick={() => setEditUsername((v) => !v)}
                    className="p-2 rounded-md hover:bg-white/10 transition-colors shrink-0"
                    title={editUsername ? 'Завершить редактирование' : 'Редактировать'}
                  >
                    <Pencil className="w-4 h-4 text-gray-300" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Тег (nametag)</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={nametag}
                    onChange={(e) => setNametag(e.target.value)}
                    placeholder="@nametag"
                    className="glass-input text-white"
                    minLength={2}
                    maxLength={32}
                    disabled={!editNametag}
                  />
                  <button
                    type="button"
                    onClick={() => setEditNametag((v) => !v)}
                    className="p-2 rounded-md hover:bg-white/10 transition-colors shrink-0"
                    title={editNametag ? 'Завершить редактирование' : 'Редактировать'}
                  >
                    <Pencil className="w-4 h-4 text-gray-300" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">По тегу вас находят в поиске</p>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              void handleAvatarFile(file);
            }}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="glass-input text-white"
                disabled={!editEmail}
              />
              <button
                type="button"
                onClick={() => setEditEmail((v) => !v)}
                className="p-2 rounded-md hover:bg-white/10 transition-colors shrink-0"
                title={editEmail ? 'Завершить редактирование' : 'Редактировать'}
              >
                <Pencil className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Номер телефона</label>
            <div className="flex items-center gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 900 000 00 00"
                className="glass-input text-white"
                disabled={!editPhone}
              />
              <button
                type="button"
                onClick={() => setEditPhone((v) => !v)}
                className="p-2 rounded-md hover:bg-white/10 transition-colors shrink-0"
                title={editPhone ? 'Завершить редактирование' : 'Редактировать'}
              >
                <Pencil className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Дата рождения</label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="glass-input text-white"
                  disabled={!editBirthDate}
                />
                <button
                  type="button"
                  onClick={() => setEditBirthDate((v) => !v)}
                  className="p-2 rounded-md hover:bg-white/10 transition-colors shrink-0"
                  title={editBirthDate ? 'Завершить редактирование' : 'Редактировать'}
                >
                  <Pencil className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Пол</label>
              <div className="flex items-center gap-2">
                <Input
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="мужской / женский / другой"
                  className="glass-input text-white"
                  disabled={!editGender}
                />
                <button
                  type="button"
                  onClick={() => setEditGender((v) => !v)}
                  className="p-2 rounded-md hover:bg-white/10 transition-colors shrink-0"
                  title={editGender ? 'Завершить редактирование' : 'Редактировать'}
                >
                  <Pencil className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Статус для других</label>
            <p className="text-xs text-gray-500 mb-3">
              «Не беспокоить» сохраняется в профиле и отображается в чате. Режим «В сети» снимает этот флаг.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant={presenceMode === 'online' ? 'default' : 'outline'}
                className={
                  presenceMode === 'online'
                    ? 'bg-violet-600 hover:bg-violet-500 flex-1'
                    : 'border-white/15 text-gray-200 hover:bg-white/10 flex-1'
                }
                onClick={() => void handlePresenceChange('online')}
                disabled={saving || loadingPrivacy}
              >
                В сети
              </Button>
              <Button
                type="button"
                variant={presenceMode === 'dnd' ? 'default' : 'outline'}
                className={
                  presenceMode === 'dnd'
                    ? 'bg-amber-700 hover:bg-amber-600 flex-1'
                    : 'border-white/15 text-gray-200 hover:bg-white/10 flex-1'
                }
                onClick={() => void handlePresenceChange('dnd')}
                disabled={saving || loadingPrivacy}
              >
                Не беспокоить
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
