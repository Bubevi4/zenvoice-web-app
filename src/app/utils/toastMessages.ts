/**
 * Единые пользовательские формулировки для toast — без технических деталей.
 */
import { toast } from 'sonner';

export const toastCopy = {
  genericError: 'Что-то пошло не так. Попробуйте позже.',
  networkError: 'Не удалось выполнить действие. Проверьте подключение к сети.',
  loadFailed: 'Не удалось загрузить данные.',
  saveFailed: 'Не удалось сохранить изменения.',
  sendFailed: 'Не удалось отправить.',
  deleteFailed: 'Не удалось удалить.',
  copyFailed: 'Не удалось скопировать.',
  uploadFailed: 'Не удалось загрузить файл.',
  voiceConnectFailed: 'Не удалось подключиться к голосовому каналу.',
  voiceLost: 'Соединение с голосовым каналом прервалось. Зайдите в канал снова.',
  copied: 'Скопировано в буфер обмена.',
  copiedLink: 'Ссылка скопирована.',
  featureSoon: 'Функция появится в следующих версиях.',
} as const;

/** Показать ошибку без текста исключения / ответа сервера. */
export function toastUserError(_err?: unknown): void {
  toast.error(toastCopy.genericError);
}

export function toastNetworkError(): void {
  toast.error(toastCopy.networkError);
}
