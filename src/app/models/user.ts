/**
 * Единая модель пользователя для переиспользования: Auth, DM, поиск, профиль.
 */

export interface User {
  id: string;
  username: string;
  nametag: string;
  /** Присутствует после логина/me; может отсутствовать в поиске и DM. */
  email?: string;
  avatar_url?: string | null;
}

/** Минимальный профиль пользователя (без email) — для списков, DM, поиска */
export type UserProfile = Pick<User, 'id' | 'username' | 'nametag' | 'avatar_url'>;
