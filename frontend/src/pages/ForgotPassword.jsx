import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Layout, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/users/forgot-password', { email });
            setIsSent(true);
            toast.success("Reset link sent! Please check your console (dev) or email.");
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page-center">
            <div className="blob blob-indigo animate-float" style={{ width: '30vw', height: '30vw', top: '-5%', left: '-5%' }}></div>
            <div className="blob blob-cyan animate-float" style={{ width: '30vw', height: '30vw', bottom: '-5%', right: '-5%', animationDelay: '2s' }}></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="auth-card glass-premium glow-border"
            >
                <div className="auth-header">
                    <div className="auth-logo">
                        <Layout color="white" size={28} />
                    </div>
                    <h1 className="auth-title">Forgot Password?</h1>
                    <p className="auth-subtitle">No worries, we'll send you reset instructions.</p>
                </div>

                {!isSent ? (
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="label">Email Address</label>
                            <div className="input-icon-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    required
                                    className="input"
                                    placeholder="you@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem', marginTop: '0.5rem' }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <div className="animate-spin" style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                            ) : (
                                <>Send Reset Link <ArrowRight size={18} /></>
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="text-center" style={{ padding: '1rem 0' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            We've sent a password reset link to <strong>{email}</strong>.
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            (In development, check the backend console for the link)
                        </p>
                    </div>
                )}

                <div className="auth-footer">
                    <Link to="/login" className="flex-center" style={{ gap: '0.5rem' }}>
                        <ArrowLeft size={16} /> Back to login
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;
