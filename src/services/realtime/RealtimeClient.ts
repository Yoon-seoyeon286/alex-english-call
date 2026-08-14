import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
  type MediaStreamTrack,
} from 'react-native-webrtc';

import { REALTIME_CALLS_URL } from '@/services/openai/config';
import { fetchEphemeralSession } from '@/services/openai/client';
import { AppError, toAppError } from '@/utils/errors';
import { createLogger } from '@/utils/logger';
import { createId } from '@/utils/id';
import type { CallStatus, LiveTurn, Speaker } from '@/types';
import { CANCEL_RESPONSE, CLEAR_OUTPUT_AUDIO } from './events';
import { startCallAudio, stopCallAudio } from './audioRoute';

const log = createLogger('realtime');

export interface RealtimeCallbacks {
  onStatus: (status: CallStatus) => void;
  onTurnUpdate: (turn: LiveTurn) => void;
  onLevel?: (level: number) => void;
  onError: (error: AppError) => void;
  onClosed: (reason: 'user' | 'remote' | 'error') => void;
}

interface PendingTurn {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: number;
}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const ICE_GATHER_TIMEOUT_MS = 3000;

/**
 * Owns one phone call: microphone, peer connection, event channel, transcript.
 *
 * Audio never touches our backend — the backend only mints the short-lived
 * secret used to authenticate this direct peer connection to OpenAI.
 */
export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dc: ReturnType<RTCPeerConnection['createDataChannel']> | null = null;
  private localStream: MediaStream | null = null;
  private levelTimer: ReturnType<typeof setInterval> | null = null;

  private status: CallStatus = 'IDLE';
  private closed = false;
  private aiIsSpeaking = false;

  private turns = new Map<string, PendingTurn>();
  private order: string[] = [];

  constructor(private readonly callbacks: RealtimeCallbacks) {}

  /* ----------------------------------------------------------------- */
  /* Lifecycle                                                          */
  /* ----------------------------------------------------------------- */

  async connect(instructions: string): Promise<void> {
    this.setStatus('CONNECTING');

    try {
      // 1. Microphone first — a permission failure should surface before we
      //    spend a token.
      this.localStream = await this.openMicrophone();

      // 2. Short-lived credential from our own backend.
      const session = await fetchEphemeralSession(instructions);
      log.info(`got ephemeral secret (model ${session.model}, voice ${session.voice})`);

      if (this.closed) return;

      // 3. Peer connection.
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      this.pc = pc;

      // react-native-webrtc renders remote audio automatically once the track
      // arrives; we only need the event to know playback is live.
      pc.ontrack = (event: { streams: MediaStream[] }) => {
        log.info(`remote track received (${event.streams.length} stream(s))`);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        log.info(`connection state: ${state}`);
        if (state === 'connected') {
          this.setStatus('LISTENING');
        } else if (state === 'failed') {
          this.fail(new AppError('realtime_dropped', 'The peer connection failed.'));
        } else if (state === 'disconnected') {
          this.setStatus('RECONNECTING');
        } else if (state === 'closed' && !this.closed) {
          this.callbacks.onClosed('remote');
        }
      };

      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }

      const dc = pc.createDataChannel('oai-events');
      this.dc = dc;
      dc.onopen = () => {
        log.info('data channel open — asking Alex to say hi');
        this.send({ type: 'response.create' });
      };
      dc.onmessage = (event: { data: string }) => this.handleServerEvent(event.data);
      dc.onerror = (event: unknown) => log.warn('data channel error', event);

      // 4. Offer → REST → answer.
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      await this.waitForIceGathering(pc);

      const localSdp = pc.localDescription?.sdp ?? offer.sdp;
      if (!localSdp) throw new AppError('realtime_connect_failed', 'No local SDP was produced.');

      const answerSdp = await this.exchangeSdp(localSdp, session.value);
      if (this.closed) return;

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
      log.info('remote description set — call is live');

      startCallAudio();
      this.startLevelPolling();
    } catch (err) {
      const appErr =
        err instanceof AppError
          ? err
          : new AppError('realtime_connect_failed', (err as Error).message, err);
      this.fail(appErr);
      throw appErr;
    }
  }

  /** Ends the call and releases the microphone. Idempotent. */
  close(reason: 'user' | 'remote' | 'error' = 'user'): void {
    if (this.closed) return;
    this.closed = true;

    this.stopLevelPolling();

    try {
      this.dc?.close();
    } catch {
      /* already gone */
    }
    try {
      this.localStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    } catch {
      /* already gone */
    }
    try {
      this.pc?.close();
    } catch {
      /* already gone */
    }

    this.dc = null;
    this.pc = null;
    this.localStream = null;

    stopCallAudio();
    this.setStatus('ENDED');
    this.callbacks.onClosed(reason);
    log.info(`call closed (${reason})`);
  }

  /* ----------------------------------------------------------------- */
  /* Controls                                                           */
  /* ----------------------------------------------------------------- */

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = !muted;
    });
    log.info(muted ? 'microphone muted' : 'microphone unmuted');
  }

  /** Snapshot of the transcript so far, in speaking order. */
  getTurns(): LiveTurn[] {
    return this.order
      .map((id) => this.turns.get(id))
      .filter((t): t is PendingTurn => Boolean(t && t.text.trim()))
      .map((t) => ({ ...t, partial: false }));
  }

  isConnected(): boolean {
    return this.pc?.connectionState === 'connected';
  }

  /* ----------------------------------------------------------------- */
  /* Internals                                                          */
  /* ----------------------------------------------------------------- */

  private async openMicrophone(): Promise<MediaStream> {
    try {
      const stream = await mediaDevices.getUserMedia({
        // Echo cancellation is what keeps Alex's own voice out of the mic on
        // speakerphone. The RN typings are narrower than the native constraint
        // set, so the object is cast through.
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as unknown as boolean,
        video: false,
      });
      log.info('microphone opened');
      return stream as MediaStream;
    } catch (err) {
      const message = (err as Error)?.message ?? '';
      if (/permission|denied|NotAllowed/i.test(message)) {
        throw new AppError('mic_permission_denied', message, err);
      }
      throw new AppError('mic_permission_denied', `Could not open the microphone: ${message}`, err);
    }
  }

  /**
   * The SDP exchange is a single REST round-trip, so there is no channel for
   * trickled candidates — the offer has to be complete before we send it.
   */
  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        log.warn('ICE gathering timed out — sending the candidates we have');
        finish();
      }, ICE_GATHER_TIMEOUT_MS);

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') finish();
      };
      pc.onicecandidate = (event: { candidate: unknown }) => {
        if (!event.candidate) finish();
      };
    });
  }

  private async exchangeSdp(sdp: string, ephemeralKey: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(REALTIME_CALLS_URL, {
        method: 'POST',
        body: sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        if (res.status === 401) {
          throw new AppError('token_expired', `Realtime rejected the token: ${text}`);
        }
        throw new AppError(
          'realtime_connect_failed',
          `Realtime SDP exchange failed (${res.status}): ${text}`,
        );
      }
      return text;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as Error)?.name === 'AbortError') {
        throw new AppError('realtime_connect_failed', 'Connecting to Alex timed out.');
      }
      throw toAppError(err, 'realtime_connect_failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.dc || this.dc.readyState !== 'open') return;
    try {
      this.dc.send(JSON.stringify(payload));
    } catch (err) {
      log.warn('failed to send client event', err);
    }
  }

  private handleServerEvent(raw: string): void {
    let event: { type?: string; [key: string]: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    const type = event.type ?? '';

    switch (type) {
      /* ---- Barge-in ------------------------------------------------- */
      case 'input_audio_buffer.speech_started': {
        if (this.aiIsSpeaking) {
          // Semantic VAD already cancels server-side, but the audio that is
          // in flight would still play out. Clearing both makes Alex stop
          // the instant the user starts talking.
          this.send(CANCEL_RESPONSE);
          this.send(CLEAR_OUTPUT_AUDIO);
          this.aiIsSpeaking = false;
          log.info('barge-in: user started speaking, cut Alex off');
        }
        this.setStatus('LISTENING');
        break;
      }
      case 'input_audio_buffer.speech_stopped': {
        this.setStatus('THINKING');
        break;
      }

      /* ---- Response lifecycle --------------------------------------- */
      case 'response.created': {
        this.setStatus('THINKING');
        break;
      }
      case 'output_audio_buffer.started': {
        this.aiIsSpeaking = true;
        this.setStatus('SPEAKING');
        break;
      }
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared': {
        this.aiIsSpeaking = false;
        this.setStatus('LISTENING');
        break;
      }
      case 'response.done': {
        if (!this.aiIsSpeaking) this.setStatus('LISTENING');
        break;
      }

      /* ---- Transcript: the user -------------------------------------- */
      case 'conversation.item.input_audio_transcription.delta': {
        const itemId = String(event.item_id ?? '');
        const delta = String(event.delta ?? '');
        if (itemId && delta) this.appendTurn(itemId, 'USER', delta, true);
        break;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const itemId = String(event.item_id ?? '');
        const text = String(event.transcript ?? '').trim();
        if (itemId && text) this.replaceTurn(itemId, 'USER', text);
        break;
      }
      case 'conversation.item.input_audio_transcription.failed': {
        log.warn('input transcription failed', event.error);
        break;
      }

      /* ---- Transcript: Alex ------------------------------------------ */
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': {
        const itemId = String(event.item_id ?? '');
        const delta = String(event.delta ?? '');
        if (itemId && delta) this.appendTurn(itemId, 'AI', delta, true);
        break;
      }
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done': {
        const itemId = String(event.item_id ?? '');
        const text = String(event.transcript ?? '').trim();
        if (itemId && text) this.replaceTurn(itemId, 'AI', text);
        break;
      }

      /* ---- Errors ----------------------------------------------------- */
      case 'error': {
        const detail = event.error as { message?: string; code?: string } | undefined;
        log.warn(`server error: ${detail?.code ?? ''} ${detail?.message ?? ''}`);
        // Cancelling a response that already finished is normal after
        // barge-in; it is not worth bothering the user about.
        if (detail?.code !== 'response_cancel_not_active') {
          this.callbacks.onError(
            new AppError('realtime_dropped', detail?.message ?? 'Realtime reported an error.'),
          );
        }
        break;
      }

      default:
        break;
    }
  }

  private appendTurn(itemId: string, speaker: Speaker, delta: string, partial: boolean): void {
    const existing = this.turns.get(itemId);
    if (existing) {
      existing.text += delta;
      this.callbacks.onTurnUpdate({ ...existing, partial });
      return;
    }
    const turn: PendingTurn = {
      id: itemId,
      speaker,
      text: delta,
      timestamp: Date.now(),
    };
    this.turns.set(itemId, turn);
    this.order.push(itemId);
    this.callbacks.onTurnUpdate({ ...turn, partial });
  }

  private replaceTurn(itemId: string, speaker: Speaker, text: string): void {
    const existing = this.turns.get(itemId);
    if (existing) {
      existing.text = text;
      this.callbacks.onTurnUpdate({ ...existing, partial: false });
      return;
    }
    const turn: PendingTurn = { id: itemId, speaker, text, timestamp: Date.now() };
    this.turns.set(itemId, turn);
    this.order.push(itemId);
    this.callbacks.onTurnUpdate({ ...turn, partial: false });
  }

  private setStatus(status: CallStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.callbacks.onStatus(status);
  }

  private fail(error: AppError): void {
    log.error(error.message);
    this.setStatus('ERROR');
    this.callbacks.onError(error);
  }

  /**
   * Drives the voice orb from real RTP audio levels rather than a fake
   * animation. Cheap enough at 4Hz, and silently gives up if stats are
   * unavailable on this device.
   */
  private startLevelPolling(): void {
    if (!this.callbacks.onLevel || this.levelTimer) return;

    this.levelTimer = setInterval(async () => {
      const pc = this.pc;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let level = 0;
        stats.forEach((report: Record<string, unknown>) => {
          const kind = report.kind ?? report.mediaType;
          if (kind !== 'audio') return;
          const wantInbound = this.aiIsSpeaking;
          const isInbound = report.type === 'inbound-rtp';
          const isSource = report.type === 'media-source';
          if ((wantInbound && isInbound) || (!wantInbound && isSource)) {
            const value = Number(report.audioLevel ?? 0);
            if (Number.isFinite(value)) level = Math.max(level, value);
          }
        });
        this.callbacks.onLevel?.(Math.min(1, level * 3));
      } catch {
        this.stopLevelPolling();
      }
    }, 250);
  }

  private stopLevelPolling(): void {
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
  }
}

/** Helper so callers don't have to import createId just for a local turn id. */
export function makeLocalTurnId(): string {
  return createId('turn');
}
