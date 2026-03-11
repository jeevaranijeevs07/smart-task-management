import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronDown, Image, KeyRound, Lightbulb, Moon, Save, Sun, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAME_PATTERN = /^[A-Za-z][A-Za-z\s'-]*$/;

const Settings = () => {
    const navigate = useNavigate();
    const { user, updateProfile, deleteAccount, theme, changeTheme } = useAuth();
    const [formData, setFormData] = useState({ name: '', avatarUrl: '' });
    const [saving, setSaving] = useState(false);
    const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);
    const [showFab, setShowFab] = useState(() => localStorage.getItem('smarttask_showTips') !== 'false');
    const [openSection, setOpenSection] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    useEffect(() => {
        setFormData({
            name: user?.name || '',
            avatarUrl: user?.avatarUrl || '',
        });
    }, [user]);

    useEffect(() => {
        setAvatarPreviewFailed(false);
    }, [formData.avatarUrl]);


    const initials = useMemo(() => {
        if (!formData.name) return 'U';
        return formData.name
            .split(' ')
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }, [formData.name]);

    const hasProfileChanges = useMemo(() => {
        const currentName = (user?.name || '').trim().replace(/\s+/g, ' ');
        const currentAvatar = (user?.avatarUrl || '').trim();
        const nextName = formData.name.trim().replace(/\s+/g, ' ');
        const nextAvatar = formData.avatarUrl.trim();
        return currentName !== nextName || currentAvatar !== nextAvatar;
    }, [formData.name, formData.avatarUrl, user?.name, user?.avatarUrl]);

    const validate = () => {
        const normalizedName = formData.name.trim().replace(/\s+/g, ' ');
        if (normalizedName.length < 2 || normalizedName.length > 50) {
            return 'Name must be between 2 and 50 characters.';
        }
        if (!NAME_PATTERN.test(normalizedName)) {
            return 'Name can only contain letters, spaces, apostrophes, and hyphens.';
        }
        if (formData.avatarUrl && !/^https?:\/\/.+/i.test(formData.avatarUrl.trim())) {
            return 'Avatar URL must start with http:// or https://.';
        }
        if (formData.avatarUrl && formData.avatarUrl.trim().length > 512) {
            return 'Avatar URL must be at most 512 characters.';
        }
        return null;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!hasProfileChanges) {
            return;
        }
        const error = validate();
        if (error) {
            toast.error(error);
            return;
        }

        setSaving(true);
        const payload = {
            name: formData.name.trim().replace(/\s+/g, ' '),
            avatarUrl: formData.avatarUrl.trim(),
        };
        const result = await updateProfile(payload);
        if (!result.success) {
            toast.error(result.error || 'Failed to update profile.');
        }
        setSaving(false);
    };

    const openFinalDeleteModal = () => {
        if (deleteConfirmText !== 'DELETE') {
            toast.error('Please type DELETE to continue.');
            return;
        }
        setShowDeleteModal(true);
    };

    const handleDeleteAccount = async () => {
        setDeletingAccount(true);
        const result = await deleteAccount();
        setDeletingAccount(false);

        if (!result.success) {
            toast.error(result.error || 'Failed to delete account.');
            return;
        }

        setShowDeleteModal(false);
        navigate('/register');
    };

    const toggleSection = (section) => {
        setOpenSection((prev) => (prev === section ? '' : section));
    };

    return (
        <div className="dashboard-layout">
            <Sidebar />

            <main className="dashboard-main animate-fade-in">
                <div className="profile-header-row">
                    <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem' }} title="Back to Dashboard">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="profile-title">Settings</h1>
                </div>

                <div className="settings-accordion">
                    <button className="settings-accordion-header" onClick={() => toggleSection('profile')}>
                        <span>Profile</span>
                        <ChevronDown size={18} className={openSection === 'profile' ? 'accordion-chevron open' : 'accordion-chevron'} />
                    </button>
                </div>

                <div className={`accordion-content ${openSection === 'profile' ? 'open' : ''}`}>
                    <div className="profile-grid" style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                        <section className="profile-card">
                            <h2>Profile</h2>
                            <p>Edit your display name and avatar.</p>

                            <form onSubmit={onSubmit}>
                                <div className="input-group">
                                    <label className="label">Display Name</label>
                                    <div className="input-icon-wrapper">
                                        <User size={16} className="input-icon" />
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.name}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                            placeholder="Your name"
                                            maxLength={50}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label className="label">Avatar URL</label>
                                    <div className="input-icon-wrapper">
                                        <Image size={16} className="input-icon" />
                                        <input
                                            type="url"
                                            className="input"
                                            value={formData.avatarUrl}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                                            placeholder="https://example.com/avatar.jpg"
                                            maxLength={512}
                                        />
                                    </div>
                                </div>

                                {hasProfileChanges && (
                                    <div className="profile-actions">
                                        <button type="submit" className="btn btn-primary" disabled={saving}>
                                            <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                )}
                            </form>
                        </section>

                        <section className="profile-preview-card">
                            <h3>Preview</h3>
                            <div className="profile-preview-avatar">
                                {formData.avatarUrl && !avatarPreviewFailed ? (
                                    <img src={formData.avatarUrl} alt="Avatar preview" onError={() => setAvatarPreviewFailed(true)} />
                                ) : (
                                    <span>{initials}</span>
                                )}
                            </div>
                            <p className="profile-preview-name">{formData.name || 'User'}</p>
                            <p className="profile-preview-email">{user?.email}</p>
                        </section>
                    </div>
                </div>

                <div className="settings-accordion">
                    <button className="settings-accordion-header" onClick={() => toggleSection('preferences')}>
                        <span>Preferences</span>
                        <ChevronDown size={18} className={openSection === 'preferences' ? 'accordion-chevron open' : 'accordion-chevron'} />
                    </button>
                </div>

                <div className={`accordion-content ${openSection === 'preferences' ? 'open' : ''}`}>
                    <div className="settings-section" style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                        <h2>Preferences</h2>
                        <div className="pref-row">
                            <div className="pref-info">
                                <div className="pref-label">{theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} Theme</div>
                                <p className="pref-desc">Switch between dark and light mode</p>
                            </div>
                            <button
                                className={`pref-toggle ${theme === 'light' ? 'active' : ''}`}
                                onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
                            >
                                <span className="pref-toggle-knob" />
                            </button>
                        </div>

                        <div className="pref-row">
                            <div className="pref-info">
                                <div className="pref-label"><Lightbulb size={16} /> Tips on Dashboard</div>
                                <p className="pref-desc">Show the floating tips button</p>
                            </div>
                            <button
                                className={`pref-toggle ${showFab ? 'active' : ''}`}
                                onClick={() => {
                                    const next = !showFab;
                                    setShowFab(next);
                                    localStorage.setItem('smarttask_showTips', next.toString());
                                }}
                            >
                                <span className="pref-toggle-knob" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="settings-accordion">
                    <button className="settings-accordion-header" onClick={() => toggleSection('security')}>
                        <span>Security</span>
                        <ChevronDown size={18} className={openSection === 'security' ? 'accordion-chevron open' : 'accordion-chevron'} />
                    </button>
                </div>

                <div className={`accordion-content ${openSection === 'security' ? 'open' : ''}`}>
                    <div className="settings-section" style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                        <h2>Security</h2>
                        <p className="pref-desc" style={{ marginBottom: '0.75rem' }}>Change password using secure reset flow.</p>
                        <button className="btn btn-secondary" onClick={() => navigate('/forgot-password')}>
                            <KeyRound size={16} /> Change Password
                        </button>
                    </div>
                </div>

                <div className="settings-accordion">
                    <button className="settings-accordion-header" onClick={() => toggleSection('danger')}>
                        <span>Danger Zone</span>
                        <ChevronDown size={18} className={openSection === 'danger' ? 'accordion-chevron open' : 'accordion-chevron'} />
                    </button>
                </div>

                <div className={`accordion-content ${openSection === 'danger' ? 'open' : ''}`}>
                    <div className="settings-section danger-zone" style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                        <h2>Danger Zone</h2>
                        <p className="danger-message">
                            Deleting your account is permanent. All your user-linked data will be removed and cannot be recovered.
                        </p>
                        <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                            <label className="label">Type DELETE to confirm</label>
                            <input
                                type="text"
                                className="input"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE"
                            />
                        </div>
                        <button
                            className="btn btn-danger"
                            onClick={openFinalDeleteModal}
                            disabled={deleteConfirmText !== 'DELETE'}
                        >
                            <AlertTriangle size={16} /> Delete Account
                        </button>
                    </div>
                </div>
            </main>

            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => !deletingAccount && setShowDeleteModal(false)}>
                    <div className="modal-card danger-modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={18} /> Final Confirmation
                            </h3>
                            <button
                                className="btn-ghost"
                                style={{ padding: '0.2rem' }}
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deletingAccount}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="pref-desc" style={{ marginBottom: '1rem' }}>
                            This action cannot be undone. Are you absolutely sure you want to permanently delete your account?
                        </p>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deletingAccount}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleDeleteAccount}
                                disabled={deletingAccount}
                            >
                                {deletingAccount ? 'Deleting...' : 'Yes, Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
