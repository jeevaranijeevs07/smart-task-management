import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, UserPlus, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { register } = useAuth();
    const inviteToken = searchParams.get('inviteToken');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(formData.name)) {
            toast.error("Name must contain only letters and spaces");
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }
        setIsSubmitting(true);
        const result = await register({
            name: formData.name,
            email: formData.email,
            password: formData.password
        });
        setIsSubmitting(false);
        if (result.success) {
            const loginPath = inviteToken
                ? `/login?inviteToken=${encodeURIComponent(inviteToken)}`
                : '/login';
            navigate(loginPath);
        }
    };

    return (
        <div className="page-center">
            {/* Background Blobs */}
            <div className="blob blob-indigo animate-float" style={{ width: '30vw', height: '30vw', top: '-5%', right: '-5%' }}></div>
            <div className="blob blob-cyan animate-float" style={{ width: '30vw', height: '30vw', bottom: '-5%', left: '-5%', animationDelay: '2s' }}></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="auth-card auth-card-wide glass-premium glow-border"
            >
                <div className="auth-header">
                    <div className="auth-logo">
                        <UserPlus color="white" size={28} />
                    </div>
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join high-performance teams globally</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="label">Full Name</label>
                        <div className="input-icon-wrapper">
                            <User size={18} className="input-icon" />
                            <input
                                type="text"
                                name="name"
                                required
                                className="input"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="label">Email Address</label>
                        <div className="input-icon-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                name="email"
                                required
                                className="input"
                                placeholder="you@gmail.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-grid form-grid-2">
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="label">Password</label>
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
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="label">Confirm Password</label>
                            <div className="input-icon-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    required
                                    className="input input-with-right-icon"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                                <button
                                    type="button"
                                    className="input-icon-right"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    tabIndex="-1"
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem', marginTop: '1.5rem' }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="animate-spin" style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                        ) : (
                            <>Join Now <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account?{' '}
                    <Link to={inviteToken ? `/login?inviteToken=${encodeURIComponent(inviteToken)}` : "/login"}>
                        Sign in here
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
