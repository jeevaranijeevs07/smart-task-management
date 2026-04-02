import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Layers, Users, ArrowRight,
    Layout, Clock, Inbox, Target, Sparkles, X, Bell, ChevronDown, Trash2, MessageSquare, ChevronRight, Check, History
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_ENDPOINTS } from '../config/apiConfig';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import useWebSocket from '../hooks/useWebSocket';
import useSSE from '../hooks/useSSE';

const RECENT_WORKSPACES_KEY = 'smarttask_recent_workspaces';
const NOTIFICATION_SWIPE_DELETE_WIDTH = 112;
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
const formatNotificationTime = (value) => {
    const parsed = parseNotificationDate(value);
    return parsed ? parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [tipIndex, setTipIndex] = useState(0);
    const [tipOpen, setTipOpen] = useState(false);
    const [qsIndex, setQsIndex] = useState(0);
    const showFab = localStorage.getItem('smarttask_showTips') !== 'false';
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [activities, setActivities] = useState([]);
    const [activitiesLoading, setActivitiesLoading] = useState(false);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [acceptingNotificationId, setAcceptingNotificationId] = useState(null);
    const [deletingNotificationId, setDeletingNotificationId] = useState(null);
    const [swipedNotificationId, setSwipedNotificationId] = useState(null);
    const [quickActionType, setQuickActionType] = useState(null); // 'board' or 'invite'
    const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);

    const [recentWorkspaceIds, setRecentWorkspaceIds] = useState(() => {
        try {
            const parsed = JSON.parse(localStorage.getItem(RECENT_WORKSPACES_KEY) || '[]');
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            return [];
        }
    });

    const tips = [
        { icon: <Layers size={14} />, title: 'Create Boards', text: 'Organize your tasks using boards and lists.' },
        { icon: <Target size={14} />, title: 'Stay Organized', text: 'Use boards and lists to break work into manageable pieces.' },
        { icon: <Users size={14} />, title: 'Collaborate Better', text: 'Invite team members to your workspace and assign tasks directly.' },
        { icon: <Sparkles size={14} />, title: 'Track Progress', text: 'Drag and drop cards across lists to update task status.' },
    ];

    // Auto-rotate tips every 8s
    useEffect(() => {
        const timer = setInterval(() => setTipIndex((prev) => (prev + 1) % tips.length), 8000);
        return () => clearInterval(timer);
    }, []);

    const fetchWorkspaces = async () => {
        try {
            const res = await api.get(API_ENDPOINTS.WORKSPACES.GET_ALL);
            const rawWorkspaces = res.data || [];

            const enrichedWorkspaces = await Promise.all(
                rawWorkspaces.map(async (ws) => {
                    const workspaceId = ws?.id ?? ws?.workspaceId;
                    if (!workspaceId) {
                        return {
                            ...ws,
                            boardCount: 0,
                            memberCount: ws?.members?.length || 0,
                        };
                    }

                    try {
                        const boardsRes = await api.get(API_ENDPOINTS.BOARDS.BY_WORKSPACE(workspaceId));
                        return {
                            ...ws,
                            boardCount: (boardsRes.data || []).length,
                            memberCount: ws?.members?.length || 0,
                        };
                    } catch (error) {
                        return {
                            ...ws,
                            boardCount: 0,
                            memberCount: ws?.members?.length || 0,
                        };
                    }
                })
            );

            setWorkspaces(enrichedWorkspaces);
        } catch (err) {
            console.error('Failed to fetch workspaces:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchWorkspaces(); }, []);

    const fetchNotifications = async () => {
        setNotificationsLoading(true);
        try {
            const res = await api.get(API_ENDPOINTS.NOTIFICATIONS.GET_ALL);
            setNotifications(res.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load notifications');
        } finally {
            setNotificationsLoading(false);
        }
    };

    const fetchActivities = async () => {
        setActivitiesLoading(true);
        try {
            const res = await api.get(API_ENDPOINTS.ACTIVITIES.RECENT);
            setActivities(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load activity');
            setActivities([]);
        } finally {
            setActivitiesLoading(false);
        }
    };

    const handleOpenWorkspace = (workspace) => {
        const workspaceId = workspace?.id ?? workspace?.workspaceId;
        if (!workspaceId) {
            toast.error('Workspace ID is missing. Please refresh and try again.');
            return;
        }
        const normalizedId = String(workspaceId);
        setRecentWorkspaceIds((prev) => {
            const next = [normalizedId, ...prev.filter((id) => id !== normalizedId)].slice(0, 12);
            localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
            return next;
        });
        navigate(`/workspace/${workspaceId}`);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        try {
            await api.post(API_ENDPOINTS.WORKSPACES.CREATE, { name: newName.trim() });
            toast.success('Workspace created!');
            setShowModal(false);
            setNewName('');
            fetchWorkspaces();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create workspace');
        } finally {
            setCreating(false);
        }
    };


    const isNewUser = !isLoading && workspaces.length === 0;
    const isWorkspacesOnly = location.hash === '#workspaces';
    const isNotificationsOnly = location.hash === '#notifications';
    const isActivityOnly = location.hash === '#activity';
    const displayedWorkspaces = useMemo(() => {
        if (isWorkspacesOnly) return workspaces;
        if (recentWorkspaceIds.length === 0) return [];

        const byId = new Map(
            workspaces.map((ws) => [String(ws?.id ?? ws?.workspaceId), ws])
        );
        return recentWorkspaceIds
            .map((id) => byId.get(String(id)))
            .filter(Boolean);
    }, [workspaces, recentWorkspaceIds, isWorkspacesOnly]);

    useEffect(() => {
        if (isNotificationsOnly) {
            fetchNotifications();
        }
    }, [isNotificationsOnly]);

    useEffect(() => {
        if (isActivityOnly) {
            fetchActivities();
        }
    }, [isActivityOnly]);

    // WebSocket: prepend new notifications in real time
    const handleWsNotification = useCallback((data) => {
        setNotifications((prev) => {
            const dataTimestamp = data.createdAt ? new Date(data.createdAt) : new Date();
            const exists = prev.some(n =>
                n.id === data.id ||
                (n.message === data.message && Math.abs(new Date(n.createdAt || new Date()) - dataTimestamp) < 5000)
            );
            if (exists) return prev;

            const newNotification = {
                id: data.id || Date.now() + Math.random(),
                type: data.type,
                message: data.message,
                cardId: data.cardId,
                isRead: false,
                createdAt: data.createdAt || new Date().toISOString(),
            };
            toast('🔔 ' + data.message, { icon: '⏰', duration: 5000 });
            return [newNotification, ...prev];
        });
    }, []);
    useWebSocket(handleWsNotification);

    // SSE Integration
    const handleSseNotification = useCallback((data) => {
        console.log('📡 SSE Notification received:', data);
        setNotifications((prev) => {
            const dataTimestamp = data.createdAt ? new Date(data.createdAt) : new Date();
            const exists = prev.some(n =>
                n.id === data.id ||
                (n.message === data.message && Math.abs(new Date(n.createdAt || new Date()) - dataTimestamp) < 5000)
            );
            if (exists) return prev;

            const newNotification = {
                id: data.id || Date.now() + Math.random(),
                type: data.type,
                message: data.message,
                cardId: data.cardId,
                isRead: false,
                createdAt: data.createdAt || new Date().toISOString(),
            };
            toast('🔔 ' + data.message, { icon: '📡', duration: 5000 });
            return [newNotification, ...prev];
        });
    }, []);
    useSSE(handleSseNotification);

    // Initial fetch on mount
    useEffect(() => {
        fetchNotifications();
    }, []);

    const [openSection, setOpenSection] = useState('notifications');

    const toggleSection = (section) => {
        setOpenSection((prev) => (prev === section ? '' : section));
    };

    useEffect(() => {
        if (isNotificationsOnly) {
            setOpenSection('notifications');
            return;
        }
        if (isActivityOnly) {
            setOpenSection('activities');
        }
    }, [isNotificationsOnly, isActivityOnly]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId));
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
            );
            setSwipedNotificationId((prev) => (prev === notificationId ? null : prev));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update notification');
        }
    };

    const handleMarkAllAsRead = async () => {
        setMarkingAllRead(true);
        try {
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setSwipedNotificationId(null);
            toast.success('All notifications marked as read');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark all as read');
        } finally {
            setMarkingAllRead(false);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        setDeletingNotificationId(notificationId);
        try {
            await api.delete(API_ENDPOINTS.NOTIFICATIONS.DELETE(notificationId));
            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
            setSwipedNotificationId((prev) => (prev === notificationId ? null : prev));
            toast.success('Notification deleted');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete notification');
        } finally {
            setDeletingNotificationId(null);
        }
    };

    const canAcceptInvitation = (notification) =>
        notification?.type === 'WORKSPACE_INVITATION' && Boolean(notification?.actionToken) && !notification.isRead;

    const handleAcceptInvitation = async (notification) => {
        if (!notification?.actionToken) return;

        setAcceptingNotificationId(notification.id);
        try {
            await api.post(API_ENDPOINTS.INVITATIONS.ACCEPT, null, {
                params: { token: notification.actionToken },
            });
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notification.id));
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notification.id
                        ? { ...n, isRead: true, actionToken: null, message: n.message + ' — Accepted' }
                        : n
                )
            );
            setSwipedNotificationId((prev) => (prev === notification.id ? null : prev));
            toast.success('Invitation accepted.');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to accept invitation.';
            if (message.toLowerCase().includes('already accepted')) {
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notification.id ? { ...n, isRead: true, actionToken: null } : n
                    )
                );
                setSwipedNotificationId((prev) => (prev === notification.id ? null : prev));
                toast.success('Invitation already accepted.');
            } else {
                toast.error(message);
            }
        } finally {
            setAcceptingNotificationId(null);
        }
    };

    const [decliningNotificationId, setDecliningNotificationId] = useState(null);

    const handleDeclineInvitation = async (notification) => {
        setDecliningNotificationId(notification.id);
        try {
            await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notification.id));
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notification.id
                        ? { ...n, isRead: true, actionToken: null, message: n.message + ' — Declined' }
                        : n
                )
            );
            setSwipedNotificationId((prev) => (prev === notification.id ? null : prev));
            toast('Invitation declined.', { icon: '🚫' });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to decline invitation.');
        } finally {
            setDecliningNotificationId(null);
        }
    };

    return (
        <div className="dashboard-layout">
            <Sidebar />

            <main className="dashboard-main animate-fade-in">
                {/* Header */}
                <div className="dash-header">
                    <p className="dash-date">{isNewUser ? `Hey, ${user?.name || 'User'}` : `Welcome back, ${user?.name || 'User'}`}</p>
                    <h1 className="dash-greeting">{isNewUser ? 'Organize your work and stay on track 🎯' : 'Track progress and stay aligned ⚡'}</h1>
                </div>

                {/* Quick Actions Row */}
                {
                    !isWorkspacesOnly && !isNotificationsOnly && !isActivityOnly && (
                        <div className="stats-row" style={{ gap: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                            <motion.div
                                whileHover={{ y: -3 }}
                                className="stat-card"
                                style={{ cursor: 'pointer', border: '1px solid rgba(79, 70, 229, 0.3)' }}
                                onClick={() => setShowModal(true)}
                            >
                                <div className="stat-icon indigo" style={{ background: 'var(--accent-gradient)', color: '#fff' }}><Plus size={22} /></div>
                                <div style={{ flex: 1 }}>
                                    <p className="stat-label" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>New Workspace</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', textTransform: 'none', letterSpacing: 'normal' }}>Create a new space for your team</p>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ y: -3 }}
                                className="stat-card"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    if (workspaces.length === 1) {
                                        const targetId = workspaces[0].id || workspaces[0].workspaceId;
                                        if (targetId) navigate(`/workspace/${targetId}/members`, { state: { targetTab: 'boards' } });
                                    } else if (workspaces.length > 1) {
                                        setQuickActionType('boards');
                                        setShowWorkspacePicker(true);
                                    } else {
                                        setShowModal(true);
                                    }
                                }}
                            >
                                <div className="stat-icon cyan"><Layout size={22} /></div>
                                <div style={{ flex: 1 }}>
                                    <p className="stat-label" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>Create Board</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', textTransform: 'none', letterSpacing: 'normal' }}>Organize tasks in a workspace</p>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ y: -3 }}
                                className="stat-card"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    if (workspaces.length === 1) {
                                        const targetId = workspaces[0].id || workspaces[0].workspaceId;
                                        if (targetId) navigate(`/workspace/${targetId}/members`, { state: { targetTab: 'invite' } });
                                    } else if (workspaces.length > 1) {
                                        setQuickActionType('invite');
                                        setShowWorkspacePicker(true);
                                    } else {
                                        setShowModal(true);
                                    }
                                }}
                            >
                                <div className="stat-icon amber"><Users size={22} /></div>
                                <div style={{ flex: 1 }}>
                                    <p className="stat-label" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>Invite Team</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', textTransform: 'none', letterSpacing: 'normal' }}>Bring your team on board</p>
                                </div>
                            </motion.div>
                        </div>
                    )
                }

                {
                    isNotificationsOnly ? (
                        <>
                            <div className="settings-accordion" style={{ marginTop: 0 }}>
                                <button className="settings-accordion-header" onClick={() => toggleSection('notifications')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Bell size={18} /> Notifications
                                    </span>
                                    <ChevronDown size={18} className={openSection === 'notifications' ? 'accordion-chevron open' : 'accordion-chevron'} />
                                </button>
                            </div>

                            <div className={`accordion-content ${openSection === 'notifications' ? 'open' : ''}`}>
                                <section className="settings-section" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Only show unread</span>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={showUnreadOnly}
                                                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
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
                                            onClick={handleMarkAllAsRead}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                            disabled={markingAllRead || notifications.length === 0}
                                        >
                                            {markingAllRead ? 'Marking...' : 'Mark All Read'}
                                        </button>
                                    </div>

                                    {notificationsLoading ? (
                                        <p style={{ color: 'var(--text-muted)' }}>Loading notifications...</p>
                                    ) : notifications.length === 0 ? (
                                        <div className="panel-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                            <Bell size={28} style={{ opacity: 0.5 }} />
                                            <p style={{ marginTop: '0.75rem' }}>No notifications yet.</p>
                                        </div>
                                    ) : showUnreadOnly && notifications.filter(n => !n.isRead).length === 0 ? (
                                        <div className="panel-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
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
                                            <h4 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No unread notifications</h4>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                Slide left to delete. Tap a notification to mark it as read.
                                            </p>
                                            {(showUnreadOnly ? notifications.filter(n => !n.isRead) : notifications).map((notification) => {
                                                const isSwipedOpen = swipedNotificationId === notification.id;
                                                const isRowBusy = acceptingNotificationId === notification.id || deletingNotificationId === notification.id;

                                                return (
                                                    <div
                                                        key={notification.id}
                                                        style={{
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            borderRadius: 'var(--radius-md)'
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                inset: 0,
                                                                display: 'flex',
                                                                justifyContent: 'flex-end',
                                                                alignItems: 'stretch',
                                                                background: 'linear-gradient(90deg, transparent 0%, rgba(239, 68, 68, 0.35) 50%, rgba(239, 68, 68, 0.6) 100%)'
                                                            }}
                                                        >
                                                            <button
                                                                className="btn btn-danger"
                                                                style={{
                                                                    width: `${NOTIFICATION_SWIPE_DELETE_WIDTH}px`,
                                                                    borderRadius: 0,
                                                                    borderTopRightRadius: 'var(--radius-md)',
                                                                    borderBottomRightRadius: 'var(--radius-md)',
                                                                    justifyContent: 'center',
                                                                    fontSize: '0.78rem',
                                                                    color: '#fff',
                                                                    background: 'rgba(239, 68, 68, 0.85)'
                                                                }}
                                                                disabled={isRowBusy}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteNotification(notification.id);
                                                                }}
                                                            >
                                                                {deletingNotificationId === notification.id ? 'Deleting...' : <><Trash2 size={14} /> Delete</>}
                                                            </button>
                                                        </div>

                                                        <motion.div
                                                            className="glass"
                                                            drag={isRowBusy ? false : 'x'}
                                                            dragConstraints={{ left: -NOTIFICATION_SWIPE_DELETE_WIDTH, right: 0 }}
                                                            dragElastic={0.08}
                                                            dragMomentum={false}
                                                            onDragStart={() => {
                                                                if (swipedNotificationId !== notification.id) {
                                                                    setSwipedNotificationId(null);
                                                                }
                                                            }}
                                                            onDragEnd={(_, info) => {
                                                                if (info.offset.x <= -70) {
                                                                    setSwipedNotificationId(notification.id);
                                                                } else {
                                                                    setSwipedNotificationId(null);
                                                                }
                                                            }}
                                                            animate={{ x: isSwipedOpen ? -NOTIFICATION_SWIPE_DELETE_WIDTH : 0 }}
                                                            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                                                            onClick={() => {
                                                                if (isSwipedOpen) {
                                                                    setSwipedNotificationId(null);
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '1rem',
                                                                borderRadius: 'var(--radius-md)',
                                                                backgroundColor: notification.isRead ? 'rgba(255,255,255,0.02)' : 'rgba(79, 70, 229, 0.1)',
                                                                border: notification.isRead ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(79, 70, 229, 0.3)',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'flex-start',
                                                                gap: '1rem',
                                                                touchAction: 'pan-y',
                                                                cursor: isRowBusy ? 'default' : 'grab'
                                                            }}
                                                        >
                                                            <div style={{ flex: 1 }}>
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isSwipedOpen) {
                                                                            setSwipedNotificationId(null);
                                                                            return;
                                                                        }
                                                                        if (!notification.isRead && !isRowBusy) {
                                                                            handleMarkAsRead(notification.id);
                                                                        }
                                                                    }}
                                                                    style={{ cursor: !notification.isRead && !isRowBusy ? 'pointer' : 'default' }}
                                                                >
                                                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', color: notification.isRead ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                                                        {notification.message}
                                                                    </h4>
                                                                </div>
                                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: canAcceptInvitation(notification) ? '0.75rem' : 0 }}>
                                                                    {formatNotificationDateTime(notification.createdAt)}
                                                                </p>
                                                                {canAcceptInvitation(notification) && (
                                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                        <button
                                                                            className="btn btn-primary"
                                                                            style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                                                            disabled={isRowBusy}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleAcceptInvitation(notification);
                                                                            }}
                                                                        >
                                                                            {acceptingNotificationId === notification.id ? 'Accepting...' : '✓ Accept'}
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-secondary"
                                                                            style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                                                            disabled={isRowBusy || decliningNotificationId === notification.id}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeclineInvitation(notification);
                                                                            }}
                                                                        >
                                                                            {decliningNotificationId === notification.id ? 'Declining...' : '✗ Decline'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </>
                    ) : isActivityOnly ? (
                        <>
                            <div className="settings-accordion" style={{ marginTop: 0 }}>
                                <button className="settings-accordion-header" onClick={() => toggleSection('activities')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <History size={18} /> Activity
                                    </span>
                                    <ChevronDown size={18} className={openSection === 'activities' ? 'accordion-chevron open' : 'accordion-chevron'} />
                                </button>
                            </div>

                            <div className={`accordion-content ${openSection === 'activities' ? 'open' : ''}`}>
                                <section className="settings-section" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                                    {activitiesLoading ? (
                                        <p style={{ color: 'var(--text-muted)' }}>Loading activity...</p>
                                    ) : activities.length === 0 ? (
                                        <div className="panel-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                            <History size={28} style={{ opacity: 0.5 }} />
                                            <p style={{ marginTop: '0.75rem' }}>No activity yet.</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                            {activities.map((activity, index) => (
                                                <div
                                                    key={activity.id ?? `${activity.createdAt}-${index}`}
                                                    className="glass"
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid rgba(255,255,255,0.07)',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        gap: '1rem',
                                                        alignItems: 'flex-start'
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                                                            {activity.description || `${activity.userName || 'User'} performed ${String(activity.action || 'ACTIVITY').replaceAll('_', ' ')}`}
                                                        </p>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {activity.workspaceName || 'Workspace'}
                                                            {activity.cardTitle ? ` • Card: ${activity.cardTitle}` : ''}
                                                            {activity.userName ? ` • By: ${activity.userName}` : ''}
                                                        </p>
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                        {formatNotificationDateTime(activity.createdAt)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </>
                    ) : (
                        /* Two-column content */
                        <div className={`dash-content ${isWorkspacesOnly ? 'full-width' : ''}`}>
                            {/* Left column */}
                            <div>
                                {isNewUser && !isWorkspacesOnly ? (
                                    <>
                                        {/* Welcome hero */}
                                        <div className="welcome-hero">
                                            <h2>Welcome to SmartTask! 🚀</h2>
                                            <p>Get started by creating your first workspace and inviting your team to collaborate.</p>
                                        </div>

                                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textAlign: 'center' }}>Quick Start</h3>
                                        <div className="qs-slider">
                                            <AnimatePresence mode="wait">
                                                {[[
                                                    { icon: <Layers size={20} />, cls: 'purple', title: 'Create Your First Workspace', desc: 'Set up a workspace to organize your team\'s projects and tasks.', action: () => setShowModal(true) },
                                                    { icon: <Users size={20} />, cls: 'teal', title: 'Invite Your Team Members', desc: 'Bring your team on board and start collaborating together.' },
                                                    { icon: <Layout size={20} />, cls: 'blue', title: 'Set Up Your First Board', desc: 'Create a board to manage tasks and track progress easily.' },
                                                ][qsIndex]].map((card) => (
                                                    <motion.div
                                                        key={qsIndex}
                                                        className="qs-card"
                                                        initial={{ opacity: 0, x: 40 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -40 }}
                                                        transition={{ duration: 0.25 }}
                                                        onClick={card.action}
                                                        style={{ cursor: card.action ? 'pointer' : 'default' }}
                                                    >
                                                        <div className={`qs-icon ${card.cls}`}>{card.icon}</div>
                                                        <div>
                                                            <h4>{card.title}</h4>
                                                            <p>{card.desc}</p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: '0.75rem' }}>
                                                {[0, 1, 2].map((i) => (
                                                    <span
                                                        key={i}
                                                        onClick={() => setQsIndex(i)}
                                                        style={{
                                                            width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                                                            background: i === qsIndex ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                            opacity: i === qsIndex ? 1 : 0.3,
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Workspace list */}
                                        <div id="workspaces" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h3 style={{ fontSize: '1rem' }}>
                                                {isWorkspacesOnly ? 'Your Workspaces' : 'Recently Opened Workspaces'}
                                            </h3>
                                            {isWorkspacesOnly && displayedWorkspaces.length > 0 && <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setShowModal(true)}>
                                                <Plus size={16} /> New
                                            </button>}
                                        </div>
                                        {isLoading ? (
                                            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                                        ) : displayedWorkspaces.length === 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'left', gap: '3rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Layers size={24} style={{ color: 'var(--text-muted)' }} />
                                                        </div>
                                                        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>
                                                            {isWorkspacesOnly ? 'No Workspaces Yet' : 'No Recent Workspaces'}
                                                        </h3>
                                                    </div>
                                                    <p style={{ color: 'var(--text-muted)', marginBottom: 0, maxWidth: '400px' }}>
                                                        {isWorkspacesOnly ? 'Create your first workspace to start organizing your projects, tasks, and team collaboration.' : 'Your recently accessed workspaces will appear here.'}
                                                    </p>
                                                </div>
                                                {isWorkspacesOnly && (
                                                    <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }} onClick={() => setShowModal(true)}>
                                                        <Plus size={18} /> New Workspace
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="workspace-grid">
                                                {displayedWorkspaces.map((ws) => (
                                                    <motion.div
                                                        key={ws.id ?? ws.workspaceId ?? ws.name}
                                                        whileHover={{ y: -3 }}
                                                        className="glass-card"
                                                        style={{ padding: '1.25rem', cursor: 'pointer' }}
                                                        onClick={() => handleOpenWorkspace(ws)}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Layers size={20} style={{ color: '#818cf8' }} />
                                                            </div>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.2rem 0.5rem', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                                {ws.role || (ws.members?.find(m => String(m.userId) === String(user?.id))?.role) || 'Member'}
                                                            </span>
                                                        </div>
                                                        <h4 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>{ws.name}</h4>
                                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {ws.memberCount || 1}</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Layout size={13} /> {ws.boardCount || 0} boards</span>
                                                        </div>
                                                        <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                                                            <button
                                                                type="button"
                                                                className="btn-ghost"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenWorkspace(ws);
                                                                }}
                                                                style={{ color: 'var(--accent-secondary)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                                                            >
                                                                Open <ArrowRight size={14} />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Right column — panels */}
                            {!isWorkspacesOnly && <div>
                                {/* Mentions Inbox */}
                                <div className="panel-card">
                                    <div className="panel-header">Mentions</div>
                                    <div className="panel-body">
                                        {notificationsLoading ? (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Loading mentions...</p>
                                        ) : notifications.filter(n => !n.isRead && n.type === 'MENTION').length === 0 ? (
                                            <div className="panel-empty" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                                                }}>
                                                    <Inbox size={24} style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>You're all caught up!</p>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>No new mentions in comments.</p>
                                            </div>
                                        ) : (
                                            <div className="activity-list" style={{ display: 'grid', gap: '1rem', padding: '0.5rem' }}>
                                                {notifications.filter(n => !n.isRead && n.type === 'MENTION').map((mention) => (
                                                    <div
                                                        key={mention.id}
                                                        className="activity-item"
                                                        style={{ display: 'flex', gap: '0.85rem', cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-md)', transition: 'background 0.2s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        onClick={async () => {
                                                            try {
                                                                await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(mention.id));
                                                                setNotifications(prev => prev.filter(n => n.id !== mention.id));
                                                                const workspaceId = mention.workspaceId
                                                                    ?? (mention.actionToken && !isNaN(mention.actionToken) ? Number(mention.actionToken) : null);
                                                                if (workspaceId) {
                                                                    navigate(`/workspace/${workspaceId}/members`);
                                                                }
                                                            } catch (err) {
                                                                toast.error("Failed to mark mention as read.");
                                                            }
                                                        }}
                                                    >
                                                        <div className="activity-avatar" style={{ flexShrink: 0 }}>
                                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                                <MessageSquare size={16} />
                                                            </div>
                                                        </div>
                                                        <div className="activity-details" style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: 0, color: 'var(--text-primary)' }}>
                                                                {mention.message}
                                                            </p>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Click to mark as read</span>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>•</span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <Clock size={10} /> {formatNotificationTime(mention.createdAt)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>


                            </div>}
                        </div>
                    )
                }
            </main >

            {/* Create Workspace Modal */}
            < AnimatePresence >
                {showModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            className="modal-card"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3>Create Workspace</h3>
                                    <p className="modal-sub">A workspace is where your team collaborates on projects.</p>
                                </div>
                                <button className="btn-ghost" style={{ padding: '0.25rem' }} onClick={() => setShowModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleCreate}>
                                <div className="input-group">
                                    <label className="label">Workspace Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g. Marketing Team"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={creating}>
                                        {creating ? 'Creating...' : 'Create Workspace'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence >

            {/* Floating Tips Button */}
            {
                showFab && (
                    <div className="tip-fab-wrapper">
                        <AnimatePresence>
                            {tipOpen && (
                                <motion.div
                                    className="tip-fab-popover"
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={tipIndex}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="tip-item"
                                            style={{ borderBottom: 'none', padding: 0 }}
                                        >
                                            <div className="tip-icon">{tips[tipIndex].icon}</div>
                                            <div className="tip-text">
                                                <strong>{tips[tipIndex].title}</strong>
                                                {tips[tipIndex].text}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            {tips.map((_, i) => (
                                                <span
                                                    key={i}
                                                    onClick={() => setTipIndex(i)}
                                                    style={{
                                                        width: 5, height: 5, borderRadius: '50%', cursor: 'pointer',
                                                        background: i === tipIndex ? 'var(--accent-secondary)' : 'rgba(255,255,255,0.15)',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            className="btn-ghost"
                                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', color: 'var(--accent-secondary)' }}
                                            onClick={() => setTipIndex((prev) => (prev + 1) % tips.length)}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <motion.button
                            className="tip-fab"
                            onClick={() => setTipOpen(!tipOpen)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            title="Tips & Tricks"
                        >
                            💡
                        </motion.button>
                    </div>
                )
            }

            <AnimatePresence>
                {showWorkspacePicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-overlay"
                        onClick={() => setShowWorkspacePicker(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="modal-content glass-card"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                padding: '2rem',
                                maxWidth: '420px',
                                width: '100%',
                                position: 'relative',
                                margin: '0 1rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-glass)'
                            }}
                        >
                            <button
                                onClick={() => setShowWorkspacePicker(false)}
                                style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>

                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                Select a Workspace
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                Which workspace would you like to {quickActionType === 'invite' ? 'invite team members to' : 'create a board in'}?
                            </p>

                            <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {workspaces.filter(ws => {
                                    const role = ws.role || (ws.members?.find(m => String(m.userId) === String(user?.id))?.role) || 'MEMBER';
                                    if (quickActionType === 'boards') {
                                        return role === 'OWNER' || role === 'ADMIN';
                                    }
                                    if (quickActionType === 'invite') {
                                        return Boolean(role);
                                    }
                                    return true;
                                }).map((ws) => (
                                    <button
                                        key={ws.id || ws.workspaceId}
                                        className="btn btn-secondary"
                                        style={{
                                            justifyContent: 'flex-start',
                                            padding: '1rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            textAlign: 'left',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}
                                        onClick={() => {
                                            const targetId = ws.id || ws.workspaceId;
                                            navigate(`/workspace/${targetId}/members`, { state: { targetTab: quickActionType } });
                                        }}
                                    >
                                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Layers size={16} style={{ color: '#818cf8' }} />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{ws.name}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {ws.role || (ws.members?.find(m => String(m.userId) === String(user?.id))?.role) || 'Member'}
                                            </p>
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Dashboard;
