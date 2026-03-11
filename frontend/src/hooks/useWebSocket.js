import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Custom hook for WebSocket connection to receive real-time notifications.
 * Connects to ws://localhost:8080/ws/notifications?token={jwt}
 * Auto-reconnects with exponential backoff on disconnect.
 *
 * @param {function} onMessage - Callback invoked with parsed JSON on each incoming message
 * @returns {{ isConnected: boolean }}
 */
const useWebSocket = (onMessage) => {
    const wsRef = useRef(null);
    const reconnectTimeout = useRef(null);
    const reconnectDelay = useRef(1000);
    const [isConnected, setIsConnected] = useState(false);
    const onMessageRef = useRef(onMessage);

    // Keep callback ref fresh
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = import.meta.env.VITE_API_BASE_URL
            ? new URL(import.meta.env.VITE_API_BASE_URL).host
            : 'localhost:8080';
        const url = `${protocol}://${host}/ws/notifications?token=${token}`;

        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('🔌 WebSocket connected');
                setIsConnected(true);
                reconnectDelay.current = 1000; // Reset backoff
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessageRef.current?.(data);
                } catch (err) {
                    console.warn('WebSocket: failed to parse message', err);
                }
            };

            ws.onclose = (event) => {
                console.log('🔌 WebSocket disconnected', event.code);
                setIsConnected(false);
                wsRef.current = null;

                // Auto-reconnect with exponential backoff (max 30s)
                if (event.code !== 1000) { // 1000 = normal closure
                    reconnectTimeout.current = setTimeout(() => {
                        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
                        connect();
                    }, reconnectDelay.current);
                }
            };

            ws.onerror = (error) => {
                console.warn('WebSocket error', error);
            };
        } catch (err) {
            console.warn('WebSocket: connection failed', err);
        }
    }, []);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (wsRef.current) {
                wsRef.current.close(1000); // Normal closure
            }
        };
    }, [connect]);

    return { isConnected };
};

export default useWebSocket;
