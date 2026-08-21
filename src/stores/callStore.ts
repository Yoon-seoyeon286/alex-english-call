import { create } from 'zustand';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { RealtimeClient } from '@/services/realtime/RealtimeClient';
import { buildCallInstructions } from '@/services/memory/promptBuilder';
import { retrieveForCall } from '@/services/memory/retrieval';
import {
  createSession,
  deleteEmptySession,
  finishSession,
  listRecentSessions,
  saveTranscript,
} from '@/services/database/repositories/sessions';
import { markMemoriesReferenced } from '@/services/database/repositories/memories';
import { getLearningProfile } from '@/services/database/repositories/learningProfile';
import { fetchHints, fetchTranslation } from '@/services/openai/client';
import { requestMicrophonePermission } from '@/hooks/usePermissions';
import { AppError, friendlyMessage, toAppError } from '@/utils/errors';
import { createLogger } from '@/utils/logger';
import { daysSince } from '@/utils/date';
import { MAX_CALL_SECONDS } from '@/services/openai/config';
import type { CallStatus, LiveTurn } from '@/types';

const log = createLogger('call-store');

interface CallState {
  status: CallStatus;
  sessionId: string | null;
  turns: LiveTurn[];
  elapsedSeconds: number;
  muted: boolean;
  level: number;
  errorMessage: string | null;
  errorCode: string | null;

  hints: string[];
  hintLoading: boolean;
  hintError: string | null;

  translatedText: string;
  translating: boolean;
  translateError: string | null;

  /** Set when a finished call is ready for its review screen. */
  lastFinishedSessionId: string | null;

  startCall: () => Promise<boolean>;
  endCall: () => Promise<string | null>;
  toggleMute: () => void;
  requestHint: () => Promise<void>;
  clearHints: () => void;
  translateLastAiText: () => Promise<void>;
  clearTranslation: () => void;
  dismissError: () => void;
  reset: () => void;
}

let client: RealtimeClient | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let startedAt = 0;

function stopTicker(): void {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

export const useCallStore = create<CallState>((set, get) => ({
  status: 'IDLE',
  sessionId: null,
  turns: [],
  elapsedSeconds: 0,
  muted: false,
  level: 0,
  errorMessage: null,
  errorCode: null,
  hints: [],
  hintLoading: false,
  hintError: null,
  translatedText: '',
  translating: false,
  translateError: null,
  lastFinishedSessionId: null,

  async startCall() {
    if (get().status !== 'IDLE' && get().status !== 'ENDED' && get().status !== 'ERROR') {
      return false;
    }

    set({
      status: 'CONNECTING',
      turns: [],
      elapsedSeconds: 0,
      muted: false,
      level: 0,
      errorMessage: null,
      errorCode: null,
      hints: [],
      hintLoading: false,
      hintError: null,
      translatedText: '',
      translating: false,
      translateError: null,
      lastFinishedSessionId: null,
    });

    // 1. Microphone permission ------------------------------------------
    const permission = await requestMicrophonePermission();
    if (permission !== 'granted') {
      const err = new AppError(
        'mic_permission_denied',
        permission === 'blocked'
          ? 'Microphone permission is blocked in Android settings.'
          : 'Microphone permission was denied.',
      );
      set({ status: 'ERROR', errorMessage: friendlyMessage(err), errorCode: err.code });
      return false;
    }

    // 2. Build the prompt from memory ------------------------------------
    let instructions: string;
    let selectedIds: string[] = [];
    try {
      const [{ selected }, profile, recent] = await Promise.all([
        retrieveForCall(),
        getLearningProfile(),
        listRecentSessions(1),
      ]);

      const lastSession = recent[0];
      instructions = buildCallInstructions({
        memories: selected,
        profile,
        isFirstEverCall: !lastSession,
        daysSinceLastCall: lastSession ? daysSince(lastSession.startedAt) : null,
      });
      selectedIds = selected.map((s) => s.memory.id);
      log.info(`prompt built with ${selected.length} memories`);
    } catch (err) {
      const appErr = toAppError(err, 'database_failed');
      set({ status: 'ERROR', errorMessage: friendlyMessage(appErr), errorCode: appErr.code });
      return false;
    }

    // 3. Session row up front, so a crash mid-call still leaves a record.
    let sessionId: string;
    try {
      sessionId = await createSession();
    } catch (err) {
      const appErr = toAppError(err, 'database_failed');
      set({ status: 'ERROR', errorMessage: friendlyMessage(appErr), errorCode: appErr.code });
      return false;
    }
    set({ sessionId });

    // 4. Connect ----------------------------------------------------------
    client = new RealtimeClient({
      onStatus: (status) => set({ status }),
      onTurnUpdate: (turn) => {
        set((state) => {
          const index = state.turns.findIndex((t) => t.id === turn.id);
          const isNewAiTurn =
            turn.speaker === 'AI' && state.turns.every((t) => t.id !== turn.id);
          const nextTurns =
            index === -1
              ? [...state.turns, turn]
              : state.turns.map((t, i) => (i === index ? turn : t));
          // A new AI turn means the previous translation is no longer relevant.
          return {
            turns: nextTurns,
            translatedText: isNewAiTurn ? '' : state.translatedText,
            translateError: isNewAiTurn ? null : state.translateError,
          };
        });
      },
      onLevel: (level) => set({ level }),
      onError: (error) => {
        set({ errorMessage: friendlyMessage(error), errorCode: error.code });
      },
      onClosed: () => {
        stopTicker();
        deactivateKeepAwake().catch(() => undefined);
      },
    });

    try {
      await client.connect(instructions);
    } catch (err) {
      const appErr = toAppError(err, 'realtime_connect_failed');
      set({ status: 'ERROR', errorMessage: friendlyMessage(appErr), errorCode: appErr.code });
      client?.close('error');
      client = null;
      await deleteEmptySession(sessionId).catch(() => undefined);
      set({ sessionId: null });
      return false;
    }

    // 5. Running --------------------------------------------------------
    markMemoriesReferenced(selectedIds).catch((err) => log.warn('could not mark memories', err));
    activateKeepAwakeAsync().catch(() => undefined);

    startedAt = Date.now();
    stopTicker();
    ticker = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      set({ elapsedSeconds: elapsed });
      if (elapsed >= MAX_CALL_SECONDS) {
        log.info('hit the maximum call length, wrapping up');
        void get().endCall();
      }
    }, 1000);

    return true;
  },

  async endCall() {
    const { sessionId } = get();
    const active = client;
    stopTicker();
    deactivateKeepAwake().catch(() => undefined);

    const turns = active?.getTurns() ?? get().turns;
    const durationSeconds = startedAt > 0 ? Math.floor((Date.now() - startedAt) / 1000) : 0;

    active?.close('user');
    client = null;

    if (!sessionId) {
      set({ status: 'ENDED' });
      return null;
    }

    // Transcript is written BEFORE any analysis, so a failed review can never
    // cost us what was actually said.
    try {
      await saveTranscript(
        sessionId,
        turns.map((t) => ({ speaker: t.speaker, text: t.text, timestamp: t.timestamp })),
      );
      await finishSession(sessionId, Date.now(), durationSeconds);
      log.info(`saved ${turns.length} turns for ${sessionId}`);
    } catch (err) {
      log.error('failed to persist transcript', err);
      const appErr = toAppError(err, 'database_failed');
      set({ errorMessage: friendlyMessage(appErr), errorCode: appErr.code });
    }

    const wasEmpty = await deleteEmptySession(sessionId).catch(() => false);

    set({
      status: 'ENDED',
      lastFinishedSessionId: wasEmpty ? null : sessionId,
      sessionId: null,
      level: 0,
    });

    return wasEmpty ? null : sessionId;
  },

  toggleMute() {
    const muted = !get().muted;
    client?.setMuted(muted);
    set({ muted });
  },

  async requestHint() {
    set({ hintLoading: true, hintError: null });
    try {
      const profile = await getLearningProfile();
      const recentTurns = get()
        .turns.slice(-8)
        .map((t) => ({ speaker: t.speaker, text: t.text }));

      const hints = await fetchHints({ recentTurns, level: profile.currentLevel });
      set({ hints, hintLoading: false });
    } catch (err) {
      const appErr = toAppError(err, 'hint_failed');
      log.warn('hint failed', appErr);
      set({ hintLoading: false, hintError: friendlyMessage(appErr) });
    }
  },

  clearHints() {
    set({ hints: [], hintError: null });
  },

  translateLastAiText() {
    // Find the last completed AI line and translate it.
    const turns = get().turns;
    const lastAi = [...turns]
      .reverse()
      .find((t) => t.speaker === 'AI' && t.text.trim().length > 0 && !t.partial);

    if (!lastAi) {
      set({ translateError: 'No finished Alex line to translate yet.' });
      return Promise.resolve();
    }

    // If we already have a translation for this exact line, reuse it.
    const state = get();
    const existingSource = state.turns.find(
      (t) => t.speaker === 'AI' && state.translatedText && t.text === lastAi.text,
    );
    if (existingSource && state.translatedText) {
      return Promise.resolve();
    }

    set({ translating: true, translateError: null });
    return fetchTranslation(lastAi.text)
      .then((translation) => {
        set({ translatedText: translation, translating: false });
      })
      .catch((err) => {
        const appErr = toAppError(err, 'translation_failed');
        log.warn('translation failed', appErr);
        set({ translating: false, translateError: friendlyMessage(appErr) });
      });
  },

  clearTranslation() {
    set({ translatedText: '', translateError: null });
  },

  dismissError() {
    set({ errorMessage: null, errorCode: null });
  },

  reset() {
    stopTicker();
    client?.close('user');
    client = null;
    startedAt = 0;
    set({
      status: 'IDLE',
      sessionId: null,
      turns: [],
      elapsedSeconds: 0,
      muted: false,
      level: 0,
      errorMessage: null,
      errorCode: null,
      hints: [],
      hintLoading: false,
      hintError: null,
      translatedText: '',
      translating: false,
      translateError: null,
    });
  },
}));
