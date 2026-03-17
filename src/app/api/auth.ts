/**
 * API авторизации: регистрация, логин, обновление токена.
 */

import { apiGet, apiPatch, apiPost, apiPostForm } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user_id: string;
  username: string;
  nametag: string;
  email: string;
  avatar_url?: string | null;
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface MeResponse {
  id: string;
  username: string;
  nametag: string;
  email: string;
  avatar_url?: string | null;
}

export interface ProfileUpdateRequest {
  username?: string;
  nametag?: string;
  email?: string;
  avatar_url?: string | null;
}

export interface UserSearchResult {
  id: string;
  username: string;
  nametag: string;
  avatar_url?: string | null;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

const AUTH_PREFIX = '/api/auth';

export async function login(body: LoginRequest): Promise<AuthResponse> {
  return apiPost<AuthResponse>(`${AUTH_PREFIX}/login`, body);
}

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  return apiPost<AuthResponse>(`${AUTH_PREFIX}/register`, body);
}

export async function refreshToken(refresh_token: string): Promise<RefreshResponse> {
  return apiPost<RefreshResponse>(`${AUTH_PREFIX}/refresh_token`, { refresh_token });
}

export async function searchUserByNametag(nametag: string): Promise<UserSearchResult> {
  const clean = nametag.replace(/^@/, '').trim();
  return apiGet<UserSearchResult>(`${AUTH_PREFIX}/users/by-nametag/${encodeURIComponent(clean)}`);
}

export async function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>(`${AUTH_PREFIX}/me`);
}

export async function updateProfile(data: ProfileUpdateRequest): Promise<MeResponse> {
  return apiPatch<MeResponse>(`${AUTH_PREFIX}/me`, data);
}

export async function uploadAvatar(file: File): Promise<MeResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiPostForm<MeResponse>(`${AUTH_PREFIX}/me/avatar`, form);
}
