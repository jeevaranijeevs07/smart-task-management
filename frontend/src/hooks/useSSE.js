import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Custom hook for Server-Sent Events (SSE) connection to receive real-time notifications.
 * Connects to /api/sse/updates?token={jwt}
 *
 * @param {function} onMessage - Callback invoked with parsed JSON on each incoming message
 * @returns {{ isConnected: boolean, error: string | null }}
 */
const useSSE = (onMessage) => {
    const eventSourceRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const onMessageRef = useRef(onMessage);

    // Keep callback ref fresh
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError('No authentication token found');
            return;
        }

        // Determine SSE URL
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
        const url = `${baseUrl}/sse/updates?token=${token}`;

        try {
            const es = new EventSource(url);
            eventSourceRef.current = es;

            es.onopen = () => {
                console.log('📡 SSE connected');
                setIsConnected(true);
                setError(null);
            };

            // Listen for the specific 'notification' event defined in the backend
            es.addEventListener('notification', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessageRef.current?.(data);
                } catch (err) {
                    console.warn('SSE: failed to parse message', err);
                }
            });

            es.onerror = (err) => {
                console.error('SSE error', err);
                setIsConnected(false);
                setError('SSE connection failed or was closed by server');
                es.close();

                // Exponential backoff or simple retry can be added here if needed
                // For now, let the user know it failed.
            };

        } catch (err) {
            console.error('SSE: connection creation failed', err);
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                console.log('📡 Closing SSE connection');
                eventSourceRef.current.close();
            }
        };
    }, [connect]);

    return { isConnected, error };
};

export default useSSE;
