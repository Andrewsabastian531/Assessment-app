'use client';

import * as React from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  SOCKET_NAMESPACE,
  STAGE_LABELS,
  type ClientToServerEvents,
  type JobCompletedPayload,
  type JobFailedPayload,
  type JobProgressPayload,
  type ServerToClientEvents,
} from '@vedaai/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

export interface JobProgressState {
  percent: number;
  message: string;
  connected: boolean;
  completed: JobCompletedPayload | null;
  failed: JobFailedPayload | null;
}

/** Subscribes to one grading job over Socket.io. */
export function useJobProgress(jobId: string | null): JobProgressState {
  const [state, setState] = React.useState<JobProgressState>({
    percent: 0,
    message: 'This may take a while',
    connected: false,
    completed: null,
    failed: null,
  });

  React.useEffect(() => {
    if (!jobId || jobId === 'preview') return;

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      `${WS_URL}${SOCKET_NAMESPACE}`,
      {
        transports: ['websocket'],
        withCredentials: true,
        extraHeaders: { 'X-VedaAI-Client': 'web' },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      },
    );

    socket.on('connect', () => {
      setState((prev) => ({ ...prev, connected: true }));
      socket.emit(CLIENT_EVENTS.SUBSCRIBE_JOB, { jobId });
    });

    socket.on('disconnect', () => {
      setState((prev) => ({ ...prev, connected: false }));
    });

    socket.on(SERVER_EVENTS.JOB_PROGRESS, (payload: JobProgressPayload) => {
      setState((prev) => ({
        ...prev,
        // Progress can arrive out of order across concurrent page workers, so
        // never let the bar move backwards.
        percent: Math.max(prev.percent, payload.percent),
        message: payload.message || STAGE_LABELS[payload.stage] || 'This may take a while',
      }));
    });

    socket.on(SERVER_EVENTS.JOB_COMPLETED, (payload) => {
      setState((prev) => ({ ...prev, percent: 100, completed: payload }));
    });

    socket.on(SERVER_EVENTS.JOB_FAILED, (payload) => {
      setState((prev) => ({ ...prev, failed: payload }));
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  return state;
}
