/**
 * Модальное окно создания канала (текстового или голосового) в стиле создания сервера.
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
import { Hash, Volume2 } from 'lucide-react';
import { Input } from './ui/input';

interface CreateChannelModalProps {
  open: boolean;
  type: 'text' | 'voice';
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateChannelModal({ open, type, onClose, onCreate }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isText = type === 'text';
  const title = isText ? 'Создать текстовый канал' : 'Создать голосовой канал';
  const description = isText
    ? 'Создайте новый текстовый канал для переписки на этом сервере.'
    : 'Создайте новый голосовой канал для общения с голосом на этом сервере.';
  const placeholder = isText ? 'общий-чат' : 'Голосовой канал';

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Введите название канала');
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
        setError('Не удалось создать канал');
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
      <DialogContent className="bg-[#1a1a1f] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {isText ? (
              <Hash className="w-5 h-5 text-violet-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-violet-400" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="channel-name" className="block text-sm font-medium text-gray-300 mb-2">
              Название канала
            </label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={placeholder}
              maxLength={100}
              className="bg-[#2a2a32] border-white/10 text-white placeholder:text-gray-500 focus:border-violet-500/50"
              disabled={loading}
              autoFocus
            />
            {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {/* <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Отмена
            </Button> */}
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

