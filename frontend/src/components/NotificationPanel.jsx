import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, MessageSquare, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/apiConfig';
import toast from 'react-hot-toast';

const NotificationPanel = ({ onClose }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [acceptingId, setAcceptingId] = useState(null);
    const [decliningId, setDecliningId] = useState(null);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const fetchNotifications = async () => {
        try {
            const res = await api.get(API_ENDPOINTS.NOTIFICATIONS.GET_ALL);
            setNotifications(res.data || []);
        } catch (err) {
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleMarkAllAsRead = async () => {
        setMarkingAllRead(true);
        try {
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            toast.success('All marked as read');
        } catch (err) {
            toast.error('Failed to mark all as read');
        } finally {
            setMarkingAllRead(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        } catch (err) { }
    };

    const handleNotificationClick = async (n) => {
        if (!n.isRead) {
            handleMarkAsRead(n.id);
        }

        if (n.workspaceId && n.boardId && n.cardId) {
            navigate(`/workspace/${n.workspaceId}/board/${n.boardId}?cardId=${n.cardId}`);
            onClose();
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            await api.delete(API_ENDPOINTS.NOTIFICATIONS.DELETE(id));
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        } catch (err) { }
    };

    const canAcceptInvitation = (n) => n?.type === 'WORKSPACE_INVITATION' && Boolean(n?.actionToken) && !n.isRead;

    const handleAccept = async (e, n) => {
        e.stopPropagation();
        setAcceptingId(n.id);
        try {
            await api.post(API_ENDPOINTS.INVITATIONS.ACCEPT, null, { params: { token: n.actionToken } });
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(n.id));
            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true, actionToken: null, message: item.message + ' — Accepted' } : item));
            toast.success('Invitation accepted.');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed';
            if (message.includes('already accepted')) {
                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true, actionToken: null } : item));
                toast.success('Already accepted');
            } else toast.error(message);
        } finally { setAcceptingId(null); }
    };

    const handleDecline = async (e, n) => {
        e.stopPropagation();
        setDecliningId(n.id);
        try {
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(n.id));
            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true, actionToken: null, message: item.message + ' — Declined' } : item));
            toast('Declined');
        } catch (err) { }
        finally { setDecliningId(null); }
    };

    const filteredNotifications = showUnreadOnly ? notifications.filter(n => !n.isRead) : notifications;
    const parseNotificationDate = (value) => {
        if (value === null || value === undefined) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

        if (typeof value === 'number') {
            const ms = value < 1_000_000_000_000 ? value * 1000 : value;
            const parsed = new Date(ms);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        if (Array.isArray(value)) {
            const [year, month, day, hour = 0, minute = 0, second = 0, nano = 0] = value.map(Number);
            if (!year || !month || !day) return null;
            const milli = Math.floor((Number(nano) || 0) / 1_000_000);
            const parsed = new Date(year, month - 1, day, hour, minute, second, milli);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        if (typeof value === 'object') {
            const year = Number(value.year);
            const month = Number(value.monthValue ?? value.month);
            const day = Number(value.dayOfMonth ?? value.day);
            const hour = Number(value.hour ?? 0);
            const minute = Number(value.minute ?? 0);
            const second = Number(value.second ?? 0);
            const nano = Number(value.nano ?? 0);

            if (year && month && day) {
                const milli = Math.floor(nano / 1_000_000);
                const parsed = new Date(year, month - 1, day, hour, minute, second, milli);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
            const cappedFraction = normalized.replace(/\.(\d{3})\d+/, '.$1');
            const parsed = new Date(cappedFraction);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
    };
    const formatNotificationDateTime = (value) => {
        const parsed = parseNotificationDate(value);
        return parsed ? parsed.toLocaleString() : new Date().toLocaleString();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            ref={dropdownRef}
            className="glass"
            style={{
                position: 'absolute',
                top: '56px',
                right: '1rem',
                width: '380px',
                maxHeight: '450px',
                overflowY: 'auto',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-premium)',
                zIndex: 100,
                border: '1px solid var(--border-glass)'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Only show unread</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showUnreadOnly}
                        onClick={(e) => { e.stopPropagation(); setShowUnreadOnly(!showUnreadOnly); }}
                        style={{
                            width: 44,
                            height: 24,
                            borderRadius: 24,
                            background: showUnreadOnly ? '#10b981' : 'rgba(100, 116, 139, 0.2)',
                            border: showUnreadOnly ? 'none' : '1px solid rgba(100, 116, 139, 0.3)',
                            position: 'relative',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 3px'
                        }}
                    >
                        <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#fff',
                            position: 'absolute',
                            left: showUnreadOnly ? '24px' : '3px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}>
                            {showUnreadOnly && <Check size={12} color="#10b981" strokeWidth={3} />}
                        </div>
                    </button>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={(e) => { e.stopPropagation(); handleMarkAllAsRead(); }}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    disabled={markingAllRead || notifications.length === 0}
                >
                    {markingAllRead ? 'Marking...' : 'Mark All Read'}
                </button>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : notifications.length === 0 ? (
                <div className="panel-empty" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                    <Bell size={28} style={{ opacity: 0.5, margin: '0 auto 0.5rem' }} />
                    <p>No notifications yet.</p>
                </div>
            ) : showUnreadOnly && filteredNotifications.length === 0 ? (
                <div className="panel-empty" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                    <div style={{ margin: '0 auto 1.5rem', position: 'relative', width: 140, height: 140 }}>
                        <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="70" cy="70" r="50" fill="#F3E8FF" />
                            <path d="M50 30 L53 38 L60 41 L53 44 L50 52 L47 44 L40 41 L47 38 Z" fill="#D8B4FE" />
                            <path d="M85 20 L87 25 L92 27 L87 29 L85 34 L83 29 L78 27 L83 25 Z" fill="#D8B4FE" />
                            <path d="M96 45 L98 48 L101 50 L98 52 L96 55 L94 52 L91 50 L94 48 Z" fill="#D8B4FE" />
                            <path d="M45 85 C45 55 95 55 95 85 Z" fill="#64748B" />
                            <path d="M55 85 C55 65 85 65 85 85 Z" fill="#F1F5F9" />
                            <path d="M50 60 L45 40 L60 53 Z" fill="#475569" />
                            <path d="M90 60 L95 40 L80 53 Z" fill="#475569" />
                            <path d="M52 57 L48 45 L58 53 Z" fill="#CBD5E1" />
                            <path d="M88 57 L92 45 L82 53 Z" fill="#CBD5E1" />
                            <path d="M58 73 Q62 77 66 73" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
                            <path d="M82 73 Q78 77 74 73" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
                            <ellipse cx="70" cy="79" rx="5" ry="3.5" fill="#1E293B" />
                            <path d="M45 90 C40 90 40 100 50 100 C55 100 55 90 45 90 Z" fill="#F1F5F9" />
                            <path d="M95 90 C100 90 100 100 90 100 C85 100 85 90 95 90 Z" fill="#F1F5F9" />
                            <path d="M50 87 Q70 95 90 87" stroke="#0EA5E9" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No unread notifications</h4>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredNotifications.map((n) => (
                        <div
                            key={n.id}
                            style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: n.isRead ? 'rgba(255,255,255,0.02)' : 'rgba(79, 70, 229, 0.1)',
                                border: n.isRead ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(79, 70, 229, 0.3)',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                            onClick={() => handleNotificationClick(n)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{
                                        lineHeight: '1.4',
                                        fontSize: '0.85rem',
                                        marginBottom: '0.4rem',
                                        color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                                        textDecoration: (n.workspaceId && n.boardId && n.cardId) ? 'underline' : 'none',
                                        textDecorationColor: 'rgba(79, 70, 229, 0.3)',
                                        textUnderlineOffset: '3px'
                                    }}>
                                        {n.message}
                                    </h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: canAcceptInvitation(n) ? '0.75rem' : 0 }}>
                                        {formatNotificationDateTime(n.createdAt)}
                                    </p>
                                    {canAcceptInvitation(n) && (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px' }}
                                                onClick={(e) => handleAccept(e, n)}
                                                disabled={acceptingId === n.id}
                                            >
                                                {acceptingId === n.id ? '...' : '✓ Accept'}
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px' }}
                                                onClick={(e) => handleDecline(e, n)}
                                                disabled={decliningId === n.id}
                                            >
                                                {decliningId === n.id ? '...' : '✗ Decline'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn-ghost"
                                    style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
                                    onClick={(e) => handleDelete(e, n.id)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default NotificationPanel;
