import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Layers, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/apiConfig';

const WorkspaceBoard = () => {
    const { workspaceId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [workspace, setWorkspace] = useState(null);
    const [boards, setBoards] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = api.getAuth ? { user: api.getCurrentUser() } : { user: JSON.parse(localStorage.getItem('user')) }; // Fallback since I don't see useAuth here

    useEffect(() => {
        const fetchWorkspaceData = async () => {
            try {
                const [workspaceRes, boardsRes, membersRes] = await Promise.all([
                    api.get(API_ENDPOINTS.WORKSPACES.GET_BY_ID(workspaceId)),
                    api.get(API_ENDPOINTS.BOARDS.BY_WORKSPACE(workspaceId)),
                    api.get(API_ENDPOINTS.WORKSPACES.MEMBERS(workspaceId)),
                ]);
                setWorkspace(workspaceRes.data);
                setBoards(boardsRes.data || []);
                setMembers(membersRes.data || []);
            } catch (error) {
                toast.error('Failed to load workspace.');
                navigate('/dashboard');
            } finally {
                setLoading(false);
            }
        };

        if (workspaceId) {
            fetchWorkspaceData();
        }
    }, [workspaceId, navigate]);

    useEffect(() => {
        if (location.state?.createdBoardId) {
            toast.success('Board created and saved.');
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.state, location.pathname, navigate]);

    if (loading) {
        return (
            <div className="container py-12">
                <p className="text-secondary">Loading workspace...</p>
            </div>
        );
    }

    if (!workspace) return null;

    return (
        <div className="container py-12 animate-fade-in">
            <div className="flex-between mobile-stack gap-4 mb-8">
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                    <ArrowLeft size={16} /> Back
                </button>
                {(members.find(m => String(m.userId) === String(user?.id))?.role === "OWNER" ||
                    members.find(m => String(m.userId) === String(user?.id))?.role === "ADMIN") && (
                        <button className="btn btn-primary" onClick={() => navigate(`/workspace/${workspaceId}/members`)}>
                            <Plus size={16} /> Create Board
                        </button>
                    )}
            </div>

            <div className="glass-heavy rounded-3xl p-8 border-white/10 shadow-premium">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(79,70,229,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Layers size={20} style={{ color: '#818cf8' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', marginBottom: 2 }}>{workspace.name}</h1>
                        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
                            Workspace ID: {workspace.id}
                        </p>
                    </div>
                </div>

                <p className="text-secondary" style={{ marginBottom: '1rem' }}>
                    {workspace.description || 'No description available yet.'}
                </p>

                <div className="glass rounded-2xl p-5 border-white/10">
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.45rem' }}>Boards</h3>
                    {boards.length === 0 ? (
                        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
                            No boards yet. Use Create Board to add your first board.
                        </p>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.6rem' }}>
                            {boards.map((board) => (
                                <div
                                    key={board.id}
                                    style={{
                                        border: '1px solid var(--border-glass)',
                                        borderRadius: '12px',
                                        padding: '0.75rem 0.9rem',
                                        background: 'rgba(255,255,255,0.02)',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ fontWeight: 700, marginBottom: 2 }}>{board.name}</p>
                                            <p className="text-secondary" style={{ fontSize: '0.78rem' }}>
                                                {board.description?.trim() || 'No description'}
                                            </p>
                                        </div>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => navigate(`/workspace/${workspaceId}/board/${board.id}`)}
                                        >
                                            <Users size={14} /> Open
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceBoard;
