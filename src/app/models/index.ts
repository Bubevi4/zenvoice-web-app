/**
 * Единая библиотека моделей: пользователь и сущности чата.
 * Импортируйте типы отсюда для переиспользования по всему приложению.
 */

export * from './user';
export type {
  Server,
  Channel,
  Message,
  VoiceUser,
  ServersResponse,
  ChannelsResponse,
  MessageHistoryResponse,
} from '../types';
export {
  mapApiMessageToMessage,
  mapApiServerToServer,
  mapApiChannelToChannel,
} from '../types';
