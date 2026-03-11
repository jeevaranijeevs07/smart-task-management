import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Layout, Users, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
    const { isAuthenticated } = useAuth();
    return (
        <div className="animate-fade-in">
            {/* Hero */}
            <section className="hero">
                <div className="container">
                    <div className="hero-grid">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="hero-badge">
                                <Zap size={16} />
                                <span>Engineered for High-Performance Teams</span>
                            </div>

                            <h1>
                                Manage Tasks with <br />
                                <span className="text-cyan">Unparalleled Speed</span>
                            </h1>

                            <p className="hero-desc">
                                Experience a beautiful, modern workflow that helps your team collaborate,
                                organize, and achieve more in less time.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="hero-mockup"
                        >
                            <div className="hero-mockup-glow"></div>
                            <div className="hero-mockup-frame glass-premium">
                                <img src="/images/mockup.png" alt="SmartTask Dashboard" />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="container">
                <div className="features-grid">
                    {[
                        {
                            icon: <Layout size={22} style={{ color: '#facc15' }} />,
                            title: 'Visual Workflow',
                            desc: 'Organize tasks clearly with intuitive drag-and-drop Kanban boards.'
                        },
                        {
                            icon: <Shield size={22} style={{ color: '#22d3ee' }} />,
                            title: 'Private & Secure',
                            desc: 'Enterprise-grade security and role-based access control for your data.'
                        },
                        {
                            icon: <Users size={22} style={{ color: '#818cf8' }} />,
                            title: 'Team Collaboration',
                            desc: 'Invite members and work together seamlessly within dedicated workspaces.'
                        }
                    ].map((f, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="feature-card glass-premium"
                        >
                            <div className="feature-card-header">
                                <span className="feature-card-icon">{f.icon}</span>
                                <h3>{f.title}</h3>
                            </div>
                            <p>{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Social Proof */}
            <section className="social-proof container">
                <p className="social-proof-label">Trusted by high-performance teams</p>
                <div className="social-proof-logos">
                    <span>ACME</span>
                    <span style={{ letterSpacing: '-0.05em' }}>TECHNOS</span>
                    <span style={{ fontStyle: 'italic' }}>CLOUD</span>
                    <span>SPHERE</span>
                    <span>VERTEX</span>
                </div>
            </section>

            {/* CTA */}
            <section className="cta-section container">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <h2>Ready to transform your workflow?</h2>

                    <Link
                        to={isAuthenticated ? "/dashboard" : "/register"}
                        className="btn btn-primary"
                        style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: 'var(--radius-lg)' }}
                    >
                        {isAuthenticated ? "Go to Dashboard" : "Start Organizing for Free"}
                    </Link>
                </motion.div>
            </section>
        </div>
    );
};

export default Home;
