import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { LayoutDashboard, Layers, Bell, Settings, History, Plus, LogOut, ChevronUp, ChevronLeft, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/apiConfig';
import useWebSocket from '../hooks/useWebSocket';
import { useUI } from '../context/UIContext';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { isSidebarOpen, closeSidebar } = useUI();
    const [profileOpen, setProfileOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('smarttask_sidebar_collapsed') === 'true');
    const [unreadCount, setUnreadCount] = useState(0);
    const menuRef = useRef(null);

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Layers, label: 'Workspaces', path: '/dashboard', hash: '#workspaces' },
        { icon: Bell, label: 'Notifications', path: '/dashboard', hash: '#notifications', badge: unreadCount },
        { icon: History, label: 'Activity', path: '/dashboard', hash: '#activity' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= 768;
    });

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handleLogout = () => {
        logout();
        setShowLogoutConfirm(false);
        setProfileOpen(false);
        navigate('/login');
    };

    // Close menu on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Get initials from name
    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const [avatarFailed, setAvatarFailed] = useState(false);
    const hasAvatar = Boolean(user?.avatarUrl) && !avatarFailed;

    useEffect(() => {
        setAvatarFailed(false);
    }, [user?.avatarUrl]);

    useEffect(() => {
        localStorage.setItem('smarttask_sidebar_collapsed', String(isCollapsed));
        document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '76px' : '220px');
        if (isCollapsed) {
            setProfileOpen(false);
        }
    }, [isCollapsed]);

    // WebSocket: increment unread count on each real-time push
    const handleWsMessage = useCallback(() => {
        setUnreadCount((prev) => prev + 1);
    }, []);
    useWebSocket(handleWsMessage);

    // Initial fetch of unread count on mount
    useEffect(() => {
        let isMounted = true;
        const fetchUnreadNotifications = async () => {
            try {
                const res = await api.get(API_ENDPOINTS.NOTIFICATIONS.GET_ALL);
                if (!isMounted) return;
                const notifications = res.data || [];
                setUnreadCount(notifications.filter((n) => !n.isRead).length);
            } catch (error) {
                if (isMounted) setUnreadCount(0);
            }
        };
        fetchUnreadNotifications();
        return () => { isMounted = false; };
    }, [location.pathname, location.hash]);

    const handleNavClick = () => {
        if (isMobile) {
            closeSidebar();
        }
    };

    useEffect(() => {
        if (!isMobile) {
            closeSidebar();
        }
    }, [isMobile, closeSidebar]);

    useEffect(() => {
        if (!isSidebarOpen && isMobile) {
            setProfileOpen(false);
        }
    }, [isSidebarOpen, isMobile]);

    useEffect(() => {
        if (isMobile) {
            closeSidebar();
        }
    }, [location.pathname, location.hash, isMobile, closeSidebar]);

    return (
        <>
            {isMobile && (
                <div
                    className={`sidebar-backdrop ${isSidebarOpen ? 'visible' : ''}`}
                    onClick={closeSidebar}
                />
            )}
            <aside className={`sidebar${isCollapsed ? ' collapsed' : ''}${isSidebarOpen ? ' mobile-open' : ''}`}>
            <div className="sidebar-top">
                <button
                    className="sidebar-toggle-btn"
                    onClick={() => setIsCollapsed((prev) => !prev)}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>
            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.hash
                        ? location.pathname === item.path && location.hash === item.hash
                        : location.pathname === item.path && !location.hash;
                    return (
                        <Link
                            key={item.label}
                            to={item.path + (item.hash || '')}
                            className={`sidebar-link${isActive ? ' active' : ''}`}
                            title={item.label}
                            onClick={handleNavClick}
                        >
                            <Icon size={20} />
                            {!isCollapsed && <span>{item.label}</span>}
                            {!isCollapsed && item.badge > 0 && (
                                <span className="sidebar-badge">{item.badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>


            {/* Profile Section */}
            <div className="sidebar-profile-wrapper" ref={menuRef}>
                {/* Popup Menu */}
                {profileOpen && (
                    <div className="sidebar-profile-menu">
                        <div className="profile-menu-header">
                            <div className="sidebar-profile-avatar" style={{ width: 40, height: 40, fontSize: '0.8rem' }}>
                                {hasAvatar ? (
                                    <img src={user.avatarUrl} alt="User avatar" className="profile-avatar-image" onError={() => setAvatarFailed(true)} />
                                ) : (
                                    getInitials(user?.name)
                                )}
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.email || ''}</p>
                            </div>
                        </div>
                        <div className="profile-menu-divider" />
                        <button className="profile-menu-item danger" onClick={() => setShowLogoutConfirm(true)}>
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                )}

                <div className="sidebar-profile" onClick={() => setProfileOpen(!profileOpen)} style={{ cursor: 'pointer' }} title="Account">
                    <div className="sidebar-profile-avatar">
                        {hasAvatar ? (
                            <img src={user.avatarUrl} alt="User avatar" className="profile-avatar-image" onError={() => setAvatarFailed(true)} />
                        ) : (
                            getInitials(user?.name)
                        )}
                    </div>
                    {!isCollapsed && (
                        <div className="sidebar-profile-info">
                            <p className="sidebar-profile-name">{user?.name || 'User'}</p>
                            <p className="sidebar-profile-email">{user?.email || ''}</p>
                        </div>
                    )}
                    {!isCollapsed && (
                        <ChevronUp size={14} style={{
                            color: 'var(--text-muted)',
                            transition: 'transform 0.2s ease',
                            transform: profileOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                            flexShrink: 0
                        }} />
                    )}
                </div>
            </div>

            {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
                <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
                    <div className="modal-card danger-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '0.75rem' }}>Sign Out</h3>
                        <p className="pref-desc" style={{ marginBottom: '1rem' }}>
                            Are you sure you want to sign out?
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleLogout}>Sign Out</button>
                        </div>
                    </div>
                </div>
                ,
                document.body
            )}
            </aside>
        </>
    );
};

export default Sidebar;
