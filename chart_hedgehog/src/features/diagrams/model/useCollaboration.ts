'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import type { DiagramElement } from '../api/diagramEditor';

const COLLAB_COLORS = [
    '#E91E63', '#9C27B0', '#3F51B5', '#2196F3', '#00BCD4',
    '#009688', '#4CAF50', '#FF5722', '#795548', '#607D8B',
];

export function getUserColor(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = Math.imul(hash, 31) + username.charCodeAt(i);
    }
    return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length]!;
}

export interface CollabUser {
    userId: string;
    username: string;
    color: string;
}

export interface CollabCursor extends CollabUser {
    x: number;
    y: number;
    timestamp: number;
}

export interface CollabBatchOp {
    userId: string;
    username: string;
    color: string;
    added?: DiagramElement[];
    updated?: DiagramElement[];
    deletedIds?: string[];
}

interface UseCollaborationOptions {
    diagramId: number;
    userId: string;
    username: string;
    canEdit: boolean;
    onRemoteOp: (op: CollabBatchOp) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const CURSOR_TTL = 8000;

export function useCollaboration({ diagramId, userId, username, onRemoteOp }: UseCollaborationOptions) {
    const stompRef = useRef<Client | null>(null);
    const [connected, setConnected] = useState(false);
    const [remoteUsers, setRemoteUsers] = useState<CollabUser[]>([]);
    const [remoteCursors, setRemoteCursors] = useState<CollabCursor[]>([]);
    const onRemoteOpRef = useRef(onRemoteOp);
    const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { onRemoteOpRef.current = onRemoteOp; }, [onRemoteOp]);

    // Remove cursors that haven't moved for a while
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setRemoteCursors(prev => prev.filter(c => now - c.timestamp < CURSOR_TTL));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const color = getUserColor(username);
        let authFailure = false;

        const client = new Client({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            webSocketFactory: () => new (SockJS as any)(`${API_BASE}/ws`) as WebSocket,
            reconnectDelay: 5000,
            onConnect: () => {
                authFailure = false;
                setConnected(true);

                client.subscribe(`/topic/diagram/${diagramId}`, (msg) => {
                    const op = JSON.parse(msg.body) as CollabBatchOp;
                    if (op.userId !== userId) onRemoteOpRef.current(op);
                });

                client.subscribe(`/topic/diagram/${diagramId}/cursors`, (msg) => {
                    const cursor = JSON.parse(msg.body) as CollabCursor;
                    if (cursor.userId === userId) return;
                    const withTs: CollabCursor = { ...cursor, timestamp: Date.now() };
                    setRemoteCursors(prev => [
                        ...prev.filter(c => c.userId !== cursor.userId),
                        withTs,
                    ]);
                });

                client.subscribe(`/topic/diagram/${diagramId}/presence`, (msg) => {
                    const ev = JSON.parse(msg.body) as { type: string; userId: string; username: string; color: string };
                    if (ev.userId === userId) return;
                    if (ev.type === 'join') {
                        setRemoteUsers(prev => [
                            ...prev.filter(u => u.userId !== ev.userId),
                            { userId: ev.userId, username: ev.username, color: ev.color },
                        ]);
                    } else {
                        setRemoteUsers(prev => prev.filter(u => u.userId !== ev.userId));
                        setRemoteCursors(prev => prev.filter(c => c.userId !== ev.userId));
                    }
                });

                client.publish({
                    destination: `/app/diagram/${diagramId}/join`,
                    body: JSON.stringify({ userId, username, color }),
                });
            },
            onDisconnect: () => {
                setConnected(false);
                if (authFailure) void client.deactivate();
            },
            onStompError: (frame) => {
                setConnected(false);
                const msg = (frame.headers?.message ?? '').toLowerCase();
                if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('401') || msg.includes('403')) {
                    authFailure = true;
                    void client.deactivate();
                }
            },
            onWebSocketError: () => {
                // SockJS throws a generic error on HTTP 401 during handshake;
                // deactivate after several failed attempts to avoid infinite loops.
            },
        });

        client.activate();
        stompRef.current = client;

        return () => {
            if (client.connected) {
                client.publish({
                    destination: `/app/diagram/${diagramId}/leave`,
                    body: JSON.stringify({ userId, username, color }),
                });
            }
            void client.deactivate();
            stompRef.current = null;
        };
    }, [diagramId, userId, username]);

    const broadcast = useCallback((op: Omit<CollabBatchOp, 'userId' | 'username' | 'color'>) => {
        const client = stompRef.current;
        if (!client?.connected) return;
        client.publish({
            destination: `/app/diagram/${diagramId}/operation`,
            body: JSON.stringify({ ...op, userId, username, color: getUserColor(username) }),
        });
    }, [diagramId, userId, username]);

    const sendCursor = useCallback((x: number, y: number) => {
        if (cursorTimerRef.current !== null) return;
        cursorTimerRef.current = setTimeout(() => {
            cursorTimerRef.current = null;
            const client = stompRef.current;
            if (!client?.connected) return;
            client.publish({
                destination: `/app/diagram/${diagramId}/cursor`,
                body: JSON.stringify({ userId, username, color: getUserColor(username), x, y }),
            });
        }, 50);
    }, [diagramId, userId, username]);

    return { connected, broadcast, sendCursor, remoteUsers, remoteCursors };
}
