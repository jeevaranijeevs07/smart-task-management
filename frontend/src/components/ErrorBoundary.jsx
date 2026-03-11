import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) { 
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex-center bg-canvas p-6">
                    <div className="glass-heavy p-10 rounded-[2rem] max-w-lg w-full text-center border-red-500/20 shadow-premium">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex-center mx-auto mb-8">
                            <AlertTriangle className="text-red-500" size={40} />
                        </div>

                        <h1 className="text-3xl mb-4">Something went wrong</h1>
                        <p className="text-secondary mb-10 leading-relaxed">
                            An unexpected error occurred in the application. We've been notified and are looking into it.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="btn btn-primary"
                            >
                                <RotateCcw size={18} />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="btn btn-secondary"
                            >
                                <Home size={18} />
                                Back to Home
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 p-4 bg-black/20 rounded-xl text-left overflow-auto max-h-40">
                                <p className="text-xs font-mono text-red-400">{this.state.error?.toString()}</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
