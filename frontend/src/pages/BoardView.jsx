import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, MoreHorizontal, X, Grip, Calendar, AlertCircle, Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/apiConfig';
import CardDetailsModal from '../components/CardDetailsModal';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const PRIORITY_COLORS = {
    LOW: '#22c55e',
    MEDIUM: '#f59e0b',
    HIGH: '#ef4444',
    CRITICAL: '#dc2626',
};

const PRIORITY_LABELS = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
};

const parseLabel = (label) => {
    if (typeof label === 'string' && label.startsWith('#') && label.includes(':')) {
        const colonIdx = label.indexOf(':');
        return { color: label.substring(0, colonIdx), name: label.substring(colonIdx + 1) };
    }
    return { color: '#0079bf', name: label };
};

const BoardView = () => {
    const { workspaceId, boardId } = useParams();
    const navigate = useNavigate();
    const [board, setBoard] = useState(null);
    const [lists, setLists] = useState([]);
    const [cards, setCards] = useState([]);
    const [members, setMembers] = useState([]);
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);

    // Add list state
    const [showAddList, setShowAddList] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [addingList, setAddingList] = useState(false);
    const addListInputRef = useRef(null);

    // Add card state
    const [creatingCardListId, setCreatingCardListId] = useState(null);

    // List menu state
    const [activeListMenu, setActiveListMenu] = useState(null);
    const [renamingListId, setRenamingListId] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    // Card Details Modal
    const [selectedCardId, setSelectedCardId] = useState(null);

    // Board rename state
    const [isRenamingBoard, setIsRenamingBoard] = useState(false);
    const [isSavingBoardName, setIsSavingBoardName] = useState(false);
    const [boardDraftName, setBoardDraftName] = useState('');
    const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
    const [updatingBackground, setUpdatingBackground] = useState(false);

    const DEFAULT_BACKGROUNDS = [
        {
            url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
            thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=200&q=80",
            name: "Mountains"
        },
        {
            url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
            thumbnail: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=200&q=80",
            name: "Forest"
        },
        {
            url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
            thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=200&q=80",
            name: "Coast"
        }
    ];

    const { user } = useAuth();

    const currentUserRole = (members.find(m => String(m.userId) === String(user?.id))?.role || '').toUpperCase();
    const currentBoardRole = (board?.members?.find(m => String(m.userId) === String(user?.id))?.role || '').toUpperCase();

    const isWorkspaceOwner = currentUserRole === 'OWNER';
    const isWorkspaceAdmin = currentUserRole === 'ADMIN';
    const isWorkspaceMember = currentUserRole === 'MEMBER';
    const isBoardAdmin = currentBoardRole === 'ADMIN';
    const isBoardMember = currentBoardRole === 'MEMBER';

    const canBoardAdmin = isWorkspaceOwner || isWorkspaceAdmin || isBoardAdmin;
    const canBoardMember = isWorkspaceOwner || isWorkspaceAdmin || (isWorkspaceMember && (isBoardMember || isBoardAdmin));
    const canMoveCards = canBoardMember;
    const canCreateList = canBoardAdmin;
    const canRenameList = canBoardMember;
    const canDeleteList = canBoardAdmin;
    const canCreateTopLevelCard = canBoardAdmin;
    const canDeleteCard = canBoardAdmin;

    useEffect(() => {
        fetchData();
    }, [boardId, workspaceId]);

    useEffect(() => {
        if (showAddList && addListInputRef.current) {
            addListInputRef.current.focus();
        }
    }, [showAddList]);

    // Removed inline focus logic

    const fetchData = async () => {
        try {
            const [boardRes, listsRes, cardsRes, membersRes, workspaceRes] = await Promise.all([
                api.get(API_ENDPOINTS.BOARDS.GET_BY_ID(boardId)),
                api.get(API_ENDPOINTS.BOARDS.LISTS(boardId)),
                api.get(API_ENDPOINTS.CARDS.BY_WORKSPACE(workspaceId)),
                api.get(API_ENDPOINTS.WORKSPACES.MEMBERS(workspaceId)),
                api.get(API_ENDPOINTS.WORKSPACES.GET_BY_ID(workspaceId)),
            ]);
            setBoard(boardRes.data);
            setLists((listsRes.data || []).sort((a, b) => a.position - b.position));
            setCards(cardsRes.data || []);
            setMembers(membersRes.data || []);
            setWorkspace(workspaceRes.data);
        } catch (error) {
            toast.error('Failed to load board.');
            navigate(`/workspace/${workspaceId}`);
        } finally {
            setLoading(false);
        }
    };

    const getCardsForList = (listId) => {
        return cards.filter(card => card.boardListId === listId);
    };

    const getMemberName = (userId) => {
        const member = members.find(m => m.userId === userId);
        return member?.name || 'Unassigned';
    };

    const getMemberInitial = (userId) => {
        const name = getMemberName(userId);
        return name.charAt(0).toUpperCase();
    };

    // --- List Actions ---
    const handleAddList = async () => {
        if (!canCreateList) return;
        if (!newListName.trim()) return;
        setAddingList(true);
        try {
            await api.post(API_ENDPOINTS.BOARDS.LISTS(boardId), { name: newListName.trim(), position: lists.length });
            setNewListName('');
            setShowAddList(false);
            await fetchData();
            toast.success('List created!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create list.');
        } finally {
            setAddingList(false);
        }
    };

    const handleRenameList = async (listId) => {
        if (!canRenameList) return;
        if (!renameValue.trim()) return;
        try {
            await api.put(API_ENDPOINTS.BOARDS.LIST_BY_ID(boardId, listId), { name: renameValue.trim() });
            setRenamingListId(null);
            setRenameValue('');
            await fetchData();
            toast.success('List renamed!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to rename list.');
        }
    };

    const handleDeleteList = async (listId) => {
        if (!canDeleteList) return;
        try {
            await api.delete(API_ENDPOINTS.BOARDS.LIST_BY_ID(boardId, listId));
            setActiveListMenu(null);
            await fetchData();
            toast.success('List deleted!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete list.');
        }
    };

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId, type } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        if (type === 'list') {
            if (!canBoardMember) return;
            const newLists = Array.from(lists);
            const [movedList] = newLists.splice(source.index, 1);
            newLists.splice(destination.index, 0, movedList);

            // Update local state immediately for a responsive UI
            const updatedLists = newLists.map((list, index) => ({ ...list, position: index }));
            setLists(updatedLists);

            try {
                const listIds = updatedLists.map(l => l.id);
                await api.put(API_ENDPOINTS.BOARDS.LISTS_REORDER(boardId), { listIds });
            } catch (err) {
                toast.error('Failed to save list order.');
                // Revert on error
                fetchData();
            }
            return;
        }

        if (type === 'card') {
            if (!canMoveCards) return;
            const sourceListId = Number(source.droppableId.split('-')[1]);
            const destListId = Number(destination.droppableId.split('-')[1]);
            const cardId = Number(draggableId.split('-')[1]);

            // Create a copy of the cards state
            let newCards = Array.from(cards);

            const cardIndex = newCards.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;
            const movedCard = newCards[cardIndex];

            // Reorder within the same list
            if (sourceListId === destListId) {
                const listCards = newCards.filter(c => c.boardListId === sourceListId).sort((a, b) => a.position - b.position);
                const sourceCardIndexInList = listCards.findIndex(c => c.id === cardId);
                listCards.splice(sourceCardIndexInList, 1);
                listCards.splice(destination.index, 0, movedCard);

                // Update position values for the affected list cards
                listCards.forEach((c, idx) => {
                    const idxInNewCards = newCards.findIndex(nc => nc.id === c.id);
                    if (idxInNewCards !== -1) {
                        newCards[idxInNewCards] = { ...newCards[idxInNewCards], position: idx };
                    }
                });

                setCards(newCards);
                // The new position is given by the destination.index
                try {
                    await api.put(API_ENDPOINTS.CARDS.MOVE(cardId), { boardListId: destListId, position: destination.index });
                } catch (err) {
                    toast.error('Failed to save card position.');
                    fetchData();
                }
            } else {
                // Moving between lists
                const sourceListCards = newCards.filter(c => c.boardListId === sourceListId).sort((a, b) => a.position - b.position);
                const destListCards = newCards.filter(c => c.boardListId === destListId).sort((a, b) => a.position - b.position);

                movedCard.boardListId = destListId;

                const sourceCardIndexInList = sourceListCards.findIndex(c => c.id === cardId);
                sourceListCards.splice(sourceCardIndexInList, 1);

                destListCards.splice(destination.index, 0, movedCard);

                // Update properties in the main array
                const updatedCards = newCards.map(c => {
                    if (c.id === cardId) {
                        return { ...c, boardListId: destListId, position: destination.index };
                    }
                    if (c.boardListId === sourceListId) {
                        const newPos = sourceListCards.findIndex(sc => sc.id === c.id);
                        return { ...c, position: newPos !== -1 ? newPos : c.position };
                    }
                    if (c.boardListId === destListId && c.id !== cardId) {
                        const newPos = destListCards.findIndex(dc => dc.id === c.id);
                        return { ...c, position: newPos !== -1 ? newPos : c.position };
                    }
                    return c;
                });

                setCards(updatedCards);

                try {
                    await api.put(API_ENDPOINTS.CARDS.MOVE(cardId), { boardListId: destListId, position: destination.index });
                } catch (err) {
                    toast.error('Failed to move card.');
                    fetchData();
                }
            }
        }
    };

    // --- Card Actions ---

    const handleDeleteCard = async (cardId) => {
        if (!canDeleteCard) return;
        try {
            await api.delete(API_ENDPOINTS.CARDS.DELETE(cardId));
            await fetchData();
            toast.success('Card deleted!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete card.');
        }
    };

    const canRenameBoard = canBoardAdmin;
    const canChangeBoardBackground = canBoardAdmin;

    const startBoardRename = () => {
        if (!canRenameBoard || !board?.name) return;
        setBoardDraftName(board.name);
        setIsRenamingBoard(true);
    };

    const cancelBoardRename = () => {
        setBoardDraftName(board?.name || '');
        setIsRenamingBoard(false);
    };

    const handleBoardRename = async () => {
        const normalizedName = boardDraftName.trim();
        if (normalizedName.length < 2 || normalizedName.length > 80) {
            toast.error('Board name must be between 2 and 80 characters.');
            return;
        }
        if (normalizedName === board?.name) {
            setIsRenamingBoard(false);
            return;
        }
        setIsSavingBoardName(true);
        try {
            const response = await api.put(API_ENDPOINTS.BOARDS.UPDATE(boardId), {
                name: normalizedName,
                description: board?.description ?? '',
            });
            if (response.data) {
                setBoard(response.data);
            } else {
                setBoard(prev => prev ? { ...prev, name: normalizedName } : prev);
            }
            toast.success('Board name updated.');
            setIsRenamingBoard(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update board name.');
        } finally {
            setIsSavingBoardName(false);
        }
    };

    const handleUpdateBackground = async (url) => {
        if (!canChangeBoardBackground) {
            toast.error('Only Owner/Admin can change board background.');
            setShowBackgroundPicker(false);
            return;
        }
        setUpdatingBackground(true);
        try {
            const response = await api.put(API_ENDPOINTS.BOARDS.UPDATE(boardId), {
                name: board.name,
                description: board.description ?? '',
                background: url
            });
            setBoard(response.data);
            toast.success('Background updated.');
            setShowBackgroundPicker(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update background.');
        } finally {
            setUpdatingBackground(false);
        }
    };

    const formatDueDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const isDueSoon = (dateStr) => {
        if (!dateStr) return false;
        const due = new Date(dateStr);
        const now = new Date();
        const diffDays = (due - now) / (1000 * 60 * 60 * 24);
        return diffDays <= 2 && diffDays >= 0;
    };

    const isOverdue = (dateStr) => {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <p className="text-secondary">Loading board...</p>
            </div>
        );
    }

    if (!board) return null;

    const boardStyles = board?.background ? {
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundImage: `url(${board.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        position: 'relative'
    } : { height: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="dashboard-main" style={{ padding: 0 }}>
                <div style={boardStyles}>
                    {board?.background && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.45)', // Darker overlay for better visibility
                            zIndex: 0,
                            pointerEvents: 'none'
                        }} />
                    )}
                    {/* Header */}
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid var(--border-glass)',
                        background: board?.background ? 'rgba(var(--bg-primary-rgb), 0.85)' : 'var(--bg-primary)', // Higher opacity
                        backdropFilter: board?.background ? 'blur(16px)' : 'none', // Stronger blur
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 10,
                    }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    {/* Breadcrumb */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <span style={{ cursor: 'pointer', color: 'var(--accent-secondary)' }} onClick={() => navigate('/dashboard')}>Dashboard</span>
                        <ChevronRight size={12} />
                        <span style={{ cursor: 'pointer', color: 'var(--accent-secondary)' }} onClick={() => navigate(`/workspace/${workspaceId}/members`, { state: { targetTab: 'boards' } })}>{workspace?.name || 'Workspace'}</span>
                        <ChevronRight size={12} />
                        {!isRenamingBoard ? (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={startBoardRename}
                                disabled={!canRenameBoard}
                                title={canRenameBoard ? 'Click to rename board' : 'Only Owner/Admin can rename board'}
                                style={{
                                    padding: '0.2rem 0.55rem',
                                    fontSize: '0.82rem',
                                    borderRadius: 999,
                                    color: 'var(--accent-secondary)',
                                    borderColor: 'rgba(6, 182, 212, 0.4)',
                                    background: 'rgba(6, 182, 212, 0.08)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <span>{board.name}</span>
                            </button>
                        ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <input
                                    type="text"
                                    className="input"
                                    value={boardDraftName}
                                    onChange={(e) => setBoardDraftName(e.target.value)}
                                    maxLength={80}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (!isSavingBoardName) handleBoardRename();
                                        }
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            if (!isSavingBoardName) cancelBoardRename();
                                        }
                                    }}
                                    style={{ width: 280, paddingTop: '0.45rem', paddingBottom: '0.45rem', fontSize: '0.82rem' }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ padding: '0.35rem 0.55rem' }}
                                    onClick={handleBoardRename}
                                    disabled={isSavingBoardName}
                                >
                                    <Check size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.35rem 0.55rem' }}
                                    onClick={cancelBoardRename}
                                    disabled={isSavingBoardName}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Add List Controls and Background Picker */}
                    <div className="flex-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        {canChangeBoardBackground && (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
                                    title="Change background"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.5rem',
                                        borderRadius: '10px',
                                        fontSize: '0.88rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderColor: 'var(--border-glass)'
                                    }}
                                >
                                    🎨
                                </button>
                                <AnimatePresence>
                                    {showBackgroundPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: '0.75rem',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-glass)',
                                                borderRadius: '12px',
                                                padding: '0.75rem',
                                                zIndex: 100,
                                                minWidth: '220px',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                            }}
                                        >
                                            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600 }}>Change Background</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                                {DEFAULT_BACKGROUNDS.map((bg) => (
                                                    <div
                                                        key={bg.name}
                                                        onClick={() => handleUpdateBackground(bg.url)}
                                                        style={{
                                                            position: 'relative',
                                                            aspectRatio: '16/10',
                                                            borderRadius: '6px',
                                                            overflow: 'hidden',
                                                            cursor: updatingBackground ? 'wait' : 'pointer',
                                                            border: board.background === bg.url ? '2px solid var(--accent-secondary)' : '1px solid var(--border-glass)',
                                                            opacity: updatingBackground ? 0.7 : 1,
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title={bg.name}
                                                    >
                                                        <img
                                                            src={bg.thumbnail}
                                                            alt={bg.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    </div>
                                                ))}
                                                <div
                                                    onClick={() => handleUpdateBackground(null)}
                                                    style={{
                                                        position: 'relative',
                                                        aspectRatio: '16/10',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: 'var(--bg-tertiary)',
                                                        fontSize: '0.7rem',
                                                        cursor: updatingBackground ? 'wait' : 'pointer',
                                                        border: !board.background ? '2px solid var(--accent-secondary)' : '1px solid var(--border-glass)',
                                                        opacity: updatingBackground ? 0.7 : 1,
                                                    }}
                                                >
                                                    None
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {canCreateList && (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                {showAddList ? (
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-glass)',
                                        padding: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: 'var(--shadow-premium)'
                                    }}>
                                        <input
                                            ref={addListInputRef}
                                            className="input"
                                            placeholder="Enter list name..."
                                            value={newListName}
                                            onChange={e => setNewListName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleAddList();
                                                if (e.key === 'Escape') { setShowAddList(false); setNewListName(''); }
                                            }}
                                            style={{ width: '200px', fontSize: '0.88rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleAddList}
                                            disabled={addingList || !newListName.trim()}
                                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderRadius: '8px' }}
                                        >
                                            {addingList ? 'Adding...' : 'Add'}
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => { setShowAddList(false); setNewListName(''); }}
                                            style={{ fontSize: '0.78rem', padding: '0.4rem', borderRadius: '8px' }}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowAddList(true)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '10px',
                                            fontSize: '0.88rem',
                                        }}
                                    >
                                        <Plus size={16} /> Add List
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="board" type="list" direction="horizontal">
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            style={{
                                flex: 1,
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                padding: '1.25rem',
                                paddingBottom: '2.5rem',
                                display: 'flex',
                                gap: '1rem',
                                alignItems: 'flex-start',
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            {/* Columns */}
                            {lists.map((list, index) => {
                                const listCards = getCardsForList(list.id).sort((a, b) => a.position - b.position);
                                return (
                                    <Draggable key={list.id} draggableId={`list-${list.id}`} index={index} isDragDisabled={!canBoardMember}>
                                        {(providedList) => (
                                            <div
                                                ref={providedList.innerRef}
                                                {...providedList.draggableProps}
                                                style={{
                                                    minWidth: '290px',
                                                    maxWidth: '290px',
                                                    background: board?.background ? 'rgba(var(--bg-card-rgb), 0.95)' : 'var(--bg-card)', // Much higher opacity for readability
                                                    backdropFilter: board?.background ? 'blur(20px)' : 'none', // Stronger blur
                                                    borderRadius: '16px',
                                                    border: '1px solid var(--border-glass)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    maxHeight: 'calc(100vh - 160px)',
                                                    flexShrink: 0,
                                                    boxShadow: board?.background ? '0 12px 40px rgba(0, 0, 0, 0.3)' : 'none', // Stronger shadow
                                                    ...providedList.draggableProps.style,
                                                }}
                                            >
                                                {/* Column Header */}
                                                <div
                                                    {...providedList.dragHandleProps}
                                                    style={{
                                                        padding: '0.85rem 1rem 0.6rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        flexShrink: 0,
                                                        cursor: canBoardMember ? 'grab' : 'default',
                                                    }}
                                                >
                                                    {renamingListId === list.id ? (
                                                        <form onSubmit={(e) => { e.preventDefault(); handleRenameList(list.id); }} style={{ flex: 1, display: 'flex', gap: '0.4rem' }}>
                                                            <input
                                                                className="input"
                                                                value={renameValue}
                                                                onChange={e => setRenameValue(e.target.value)}
                                                                autoFocus
                                                                style={{ fontSize: '0.9rem', padding: '0.3rem 0.5rem' }}
                                                                onBlur={() => { setRenamingListId(null); setRenameValue(''); }}
                                                                onKeyDown={e => { if (e.key === 'Escape') { setRenamingListId(null); setRenameValue(''); } }}
                                                            />
                                                        </form>
                                                    ) : (
                                                        <h3 style={{
                                                            fontSize: '0.95rem',
                                                            fontWeight: 700,
                                                            color: 'var(--text-primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                        }}>
                                                            {list.name}
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                background: 'var(--bg-tertiary)',
                                                                color: 'var(--text-muted)',
                                                                padding: '0.1rem 0.45rem',
                                                                borderRadius: '8px',
                                                                fontWeight: 500,
                                                            }}>
                                                                {listCards.length}
                                                            </span>
                                                        </h3>
                                                    )}
                                                    <div style={{ position: 'relative' }}>
                                                        {(canRenameList || canDeleteList) && (
                                                            <>
                                                                <button
                                                                    onClick={() => setActiveListMenu(activeListMenu === list.id ? null : list.id)}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: 'var(--text-muted)',
                                                                        cursor: 'pointer',
                                                                        padding: '0.2rem',
                                                                        borderRadius: '6px',
                                                                        display: 'flex',
                                                                    }}
                                                                >
                                                                    <MoreHorizontal size={16} />
                                                                </button>
                                                                <AnimatePresence>
                                                                    {activeListMenu === list.id && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                                            animate={{ opacity: 1, scale: 1 }}
                                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                                            style={{
                                                                                position: 'absolute',
                                                                                right: 0,
                                                                                top: '100%',
                                                                                background: 'var(--bg-secondary)',
                                                                                border: '1px solid var(--border-glass)',
                                                                                borderRadius: '10px',
                                                                                padding: '0.3rem',
                                                                                zIndex: 50,
                                                                                minWidth: '140px',
                                                                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                                                            }}
                                                                        >
                                                                            {canRenameList && (
                                                                                <button
                                                                                onClick={() => {
                                                                                    setRenamingListId(list.id);
                                                                                    setRenameValue(list.name);
                                                                                    setActiveListMenu(null);
                                                                                }}
                                                                                style={{
                                                                                    display: 'block',
                                                                                    width: '100%',
                                                                                    textAlign: 'left',
                                                                                    padding: '0.5rem 0.7rem',
                                                                                    background: 'none',
                                                                                    border: 'none',
                                                                                    color: 'var(--text-primary)',
                                                                                    cursor: 'pointer',
                                                                                    borderRadius: '8px',
                                                                                    fontSize: '0.82rem',
                                                                                }}
                                                                                onMouseEnter={e => e.target.style.background = 'var(--bg-tertiary)'}
                                                                                onMouseLeave={e => e.target.style.background = 'none'}
                                                                            >
                                                                                ✏️ Rename
                                                                            </button>

                                                                            )}
                                                                            {canDeleteList && (
                                                                                <button
                                                                                onClick={() => handleDeleteList(list.id)}
                                                                                style={{
                                                                                    display: 'block',
                                                                                    width: '100%',
                                                                                    textAlign: 'left',
                                                                                    padding: '0.5rem 0.7rem',
                                                                                    background: 'none',
                                                                                    border: 'none',
                                                                                    color: '#ef4444',
                                                                                    cursor: 'pointer',
                                                                                    borderRadius: '8px',
                                                                                    fontSize: '0.82rem',
                                                                                }}
                                                                                onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,0.1)'}
                                                                                onMouseLeave={e => e.target.style.background = 'none'}
                                                                            >
                                                                                🗑️ Delete
                                                                            </button>

                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Cards */}
                                                <Droppable droppableId={`list-${list.id}`} type="card">
                                                    {(providedCards) => (
                                                        <div
                                                            ref={providedCards.innerRef}
                                                            {...providedCards.droppableProps}
                                                            style={{
                                                                flex: 1,
                                                                overflowY: 'auto',
                                                                padding: '0 0.6rem 0.6rem',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '0.5rem',
                                                            }}
                                                        >
                                                            <AnimatePresence>
                                                                {listCards.map((card, cardIndex) => (
                                                                    <Draggable key={card.id} draggableId={`card-${card.id}`} index={cardIndex} isDragDisabled={!canMoveCards}>
                                                                        {(providedCard, snapshot) => (
                                                                            <div
                                                                                ref={providedCard.innerRef}
                                                                                {...providedCard.draggableProps}
                                                                                {...providedCard.dragHandleProps}
                                                                                onClick={() => setSelectedCardId(card.id)}
                                                                                style={{
                                                                                    background: 'var(--bg-secondary)',
                                                                                    borderRadius: '12px',
                                                                                    padding: '0.75rem 0.85rem',
                                                                                    border: '1px solid var(--border-glass)',
                                                                                    cursor: canMoveCards ? 'grab' : 'pointer',
                                                                                    position: 'relative',
                                                                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                                                                    boxShadow: snapshot.isDragging ? '0 10px 25px rgba(0,0,0,0.2)' : 'none',
                                                                                    zIndex: snapshot.isDragging ? 1000 : 1,
                                                                                    ...providedCard.draggableProps.style,
                                                                                }}
                                                                            >
                                                                                {/* Priority stripe */}
                                                                                {card.priority && (
                                                                                    <div style={{
                                                                                        position: 'absolute',
                                                                                        top: '8px',
                                                                                        left: '0',
                                                                                        width: '3px',
                                                                                        height: '20px',
                                                                                        borderRadius: '0 4px 4px 0',
                                                                                        background: PRIORITY_COLORS[card.priority] || '#6b7280',
                                                                                    }} />
                                                                                )}
                                                                                {/* Labels */}
                                                                                {card.labels && card.labels.length > 0 && (
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        flexWrap: 'wrap',
                                                                                        gap: '4px',
                                                                                        marginBottom: '0.45rem',
                                                                                    }}>
                                                                                        {card.labels.map((label, idx) => {
                                                                                            const parsed = parseLabel(label);
                                                                                            return (
                                                                                                <span key={idx} style={{
                                                                                                    background: parsed.color,
                                                                                                    borderRadius: '4px',
                                                                                                    height: '8px',
                                                                                                    minWidth: '40px',
                                                                                                    display: 'inline-block',
                                                                                                }} title={parsed.name} />
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                                {/* Card Title */}
                                                                                <p style={{
                                                                                    fontSize: '0.88rem',
                                                                                    fontWeight: 600,
                                                                                    color: 'var(--text-primary)',
                                                                                    marginBottom: card.assignedTo || card.dueDate || card.priority ? '0.55rem' : 0,
                                                                                    lineHeight: 1.4,
                                                                                }}>
                                                                                    {card.title}
                                                                                </p>

                                                                                {/* Card Meta */}
                                                                                {(card.assignedTo || card.dueDate || card.priority) && (
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '0.5rem',
                                                                                        flexWrap: 'wrap',
                                                                                    }}>
                                                                                        {/* Assignee */}
                                                                                        {card.assignedTo && (
                                                                                            <div style={{
                                                                                                display: 'flex',
                                                                                                alignItems: 'center',
                                                                                                gap: '0.3rem',
                                                                                            }}>
                                                                                                <div style={{
                                                                                                    width: '22px',
                                                                                                    height: '22px',
                                                                                                    borderRadius: '50%',
                                                                                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                                                                    display: 'flex',
                                                                                                    alignItems: 'center',
                                                                                                    justifyContent: 'center',
                                                                                                    fontSize: '0.65rem',
                                                                                                    color: '#fff',
                                                                                                    fontWeight: 700,
                                                                                                }}>
                                                                                                    {getMemberInitial(card.assignedTo)}
                                                                                                </div>
                                                                                                <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                                                                                    {getMemberName(card.assignedTo)}
                                                                                                </span>
                                                                                            </div>
                                                                                        )}

                                                                                        <div style={{ flex: 1 }} />

                                                                                        {/* Priority badge */}
                                                                                        {card.priority && (
                                                                                            <span style={{
                                                                                                fontSize: '0.65rem',
                                                                                                fontWeight: 600,
                                                                                                padding: '0.15rem 0.4rem',
                                                                                                borderRadius: '6px',
                                                                                                background: `${PRIORITY_COLORS[card.priority]}22`,
                                                                                                color: PRIORITY_COLORS[card.priority],
                                                                                            }}>
                                                                                                {PRIORITY_LABELS[card.priority]}
                                                                                            </span>
                                                                                        )}

                                                                                        {/* Due date */}
                                                                                        {card.dueDate && (
                                                                                            <span style={{
                                                                                                fontSize: '0.68rem',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center',
                                                                                                gap: '0.2rem',
                                                                                                color: isOverdue(card.dueDate) ? '#ef4444' : isDueSoon(card.dueDate) ? '#f59e0b' : 'var(--text-muted)',
                                                                                                fontWeight: 500,
                                                                                            }}>
                                                                                                <Calendar size={11} />
                                                                                                {formatDueDate(card.dueDate)}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}

                                                                                {/* Delete button (top-right) */}
                                                                                {canDeleteCard && (
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}
                                                                                        style={{
                                                                                            position: 'absolute',
                                                                                            top: '6px',
                                                                                            right: '6px',
                                                                                            background: 'none',
                                                                                            border: 'none',
                                                                                            color: 'var(--text-muted)',
                                                                                            cursor: 'pointer',
                                                                                            padding: '2px',
                                                                                            borderRadius: '4px',
                                                                                            opacity: 0,
                                                                                            transition: 'opacity 0.2s',
                                                                                        }}
                                                                                        onMouseEnter={e => e.target.style.opacity = 1}
                                                                                        className="card-delete-btn"
                                                                                    >
                                                                                        <X size={13} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                ))}
                                                            </AnimatePresence>
                                                            {providedCards.placeholder}

                                                            {/* Add Card Button */}
                                                            {canCreateTopLevelCard && (
                                                                <button
                                                                    onClick={() => setCreatingCardListId(list.id)}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.35rem',
                                                                        padding: '0.5rem 0.6rem',
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: 'var(--text-muted)',
                                                                        cursor: 'pointer',
                                                                        borderRadius: '10px',
                                                                        fontSize: '0.82rem',
                                                                        width: '100%',
                                                                        transition: 'background 0.2s, color 0.2s',
                                                                    }}
                                                                    onMouseEnter={e => { e.target.style.background = 'var(--bg-tertiary)'; e.target.style.color = 'var(--text-primary)'; }}
                                                                    onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--text-muted)'; }}
                                                                >
                                                                    <Plus size={15} /> Add Card
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                    }
                                                </Droppable>
                                            </div>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {provided.placeholder}
                        </div>
                    )
                    }
                </Droppable >
            </DragDropContext >

            {/* Global CSS for card hover delete button */}
            < style > {`
                .card-delete-btn { opacity: 0 !important; }
                div:hover > .card-delete-btn { opacity: 1 !important; }
            `}</style >

            {/* Card Details Modal */}
            < AnimatePresence >
                {(selectedCardId || creatingCardListId) && (
                    <CardDetailsModal
                        isNewCard={!!creatingCardListId}
                        boardListId={creatingCardListId}
                        workspaceId={workspaceId}
                        cardId={selectedCardId}
                        members={members}
                        workspaceRole={currentUserRole}
                        boardRole={currentBoardRole}
                        onClose={() => {
                            setSelectedCardId(null);
                            setCreatingCardListId(null);
                        }}
                        onUpdated={() => fetchData()}
                    />
                )}
            </AnimatePresence >
                </div>
            </div>
        </div>
    );
};

export default BoardView;
