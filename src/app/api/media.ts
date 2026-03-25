/**
 * Media Service: публичные данные о голосовых комнатах (без WebRTC).
 */

import { apiGet } from './client';

export type VoiceRoomPeerDto = {
  id: string;
  userId?: string;
  username?: string;
};

export async function getVoiceRoomPeers(roomId: string): Promise<VoiceRoomPeerDto[]> {
  const data = await apiGet<{ peers: VoiceRoomPeerDto[] }>(
    `/media/rooms/${encodeURIComponent(roomId)}/peers`
  );
  return data.peers ?? [];
}
