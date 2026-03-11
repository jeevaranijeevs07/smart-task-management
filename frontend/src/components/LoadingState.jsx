import React from 'react';
import { motion } from 'framer-motion';

export const LoadingSpinner = ({ size = 'md', color = 'primary' }) => {
    const sizes = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4',
    };

    const colors = {
        primary: 'border-indigo-500',
        white: 'border-white',
    };

    return (
        <div className="flex-center p-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className={`${sizes[size]} rounded-full border-t-transparent ${colors[color]}`}
                style={{ borderStyle: 'solid', borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
            />
        </div>
    );
};

export const LoadingSkeleton = ({ type = 'card' }) => {
    if (type === 'card') {
        return (
            <div className="glass-card p-6 w-full animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
                <div className="h-6 bg-white/10 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-white/10 rounded w-1/2"></div>
            </div>
        );
    }
    return <div className="animate-pulse bg-white/5 rounded h-10 w-full"></div>;
};

