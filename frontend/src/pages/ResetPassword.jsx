import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Layout, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }
        if (!token) {
            toast.error("Invalid or missing token");
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/users/reset-password', {
                token,
                newPassword: formData.password
            });
            toast.success("Password reset successfully! Please login.");
            navigate('/login');
        } catch (error) {
            toast.error(error.response?.data?.message || "Reset failed. Token might be expired.");
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
                    <h1 className="auth-title">Reset Password</h1>
                    <p className="auth-subtitle">Set your new password to regain access</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="label">New Password</label>
                        <div className="input-icon-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                className="input input-with-right-icon"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                            <button
                                type="button"
                                className="input-icon-right"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="label">Confirm New Password</label>
                        <div className="input-icon-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                type="password"
                                name="confirmPassword"
                                required
                                className="input"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
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
                            <>Reset Password <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default ResetPassword;
