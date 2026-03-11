import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Layout, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAuth();
    const inviteToken = searchParams.get('inviteToken');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const result = await login(formData.email, formData.password, inviteToken);
        setIsSubmitting(false);
        if (result.success) {
            navigate('/dashboard');
        }
    };

    return (
        <div className="page-center">
            {/* Background Blobs */}
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
                    <h1 className="auth-title">Welcome Back</h1>
                    <p className="auth-subtitle">Sign in to your account to continue</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="label">Email Address</label>
                        <div className="input-icon-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                name="email"
                                required
                                className="input"
                                placeholder="you@email.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                            <label className="label" style={{ marginBottom: 0 }}>Password</label>
                            <Link to="/forgot-password" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818cf8', transition: 'color 0.2s ease' }}
                                onMouseOver={(e) => e.target.style.color = 'var(--accent-secondary)'}
                                onMouseOut={(e) => e.target.style.color = '#818cf8'}
                            >Forgot?</Link>
                        </div>
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
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
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
                            <>Sign In <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    New around here?{' '}
                    <Link to={inviteToken ? `/register?inviteToken=${encodeURIComponent(inviteToken)}` : "/register"}>
                        Create an account
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
