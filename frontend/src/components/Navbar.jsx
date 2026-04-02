import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Layout, LogOut, User, Menu, X, Bell, Layers, History, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationPanel from './NotificationPanel';
import { useUI } from '../context/UIContext';

const Navbar = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isNotifOpen, setIsNotifOpen] = React.useState(false);
    const [avatarFailed, setAvatarFailed] = React.useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const { toggleSidebar, isSidebarOpen } = useUI();
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();

    React.useEffect(() => {
        setAvatarFailed(false);
    }, [user?.avatarUrl]);

    const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);
    const isDashboard = location.pathname === '/dashboard' || location.pathname === '/settings';
    
    // Auth pages never show Navbar. 
    // Dashboard pages only show Navbar on mobile (handled via CSS class below).
    if (isAuthPage) return null;

    const isHome = location.pathname === '/';

    const handleLogout = () => {
        logout();
        setShowLogoutConfirm(false);
        setIsOpen(false);
        navigate('/login');
    };

    const handleHamburger = () => {
        if (isAuthenticated && !isHome) {
            toggleSidebar();
            setIsOpen(false);
        } else {
            setIsOpen((prev) => !prev);
        }
    };

    const hamburgerOpen = (isAuthenticated && !isHome) ? isSidebarOpen : isOpen;
    const shouldShowMobileMenu = isOpen && (!isAuthenticated || isHome);

    return (
        <nav className={`glass navbar ${isDashboard ? 'hide-desktop' : ''}`}>
            <div className="navbar-inner">
                <Link to="/" className="navbar-brand">
                    <div className="navbar-brand-icon">
                        <Layout className="text-white" size={20} />
                    </div>
                    <span className="navbar-brand-text hide-mobile">SmartTask</span>
                </Link>

                {/* Right side */}
                <div className="navbar-right">
                    {(!isHome && isAuthenticated) ? (
                        <>
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="btn-ghost hide-mobile"
                                    style={{ padding: '0.5rem' }}
                                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                                >
                                    <Bell size={20} />
                                </button>
                                <AnimatePresence>
                                    {isNotifOpen && <NotificationPanel onClose={() => setIsNotifOpen(false)} />}
                                </AnimatePresence>
                            </div>

                            <div className="navbar-user">
                                <div className="navbar-user-info hide-mobile">
                                    <p className="navbar-user-name">{user?.name || 'User'}</p>
                                    <p className="navbar-user-email">{user?.email}</p>
                                </div>
                                <div className="navbar-avatar">
                                    {user?.avatarUrl && !avatarFailed ? (
                                        <img src={user.avatarUrl} alt="User avatar" className="profile-avatar-image" onError={() => setAvatarFailed(true)} />
                                    ) : (
                                        <User size={16} className="text-white" />
                                    )}
                                </div>
                                <button
                                    className="hide-desktop btn-ghost"
                                    style={{ padding: '0.5rem' }}
                                    onClick={handleHamburger}
                                >
                                    {hamburgerOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                                <button
                                    onClick={() => setShowLogoutConfirm(true)}
                                    className="btn-ghost hide-mobile"
                                    style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}
                                    title="Logout"
                                >
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <Link to="/login" className="btn btn-ghost hide-mobile" style={{ borderRadius: '999px', padding: '0.5rem 1.25rem' }}>Login</Link>
                            <Link to="/register" className="btn btn-primary hide-mobile" style={{ borderRadius: '999px', padding: '0.5rem 1.25rem' }}>Sign Up</Link>
                            <button
                                className="hide-desktop btn-ghost"
                                style={{ padding: '0.5rem' }}
                                onClick={handleHamburger}
                            >
                                {hamburgerOpen ? <X size={22} /> : <Menu size={22} />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {shouldShowMobileMenu && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="hide-desktop"
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="mobile-menu glass-heavy" style={{ margin: '0 1rem', borderRadius: 'var(--radius-lg)' }}>
                            {(!isHome && isAuthenticated) ? (
                                <>
                                    <Link to="/dashboard" onClick={() => setIsOpen(false)} className="mobile-menu-item">
                                        <Layout size={18} /> Dashboard
                                    </Link>
                                    <Link to="/dashboard#workspaces" onClick={() => setIsOpen(false)} className="mobile-menu-item">
                                        <Layers size={18} /> Workspaces
                                    </Link>
                                    <Link to="/dashboard#notifications" onClick={() => setIsOpen(false)} className="mobile-menu-item">
                                        <Bell size={18} /> Notifications
                                    </Link>
                                    <Link to="/dashboard#activity" onClick={() => setIsOpen(false)} className="mobile-menu-item">
                                        <History size={18} /> Activity
                                    </Link>
                                    <Link to="/settings" onClick={() => setIsOpen(false)} className="mobile-menu-item">
                                        <Settings size={18} /> Settings
                                    </Link>
                                    <div className="profile-menu-divider" />
                                    <button
                                        className="btn-secondary"
                                        style={{ width: '100%', justifyContent: 'center', color: 'var(--color-danger)', border: 'none', background: 'transparent' }}
                                        onClick={() => { setIsOpen(false); setShowLogoutConfirm(true); }}
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" onClick={() => setIsOpen(false)}>Login</Link>
                                    <Link to="/register" onClick={() => setIsOpen(false)}>Sign Up</Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
        </nav>
    );
};

export default Navbar;
