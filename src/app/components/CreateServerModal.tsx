/**
 * Модальное окно создания пользовательского сервера.
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Server } from 'lucide-react';

interface CreateServerModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateServerModal({ open, onClose, onCreate }: CreateServerModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Введите название сервера');
        return;
      }
      if (trimmed.length > 100) {
        setError('Название не должно превышать 100 символов');
        return;
      }
      setError(null);
      setLoading(true);
      try {
        await onCreate(trimmed);
        setName('');
        onClose();
      } catch {
        setError('Не удалось создать сервер');
      } finally {
        setLoading(false);
      }
    },
    [name, onCreate, onClose]
  );

  const handleClose = useCallback(() => {
    if (!loading) {
      setName('');
      setError(null);
      onClose();
    }
  }, [loading, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="glass-modal border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5 text-violet-400" />
            Создать сервер
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            Создайте сервер для общения с друзьями. По умолчанию будет добавлен канал «general».
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="server-name" className="block text-sm font-medium text-gray-300 mb-2">
              Название сервера
            </label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Мой сервер"
              maxLength={100}
              className="glass-input text-white placeholder:text-gray-500 focus:border-violet-500/50"
              disabled={loading}
              autoFocus
            />
            {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-white/10 text-gray-300 hover:bg-white/5"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              {loading ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
