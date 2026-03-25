import { Device } from 'mediasoup-client';
import type { Transport } from 'mediasoup-client/lib/types';
import { getBaseUrl } from '../api/client';

export type VoicePeer = {
  id: string;
  userId?: string;
  username?: string;
};

type RpcRequest = {
  id: string;
  method: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Record<string, any>;
};

type RpcResponse =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { id: string; ok: true; data?: any }
  | { id: string; ok: false; error: string };
type RpcOkResponse = Extract<RpcResponse, { ok: true }>;
type SignalingEvent =
  | { event: 'producerAdded'; data?: { producerId?: string } }
  | { event: 'producerRemoved'; data?: { producerId?: string } };

let nextId = 1;

function genId(): string {
  return String(nextId++);
}

/** Базовый URL для WebSocket — тот же хост, что и для API (в dev идёт через Vite proxy /media). */
function getWsBase(): string {
  const base = getBaseUrl();
  return base.replace(/^http/, 'ws');
}

/** Проверка доступа к микрофону: нужен безопасный контекст (HTTPS или localhost). */
function ensureMediaDevices(): void {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    throw new Error(
      'Доступ к микрофону недоступен. Откройте приложение по адресу https:// или http://localhost (не file://).'
    );
  }
  if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
    throw new Error('Ваш браузер не поддерживает запрос доступа к микрофону.');
  }
}

export class VoiceConnection {
  private ws: WebSocket | null = null;
  private readonly roomId: string;
  private readonly peerId: string;
  private readonly userId?: string;
  private readonly username?: string;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pending: Map<string, (res: RpcResponse) => void> = new Map();
  private audioElements: HTMLAudioElement[] = [];
  private readonly consumedProducerIds: Set<string> = new Set();
  private readonly consumersByProducerId: Map<string, import('mediasoup-client/lib/types').Consumer> = new Map();
  private readonly audioByProducerId: Map<string, HTMLAudioElement> = new Map();
  private localStream: MediaStream | null = null;
  private readonly onProducerAddedHandlers: Set<(producerId: string) => void> = new Set();
  private readonly onProducerRemovedHandlers: Set<(producerId: string) => void> = new Set();
  private readonly onDisconnectedHandlers: Set<() => void> = new Set();
  private isDisconnecting = false;

  constructor(roomId: string, peerId: string, userId?: string, username?: string) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.userId = userId;
    this.username = username;
  }

  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsBase = getWsBase();
    const url = `${wsBase}/media/ws`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (this.isSignalingEvent(data)) {
        this.handleSignalingEvent(data);
        return;
      }
      const res = data as RpcResponse;
      const handler = this.pending.get(res.id);
      if (handler) {
        this.pending.delete(res.id);
        handler(res);
      }
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not created'));
        return;
      }
      let settled = false;
      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };
      const timeout = setTimeout(() => {
        settle(new Error('Таймаут подключения к голосовому серверу. Проверьте, что Media Service и Gateway запущены.'));
      }, 12000);
      this.ws.onopen = () => {
        clearTimeout(timeout);
        settle();
      };
      this.ws.onerror = () => settle(new Error('Ошибка подключения к голосовому серверу. Проверьте /media в proxy (Vite) или доступность Gateway.'));
      this.ws.onclose = (ev) => {
        clearTimeout(timeout);
        if (!this.isDisconnecting) {
          this.onDisconnectedHandlers.forEach((handler) => handler());
        }
        if (!settled) settle(new Error(ev.reason || 'WebSocket закрыт'));
      };
    });

    await this.joinRoom();
    await this.initDevice();
    await this.startSendAudio();
    await this.refreshConsumers();
  }

  async disconnect(): Promise<void> {
    this.isDisconnecting = true;
    try {
      await this.call('leave', { roomId: this.roomId, peerId: this.peerId });
    } catch {
      // ignore
    }
    this.cleanupAllRemoteAudio();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    this.consumersByProducerId.forEach((consumer) => {
      try {
        consumer.close();
      } catch {
        // ignore
      }
    });
    this.consumersByProducerId.clear();
    this.consumedProducerIds.clear();
    this.audioByProducerId.clear();
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.sendTransport = null;
    this.recvTransport = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isDisconnecting = false;
  }

  async getPeers(): Promise<VoicePeer[]> {
    const res = await this.call('getPeers', { roomId: this.roomId });
    const peers = (res.data?.peers ?? []) as Array<{ id: string; userId?: string; username?: string }>;
    return peers.map((p) => ({
      id: String(p.id),
      userId: p.userId ? String(p.userId) : undefined,
      username: p.username ? String(p.username) : undefined,
    }));
  }

  onProducerAdded(handler: (producerId: string) => void): () => void {
    this.onProducerAddedHandlers.add(handler);
    return () => {
      this.onProducerAddedHandlers.delete(handler);
    };
  }

  onProducerRemoved(handler: (producerId: string) => void): () => void {
    this.onProducerRemovedHandlers.add(handler);
    return () => {
      this.onProducerRemovedHandlers.delete(handler);
    };
  }

  onDisconnected(handler: () => void): () => void {
    this.onDisconnectedHandlers.add(handler);
    return () => {
      this.onDisconnectedHandlers.delete(handler);
    };
  }

  async ping(): Promise<void> {
    await this.call('ping', { roomId: this.roomId, peerId: this.peerId });
  }

  private async joinRoom(): Promise<void> {
    await this.call('join', {
      roomId: this.roomId,
      peerId: this.peerId,
      userId: this.userId,
      username: this.username,
    });
  }

  private async initDevice(): Promise<void> {
    const res = await this.call('getRouterRtpCapabilities', { roomId: this.roomId });
    const routerRtpCapabilities = res.data?.rtpCapabilities;
    if (!routerRtpCapabilities) {
      throw new Error('No rtpCapabilities from media service');
    }
    const device = new Device();
    await device.load({ routerRtpCapabilities });
    this.device = device;
  }

  private async startSendAudio(): Promise<void> {
    if (!this.device) throw new Error('Device not initialized');
    const transportInfo = await this.call('createWebRtcTransport', {
      roomId: this.roomId,
      peerId: this.peerId,
      direction: 'send',
    });
    const { id, iceParameters, iceCandidates, dtlsParameters } = transportInfo.data ?? {};
    if (!id || !iceParameters || !iceCandidates || !dtlsParameters) {
      throw new Error('Invalid transport params');
    }

    const sendTransport = this.device.createSendTransport({
      id,
      iceParameters,
      iceCandidates,
      dtlsParameters,
    });

    sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.call('connectWebRtcTransport', {
          roomId: this.roomId,
          peerId: this.peerId,
          transportId: sendTransport.id,
          dtlsParameters,
        });
        callback();
      } catch (err) {
        errback(err as Error);
      }
    });

    sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const res = await this.call('produce', {
          roomId: this.roomId,
          peerId: this.peerId,
          transportId: sendTransport.id,
          kind,
          rtpParameters,
          appData,
        });
        const producerId = res.data?.id as string | undefined;
        if (!producerId) throw new Error('No producer id');
        callback({ id: producerId });
      } catch (err) {
        errback(err as Error);
      }
    });

    ensureMediaDevices();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.localStream = stream;
    const track = stream.getAudioTracks()[0];
    await sendTransport.produce({ track });
    this.sendTransport = sendTransport;
  }

  async refreshConsumers(): Promise<void> {
    if (!this.device) return;
    const producersRes = await this.call('getProducers', {
      roomId: this.roomId,
      peerId: this.peerId,
    });
    const list = (producersRes.data?.producers ?? []) as Array<{ producerId: string; peerId: string }>;
    if (!this.recvTransport) {
      await this.createRecvTransport();
    }
    if (!this.recvTransport) return;

    const nextProducerIds = new Set(list.map((item) => item.producerId));
    for (const existingProducerId of Array.from(this.consumedProducerIds)) {
      if (!nextProducerIds.has(existingProducerId)) {
        this.cleanupProducer(existingProducerId);
      }
    }

    for (const item of list) {
      await this.consume(item.producerId);
    }
  }

  private async createRecvTransport(): Promise<void> {
    if (!this.device) throw new Error('Device not initialized');
    const transportInfo = await this.call('createWebRtcTransport', {
      roomId: this.roomId,
      peerId: this.peerId,
      direction: 'recv',
    });
    const { id, iceParameters, iceCandidates, dtlsParameters } = transportInfo.data ?? {};
    if (!id || !iceParameters || !iceCandidates || !dtlsParameters) {
      throw new Error('Invalid recv transport params');
    }

    const recvTransport = this.device.createRecvTransport({
      id,
      iceParameters,
      iceCandidates,
      dtlsParameters,
    });

    recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.call('connectWebRtcTransport', {
          roomId: this.roomId,
          peerId: this.peerId,
          transportId: recvTransport.id,
          dtlsParameters,
        });
        callback();
      } catch (err) {
        errback(err as Error);
      }
    });

    this.recvTransport = recvTransport;
  }

  private async consume(producerId: string): Promise<void> {
    if (!this.device || !this.recvTransport) return;
    if (this.consumedProducerIds.has(producerId)) return;
    const rtpCapabilities = this.device.rtpCapabilities;
    const res = await this.call('consume', {
      roomId: this.roomId,
      peerId: this.peerId,
      consumerTransportId: this.recvTransport.id,
      producerId,
      rtpCapabilities,
    });
    const { kind, rtpParameters } = res.data ?? {};
    if (!kind || !rtpParameters) return;
    const consumer = await this.recvTransport.consume({
      id: res.data.id,
      producerId: res.data.producerId,
      kind,
      rtpParameters,
    });
    const stream = new MediaStream([consumer.track]);
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = stream;
    audio.play().catch(() => {
      // autoplay policies may block; user will unmute later
    });
    this.audioElements.push(audio);
    this.audioByProducerId.set(producerId, audio);
    this.consumersByProducerId.set(producerId, consumer);
    this.consumedProducerIds.add(producerId);
  }

  private cleanupProducer(producerId: string): void {
    const consumer = this.consumersByProducerId.get(producerId);
    if (consumer) {
      try {
        consumer.close();
      } catch {
        // ignore
      }
      this.consumersByProducerId.delete(producerId);
    }

    const audio = this.audioByProducerId.get(producerId);
    if (audio) {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {
        // ignore
      }
      this.audioByProducerId.delete(producerId);
      this.audioElements = this.audioElements.filter((item) => item !== audio);
    }

    this.consumedProducerIds.delete(producerId);
  }

  private cleanupAllRemoteAudio(): void {
    for (const producerId of Array.from(this.consumedProducerIds)) {
      this.cleanupProducer(producerId);
    }
    this.audioElements.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        // ignore
      }
    });
    this.audioElements = [];
  }

  private isSignalingEvent(data: unknown): data is SignalingEvent {
    if (!data || typeof data !== 'object') return false;
    const event = (data as { event?: unknown }).event;
    return event === 'producerAdded' || event === 'producerRemoved';
  }

  private handleSignalingEvent(event: SignalingEvent): void {
    const producerId = event.data?.producerId;
    if (!producerId) return;

    if (event.event === 'producerAdded') {
      // Событие нового producer: подтягиваем его без полного reconnect.
      void this.refreshConsumers();
      this.onProducerAddedHandlers.forEach((handler) => handler(producerId));
      return;
    }

    this.cleanupProducer(producerId);
    this.onProducerRemovedHandlers.forEach((handler) => handler(producerId));
  }

  private async call(method: string, payload?: Record<string, unknown>): Promise<RpcOkResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    const id = genId();
    const req: RpcRequest = { id, method, payload };
    const message = JSON.stringify(req);
    this.ws.send(message);
    return await new Promise<RpcOkResponse>((resolve, reject) => {
      this.pending.set(id, (res) => {
        if (!res.ok) {
          reject(new Error(res.error ?? 'Unknown mediasoup error'));
        } else {
          resolve(res);
        }
      });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Media service timeout'));
        }
      }, 10000);
    });
  }
}

