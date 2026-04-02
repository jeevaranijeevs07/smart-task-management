import React, { useState, useEffect, useRef } from 'react';
import {
    X, Users, AlignLeft, Calendar, Flag, MessageSquare,
    Trash2, Check, Loader, Tag, CheckSquare, Paperclip, Plus, Square, Save
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/apiConfig';
import { useAuth } from '../context/AuthContext';
import TrashCanIcon from './icons/TrashCanIcon';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './CardDetailsModal.css';

const PRIORITY_OPTIONS = [
    { value: '', label: 'None', color: '#6b7280' },
    { value: 'LOW', label: 'Low', color: '#61bd4f' },
    { value: 'MEDIUM', label: 'Medium', color: '#f2d600' },
    { value: 'HIGH', label: 'High', color: '#ff9f1a' },
    { value: 'CRITICAL', label: 'Critical', color: '#eb5a46' },
];

const LABEL_COLORS = [
    { color: '#61bd4f', name: 'Green' },
    { color: '#f2d600', name: 'Yellow' },
    { color: '#ff9f1a', name: 'Orange' },
    { color: '#eb5a46', name: 'Red' },
    { color: '#c377e0', name: 'Purple' },
    { color: '#0079bf', name: 'Blue' },
    { color: '#00c2e0', name: 'Sky' },
    { color: '#51e898', name: 'Lime' },
    { color: '#ff78cb', name: 'Pink' },
    { color: '#344563', name: 'Dark' },
];

const parseLabel = (label) => {
    if (typeof label === 'string' && label.startsWith('#') && label.includes(':')) {
        const colonIdx = label.indexOf(':');
        return { color: label.substring(0, colonIdx), name: label.substring(colonIdx + 1) };
    }
    return { color: '#0079bf', name: label };
};

const encodeLabelString = (color, name) => `${color}:${name}`;
const COMMENT_MENTION_TRIGGER_REGEX = /@(\w*)$/;
const COMMENT_MENTION_TOKEN_REGEX = /@\[(.*?)\]\((\d+)\)/;

const CardDetailsModal = ({
    cardId,
    isNewCard,
    boardListId,
    workspaceId,
    members,
    onClose,
    onUpdated,
    workspaceRole,
    boardRole,
}) => { // NOSONAR
    const [card, setCard] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const normalizedWorkspaceRole = (workspaceRole || '').toUpperCase();
    const normalizedBoardRole = (boardRole || '').toUpperCase();

    const isWorkspaceOwner = normalizedWorkspaceRole === 'OWNER';
    const isWorkspaceAdmin = normalizedWorkspaceRole === 'ADMIN';
    const isWorkspaceMember = normalizedWorkspaceRole === 'MEMBER';
    const isBoardAdmin = normalizedBoardRole === 'ADMIN';
    const isBoardMember = normalizedBoardRole === 'MEMBER';

    const canBoardView = Boolean(normalizedWorkspaceRole);
    const canWorkspaceNonViewer = isWorkspaceOwner || isWorkspaceAdmin || isWorkspaceMember;
    const canBoardAdmin = isWorkspaceOwner || isWorkspaceAdmin || isBoardAdmin;
    const canBoardMember = isWorkspaceOwner || isWorkspaceAdmin || (isWorkspaceMember && (isBoardMember || isBoardAdmin));
    const canEditCardDetails = isNewCard ? canBoardAdmin : canBoardMember;
    const canDeleteThisCard = canBoardAdmin;
    const canCreateChecklist = canBoardMember;
    const canManageChecklistItems = canBoardMember;

    const isCurrentUserAssignee = String(card?.assignedTo ?? '') === String(user?.id ?? '');
    const isCurrentUserCardMember = (card?.members || []).some((m) => String(m.userId) === String(user?.id));
    const canCardParticipantMutate = isWorkspaceOwner
        || isWorkspaceAdmin
        || (isWorkspaceMember && (isCurrentUserAssignee || isCurrentUserCardMember));

    const canUpdateChecklistItemState = canCardParticipantMutate;
    const canComment = canCardParticipantMutate;
    const canAddAttachment = canWorkspaceNonViewer && canBoardView;

    const canToggleAssignmentFor = (targetUserId) => {
        if (!canWorkspaceNonViewer || !canBoardView || !user?.id || !card) return false;
        if (String(targetUserId) === String(user.id)) return true;
        return isWorkspaceOwner || isWorkspaceAdmin;
    };

    // Editable fields (local state, saved on explicit Save)
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [labels, setLabels] = useState([]);
    const [newLabel, setNewLabel] = useState('');
    const [selectedLabelColor, setSelectedLabelColor] = useState(LABEL_COLORS[0].color);
    const [showLabelForm, setShowLabelForm] = useState(false);

    // Dirty tracking
    const [isDirty, setIsDirty] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    // Comment
    const [commentText, setCommentText] = useState('');
    const [addingComment, setAddingComment] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const commentInputRef = useRef(null);

    // Checklist
    const [newChecklistName, setNewChecklistName] = useState('');
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [showAddChecklist, setShowAddChecklist] = useState(false);
    const [newItemTexts, setNewItemTexts] = useState({});
    const [addingItem, setAddingItem] = useState(null);

    // Attachment
    const [attachFileName, setAttachFileName] = useState('');
    const [attachFileUrl, setAttachFileUrl] = useState('');
    const [addingAttachment, setAddingAttachment] = useState(false);
    const [showAddAttachment, setShowAddAttachment] = useState(false);
    const [deletingAttachmentId, setDeletingAttachmentId] = useState(null);

    // Indicators
    const [saving, setSaving] = useState(false);
    const [assigning, setAssigning] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const overlayRef = useRef(null);
    const titleRef = useRef(null);

    useEffect(() => {
        if (isNewCard) {
            setCard({});
            setTitle('');
            setDescription('');
            setPriority('');
            setDueDate('');
            setLabels([]);
            setLoading(false);
            setIsDirty(true);
        } else if (cardId) {
            fetchCard();
        }
    }, [cardId, isNewCard]);

    const fetchCard = async () => {
        setLoading(true);
        try {
            const res = await api.get(API_ENDPOINTS.CARDS.GET_BY_ID(cardId));
            const c = res.data;
            setCard(c);
            setTitle(c.title || '');
            setDescription(c.description || '');
            setPriority(c.priority || '');
            setDueDate(c.dueDate ? c.dueDate.substring(0, 16) : '');
            setLabels(c.labels || []);
            setIsDirty(false);
            setJustSaved(false);
        } catch {
            toast.error('Failed to load card details.');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    // Mark dirty on any field change
    const markDirty = () => { setIsDirty(true); setJustSaved(false); };

    // ── SAVE (explicit button) ──
    const handleSave = async () => {
        if (!isDirty && !isNewCard) return;
        if (!canEditCardDetails) {
            toast.error('You do not have permission to edit this card.');
            return;
        }
        if (isNewCard && !title.trim()) {
            toast.error('Card title is required.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: title.trim() || (card?.title || ''),
                description: description,
                priority: priority || null,
                dueDate: dueDate ? dueDate + ':00' : null,
                labels: labels.filter(label => label?.trim()),
            };
            if (isNewCard) {
                payload.boardListId = boardListId;
                await api.post(API_ENDPOINTS.CARDS.CREATE(workspaceId), payload);
                toast.success('Card created!');
                onUpdated?.();
                onClose();
            } else {
                const res = await api.put(API_ENDPOINTS.CARDS.UPDATE(cardId), payload);
                setCard(res.data);
                setIsDirty(false);
                setJustSaved(true);
                onUpdated?.();
                toast.success('Card saved!');
                setTimeout(() => setJustSaved(false), 2500);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    // ── Assign / Unassign ──
    const handleToggleAssign = async (userId) => {
        if (!canToggleAssignmentFor(userId)) {
            toast.error('You do not have permission to change this assignment.');
            return;
        }
        setAssigning(userId);
        try {
            if (card.assignedTo === userId) {
                await api.delete(API_ENDPOINTS.CARDS.REMOVE_ASSIGN(cardId, userId));
                setCard(prev => ({ ...prev, assignedTo: null }));
            } else {
                await api.post(API_ENDPOINTS.CARDS.ASSIGN(cardId), { userId });
                setCard(prev => ({ ...prev, assignedTo: userId }));
            }
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update assignment.');
        } finally {
            setAssigning(null);
        }
    };

    // ── Labels ──
    const handleAddLabel = () => {
        if (!newLabel.trim()) return;
        const encoded = encodeLabelString(selectedLabelColor, newLabel.trim());
        setLabels(prev => [...prev, encoded]);
        setNewLabel('');
        setShowLabelForm(false);
        markDirty();
    };
    const handleRemoveLabel = (index) => {
        setLabels(prev => prev.filter((_, i) => i !== index));
        markDirty();
    };

    // ── Checklists ──
    const handleAddChecklist = async () => {
        if (!canCreateChecklist) {
            toast.error('You do not have permission to add checklists.');
            return;
        }
        if (!newChecklistName.trim()) return;
        setAddingChecklist(true);
        try {
            await api.post(API_ENDPOINTS.CARDS.CHECKLIST(cardId), { name: newChecklistName.trim() });
            setNewChecklistName('');
            setShowAddChecklist(false);
            await fetchCard();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add checklist.');
        } finally { setAddingChecklist(false); }
    };

    const handleAddChecklistItem = async (checklistId) => {
        if (!canManageChecklistItems) {
            toast.error('You do not have permission to add checklist items.');
            return;
        }
        const text = newItemTexts[checklistId]?.trim();
        if (!text) return;
        setAddingItem(checklistId);
        try {
            await api.post(API_ENDPOINTS.CARDS.CHECKLIST_ITEM(checklistId), { content: text });
            setNewItemTexts(prev => ({ ...prev, [checklistId]: '' }));
            await fetchCard();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to add item.'); }
        finally { setAddingItem(null); }
    };

    const handleToggleChecklistItem = async (itemId, currentChecked) => {
        if (!canUpdateChecklistItemState) {
            toast.error('You do not have permission to update this checklist item.');
            return;
        }
        try {
            await api.put(API_ENDPOINTS.CARDS.CHECKLIST_ITEM_UPDATE(itemId), { isChecked: !currentChecked });
            await fetchCard();
        } catch { toast.error('Failed to update item.'); }
    };

    const handleDeleteChecklistItem = async (itemId) => {
        if (!canManageChecklistItems) {
            toast.error('You do not have permission to delete checklist items.');
            return;
        }
        try {
            await api.delete(API_ENDPOINTS.CARDS.CHECKLIST_ITEM_DELETE(itemId));
            await fetchCard();
        } catch { toast.error('Failed to delete item.'); }
    };

    const handleAddComment = async () => {
        if (!canComment) {
            toast.error('You do not have permission to comment on this card.');
            return;
        }
        const content = extractCommentContent();
        if (!content.trim()) return;
        setAddingComment(true);
        try {
            await api.post(API_ENDPOINTS.CARDS.COMMENT(cardId), { content: content.trim() });
            if (commentInputRef.current) commentInputRef.current.innerHTML = '';
            setCommentText('');
            setShowMentions(false);
            await fetchCard();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to add comment.'); }
        finally { setAddingComment(false); }
    };

    const extractCommentContent = () => {
        if (!commentInputRef.current) return '';
        let content = '';
        const nodes = commentInputRef.current.childNodes;
        nodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                content += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains('cdm-mention-tag')) {
                    const userId = node.dataset.userId;
                    const userName = node.textContent?.replace(/^@/, '');
                    content += `@[${userName}](${userId})`;
                } else {
                    content += node.textContent;
                }
            }
        });
        return content;
    };

    const handleCommentInput = (e) => {
        const value = e.target.innerText;
        setCommentText(value);

        const selection = globalThis.getSelection?.();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || '';
        const mentionMatch = COMMENT_MENTION_TRIGGER_REGEX.exec(textBeforeCursor);

        if (mentionMatch) {
            setMentionQuery(mentionMatch[1].toLowerCase());
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    const handleSelectMention = (member) => {
        const selection = globalThis.getSelection?.();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        const text = textNode.textContent;
        const cursorPosition = range.startOffset;

        const mentionStart = text.lastIndexOf('@', cursorPosition - 1);

        // Remove the "@query" part
        range.setStart(textNode, mentionStart);
        range.setEnd(textNode, cursorPosition);
        range.deleteContents();

        // Create mention tag
        const mentionTag = document.createElement('span');
        mentionTag.className = 'cdm-mention-tag';
        mentionTag.contentEditable = 'false';
        mentionTag.dataset.userId = String(member.userId);
        mentionTag.textContent = `@${member.name}`;

        range.insertNode(mentionTag);

        // Add a space after mention
        const space = document.createTextNode('\u00A0');
        range.setStartAfter(mentionTag);
        range.insertNode(space);
        range.setStartAfter(space);
        range.setEndAfter(space);

        selection.removeAllRanges();
        selection.addRange(range);

        setShowMentions(false);
        setCommentText(commentInputRef.current.innerText);
    };

    const renderCommentWithMentions = (text) => {
        if (!text) return null;
        const parts = text.split(/(@\[.*?\]\(\d+\))/g);
        let offset = 0;
        return parts.map(part => {
            const keyBase = `${offset}-${part}`;
            offset += part.length;
            const mentionMatch = COMMENT_MENTION_TOKEN_REGEX.exec(part);
            if (mentionMatch) {
                return (
                    <span key={`mention-${keyBase}`} className="cdm-mention-highlight">
                        @{mentionMatch[1]}
                    </span>
                );
            }
            return <React.Fragment key={`text-${keyBase}`}>{part}</React.Fragment>;
        });
    };

    // ── Attachments ──
    const handleAddAttachment = async () => {
        if (!canAddAttachment) {
            toast.error('You do not have permission to add attachments.');
            return;
        }
        if (!attachFileName.trim() || !attachFileUrl.trim()) return;
        setAddingAttachment(true);
        try {
            await api.post(API_ENDPOINTS.CARDS.ATTACHMENT(cardId), {
                fileName: attachFileName.trim(),
                fileUrl: attachFileUrl.trim(),
                fileType: attachFileName.split('.').pop() || 'unknown',
            });
            setAttachFileName(''); setAttachFileUrl(''); setShowAddAttachment(false);
            await fetchCard();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to add attachment.'); }
        finally { setAddingAttachment(false); }
    };

    const handleDeleteAttachment = async (attachmentId) => {
        if (!canAddAttachment) {
            toast.error('You do not have permission to delete attachments.');
            return;
        }
        if (!attachmentId) return;
        if (!globalThis.confirm('Delete this attachment?')) return;
        setDeletingAttachmentId(attachmentId);
        try {
            await api.delete(API_ENDPOINTS.CARDS.ATTACHMENT_DELETE(cardId, attachmentId));
            toast.success('Attachment deleted.');
            await fetchCard();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete attachment.');
        } finally {
            setDeletingAttachmentId(null);
        }
    };

    // ── Delete card ──
    const handleDelete = async () => {
        if (!canDeleteThisCard) {
            toast.error('You do not have permission to delete this card.');
            return;
        }
        if (!globalThis.confirm('Delete this card permanently?')) return;
        setDeleting(true);
        try {
            await api.delete(API_ENDPOINTS.CARDS.DELETE(cardId));
            toast.success('Card deleted.');
            onUpdated?.(); onClose();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete card.'); setDeleting(false); }
    };

    // ── Overlay / Escape ──
    const handleOverlayClick = (e) => { if (e.target === overlayRef.current) onClose(); };
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        globalThis.addEventListener('keydown', handler);
        return () => globalThis.removeEventListener('keydown', handler);
    }, [onClose]);

    const getMemberName = (userId) => members.find(m => m.userId === userId)?.name || 'Unknown';
    const getMemberInitial = (userId) => getMemberName(userId).charAt(0).toUpperCase();
    const formatTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

    return (
        <div className="cdm-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <motion.div
                className="cdm-modal"
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ duration: 0.22 }}
            >
                {loading ? (
                    <div className="cdm-loading">
                        <Loader size={20} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} /> Loading card...
                    </div>
                ) : card ? (
                    <>
                        {/* ── Header: Title ── */}
                        <div className="cdm-header">
                            <input
                                ref={titleRef}
                                className="cdm-title-input"
                                value={title}
                                onChange={e => { setTitle(e.target.value); markDirty(); }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); titleRef.current?.blur(); } }}
                                placeholder="Card title..."
                                disabled={!canEditCardDetails}
                            />
                            <button className="cdm-close-btn" onClick={onClose}><X size={18} /></button>
                        </div>

                        <div className="cdm-body">

                            {/* 1. Description */}
                            <div className="cdm-section">
                                <span className="cdm-section-label"><AlignLeft size={13} /> Description</span>
                                <textarea
                                    className="cdm-desc-textarea"
                                    value={description}
                                    onChange={e => { setDescription(e.target.value); markDirty(); }}
                                    placeholder={!canEditCardDetails && !description ? "No description provided." : "Add a more detailed description..."}
                                    disabled={!canEditCardDetails}
                                />
                            </div>

                            {/* 2. Priority & Due Date */}
                            <div className="cdm-row">
                                <div className="cdm-section">
                                    <span className="cdm-section-label"><Flag size={13} /> Priority</span>
                                    <div className="cdm-select-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{
                                            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                                            background: (PRIORITY_OPTIONS.find(o => o.value === priority) || PRIORITY_OPTIONS[0]).color,
                                            transition: 'background 0.2s',
                                        }} />
                                        <select
                                            className="cdm-select"
                                            value={priority}
                                            onChange={e => { setPriority(e.target.value); markDirty(); }}
                                            disabled={!canEditCardDetails}
                                            style={{ color: (PRIORITY_OPTIONS.find(o => o.value === priority) || PRIORITY_OPTIONS[0]).color, fontWeight: 600 }}
                                        >
                                            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ color: o.color, fontWeight: 600 }}>{o.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="cdm-section">
                                    <span className="cdm-section-label"><Calendar size={13} /> Due Date</span>
                                    <DatePicker
                                        selected={dueDate ? new Date(dueDate) : null}
                                        onChange={(date) => {
                                            if (date) {
                                                const pad = (n) => n.toString().padStart(2, '0');
                                                const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                                                setDueDate(formatted);
                                            } else {
                                                setDueDate('');
                                            }
                                            markDirty();
                                        }}
                                        showTimeSelect
                                        timeFormat="h:mm aa"
                                        timeIntervals={15}
                                        timeCaption="Time"
                                        dateFormat="MMM d, yyyy h:mm aa"
                                        placeholderText="Set due date & time..."
                                        className="cdm-date-input"
                                        isClearable={canEditCardDetails}
                                        wrapperClassName="cdm-datepicker-wrapper"
                                        portalId="datepicker-portal"
                                        disabled={!canEditCardDetails}
                                    />
                                </div>
                            </div>

                            {/* 3. Labels */}
                            <div className="cdm-section">
                                <span className="cdm-section-label"><Tag size={13} /> Labels</span>
                                <div className="cdm-labels-wrap">
                                    {labels.map((label, i) => {
                                        const parsed = parseLabel(label);
                                        return (
                                            <span key={i} className="cdm-label-tag" style={{
                                                background: parsed.color,
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '0.25rem 0.6rem',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                minHeight: '28px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                            }}>
                                                {parsed.name}
                                                {canEditCardDetails && <button className="cdm-label-remove" onClick={() => handleRemoveLabel(i)} style={{ color: '#fff' }}><X size={10} /></button>}
                                            </span>
                                        );
                                    })}
                                    {canEditCardDetails && (
                                        !showLabelForm ? (
                                            <button className="cdm-add-btn" onClick={() => setShowLabelForm(true)} style={{ marginTop: labels.length > 0 ? '0.25rem' : 0 }}>
                                                <Plus size={14} /> Add Label
                                            </button>
                                        ) : (
                                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.5rem' }}>
                                                    {LABEL_COLORS.map(lc => (
                                                        <button
                                                            key={lc.color}
                                                            type="button"
                                                            onClick={() => setSelectedLabelColor(lc.color)}
                                                            title={lc.name}
                                                            style={{
                                                                width: 32,
                                                                height: 28,
                                                                borderRadius: '4px',
                                                                background: lc.color,
                                                                border: selectedLabelColor === lc.color ? '2px solid #fff' : '2px solid transparent',
                                                                outline: selectedLabelColor === lc.color ? `2px solid ${lc.color}` : 'none',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s',
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                    <div style={{ width: 6, height: 28, borderRadius: '3px', background: selectedLabelColor, flexShrink: 0 }} />
                                                    <input
                                                        className="cdm-label-input"
                                                        placeholder="Label name..."
                                                        value={newLabel}
                                                        onChange={e => setNewLabel(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel(); } if (e.key === 'Escape') setShowLabelForm(false); }}
                                                        autoFocus
                                                        style={{ flex: 1, width: '100%' }}
                                                    />
                                                    <button className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', borderRadius: '8px' }}
                                                        onClick={handleAddLabel} disabled={!newLabel.trim()}>Add</button>
                                                    <button className="cdm-close-btn" onClick={() => setShowLabelForm(false)}><X size={14} /></button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* 4. Checklist */}
                            {!isNewCard && (
                                <div className="cdm-section">
                                    <span className="cdm-section-label"><CheckSquare size={13} /> Checklist</span>

                                    {card.checklists?.map(cl => {
                                        const total = cl.items?.length || 0;
                                        const done = cl.items?.filter(it => it.isChecked).length || 0;
                                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                                        return (
                                            <div key={cl.id} className="cdm-checklist-block">
                                                <div className="cdm-checklist-header">
                                                    <span className="cdm-checklist-name">{cl.name}</span>
                                                    <span className="cdm-checklist-progress">{done}/{total} ({pct}%)</span>
                                                </div>
                                                <div className="cdm-progress-bar"><div className="cdm-progress-fill" style={{ width: `${pct}%` }} /></div>
                                                {cl.items?.map(item => (
                                                    <div key={item.id} className="cdm-checklist-item">
                                                        <button className="cdm-check-btn" onClick={() => canUpdateChecklistItemState && handleToggleChecklistItem(item.id, item.isChecked)} disabled={!canUpdateChecklistItemState}>
                                                            {item.isChecked ? <Check size={13} /> : <Square size={13} />}
                                                        </button>
                                                        <span className={`cdm-check-text ${item.isChecked ? 'done' : ''}`}>{item.content}</span>
                                                        {canManageChecklistItems && <button className="cdm-check-delete" onClick={() => handleDeleteChecklistItem(item.id)}><X size={11} /></button>}
                                                    </div>
                                                ))}
                                                {canManageChecklistItems && (
                                                    <div className="cdm-comment-form" style={{ marginTop: '0.35rem' }}>
                                                        <input
                                                            className="cdm-comment-input"
                                                            placeholder="Add item..."
                                                            value={newItemTexts[cl.id] || ''}
                                                            onChange={e => setNewItemTexts(prev => ({ ...prev, [cl.id]: e.target.value }))}
                                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem(cl.id); } }}
                                                            disabled={addingItem === cl.id}
                                                        />
                                                        <button className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', borderRadius: '8px' }}
                                                            onClick={() => handleAddChecklistItem(cl.id)} disabled={addingItem === cl.id || !newItemTexts[cl.id]?.trim()}>
                                                            {addingItem === cl.id ? '...' : 'Add'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {canCreateChecklist && (
                                        showAddChecklist ? (
                                            <div className="cdm-comment-form">
                                                <input className="cdm-comment-input" placeholder="Checklist name..." value={newChecklistName}
                                                    onChange={e => setNewChecklistName(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklist(); } if (e.key === 'Escape') setShowAddChecklist(false); }}
                                                    autoFocus disabled={addingChecklist} />
                                                <button className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', borderRadius: '8px' }}
                                                    onClick={handleAddChecklist} disabled={addingChecklist || !newChecklistName.trim()}>
                                                    {addingChecklist ? '...' : 'Add'}
                                                </button>
                                                <button className="cdm-close-btn" onClick={() => setShowAddChecklist(false)}><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <button className="cdm-add-btn" onClick={() => setShowAddChecklist(true)}><Plus size={14} /> Add Checklist</button>
                                        )
                                    )}
                                </div>
                            )}

                            {/* 5. Members */}
                            {!isNewCard && (
                                <div className="cdm-section">
                                    <span className="cdm-section-label"><Users size={13} /> Members</span>
                                    <div className="cdm-members-list">
                                        {members.map(member => {
                                            const isAssigned = card.assignedTo === member.userId;
                                            const isBusy = assigning === member.userId;
                                            const canToggleMember = canToggleAssignmentFor(member.userId);
                                            return (
                                                <div key={member.userId} className={`cdm-member-row ${canToggleMember ? 'clickable' : ''}`}
                                                    onClick={() => canToggleMember && !isBusy && handleToggleAssign(member.userId)}
                                                    style={{ opacity: isBusy ? 0.6 : 1, cursor: canToggleMember ? 'pointer' : 'default' }}>
                                                    <div className={`cdm-member-check ${isAssigned ? 'checked' : ''}`}>
                                                        {isAssigned && <Check size={12} color="#fff" />}
                                                    </div>
                                                    <div className="cdm-member-avatar">{(member.name || '?').charAt(0).toUpperCase()}</div>
                                                    <span className="cdm-member-name">{member.name || `User #${member.userId}`}</span>
                                                    <span className="cdm-member-role">{member.role?.toLowerCase()}</span>
                                                </div>
                                            );
                                        })}
                                        {members.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No workspace members found.</p>}
                                    </div>
                                </div>
                            )}

                            {/* 6. Attachments */}
                            {!isNewCard && (
                                <div className="cdm-section">
                                    <span className="cdm-section-label"><Paperclip size={13} /> Attachments</span>
                                    {card.attachments?.length > 0 && (
                                        <div className="cdm-attachments-list">
                                            {card.attachments.map(att => (
                                                <div key={att.id} className="cdm-attachment-row">
                                                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="cdm-attachment-item cdm-attachment-link">
                                                        <Paperclip size={13} /><span>{att.fileName}</span><span className="cdm-attachment-type">{att.fileType}</span>
                                                    </a>
                                                    {canAddAttachment && user?.id && att.userId != null && String(att.userId) === String(user.id) && (
                                                        <button
                                                            type="button"
                                                            className="cdm-attachment-delete"
                                                            onClick={() => handleDeleteAttachment(att.id)}
                                                            disabled={deletingAttachmentId === att.id}
                                                            title="Delete attachment"
                                                            aria-label="Delete attachment"
                                                        >
                                                            <TrashCanIcon size={18} title="Delete attachment" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {canAddAttachment && (
                                        showAddAttachment ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <input className="cdm-comment-input" placeholder="File name" value={attachFileName}
                                                    onChange={e => setAttachFileName(e.target.value)} autoFocus />
                                                <div className="cdm-comment-form">
                                                    <input className="cdm-comment-input" placeholder="File URL..." value={attachFileUrl}
                                                        onChange={e => setAttachFileUrl(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleAddAttachment(); if (e.key === 'Escape') setShowAddAttachment(false); }} />
                                                    <button className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', borderRadius: '8px' }}
                                                        onClick={handleAddAttachment} disabled={addingAttachment || !attachFileName.trim() || !attachFileUrl.trim()}>
                                                        {addingAttachment ? '...' : 'Add'}
                                                    </button>
                                                    <button className="cdm-close-btn" onClick={() => setShowAddAttachment(false)}><X size={14} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button className="cdm-add-btn" onClick={() => setShowAddAttachment(true)}><Plus size={14} /> Add Attachment</button>
                                        )
                                    )}
                                </div>
                            )}

                            {/* 7. Comments */}
                            {!isNewCard && (
                                <div className="cdm-section">
                                    <span className="cdm-section-label"><MessageSquare size={13} /> Comments</span>
                                    {card.comments?.length > 0 && (
                                        <div className="cdm-comments-list">
                                            {card.comments.map(c => (
                                                <div key={c.id} className="cdm-comment">
                                                    <div className="cdm-comment-header">
                                                        <div className="cdm-member-avatar" style={{ width: 20, height: 20, fontSize: '0.6rem' }}>{getMemberInitial(c.userId)}</div>
                                                        <span className="cdm-comment-user">{getMemberName(c.userId)}</span>
                                                        <span className="cdm-comment-time">{formatTime(c.createdAt)}</span>
                                                    </div>
                                                    <p className="cdm-comment-body">{renderCommentWithMentions(c.content)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {canComment && (
                                        <div className="cdm-comment-form" style={{ position: 'relative' }}>
                                            {showMentions && (
                                                <div className="cdm-mentions-dropdown">
                                                    {members
                                                        .filter(m => (m.name || '').toLowerCase().includes(mentionQuery))
                                                        .map(m => (
                                                            <div
                                                                key={m.userId}
                                                                className="cdm-mention-item"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    handleSelectMention(m);
                                                                }}
                                                            >
                                                                <div className="cdm-member-avatar" style={{ width: 18, height: 18, fontSize: '0.6rem' }}>
                                                                    {m.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span>{m.name}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                            <div
                                                ref={commentInputRef}
                                                className="cdm-comment-input rich-input"
                                                contentEditable="true"
                                                onInput={handleCommentInput}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
                                                        e.preventDefault();
                                                        handleAddComment();
                                                    }
                                                    if (e.key === 'Escape' && showMentions) {
                                                        setShowMentions(false);
                                                    }
                                                }}
                                                data-placeholder="Write a comment..."
                                            ></div>
                                            <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', borderRadius: '10px' }}
                                                onClick={handleAddComment} disabled={addingComment || !commentText.trim()}>
                                                {addingComment ? '...' : 'Send'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Footer: Save + Delete ── */}
                        {(canEditCardDetails || (!isNewCard && canDeleteThisCard)) && (
                            <div className="cdm-footer">
                                <div className="cdm-footer-left">
                                    {!isNewCard && canDeleteThisCard && (
                                        <button
                                            className="btn btn-danger"
                                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                            onClick={handleDelete} disabled={deleting}
                                        >
                                            <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
                                        </button>
                                    )}
                                </div>

                                {canEditCardDetails && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        {justSaved && <span className="cdm-save-indicator"><Check size={13} /> Saved</span>}
                                        <button
                                            className="cdm-save-btn"
                                            onClick={handleSave}
                                            disabled={saving || (!isDirty && !isNewCard)}
                                        >
                                            <Save size={15} /> {saving ? (isNewCard ? 'Creating...' : 'Saving...') : (isNewCard ? 'Create Card' : 'Save Changes')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : null}
            </motion.div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default CardDetailsModal;
