import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ChevronRight, Layers, Plus, Search, Shield, Trash2, UserPlus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { API_ENDPOINTS } from "../config/apiConfig";
import { LoadingSkeleton } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";

const NAME_PATTERN = /^[A-Za-z][A-Za-z\s'-]{1,49}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WORKSPACE_ROLE_OPTIONS = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

const WorkspaceMembers = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [activePanel, setActivePanel] = useState(location.state?.targetTab || "members");
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [selectedBackground, setSelectedBackground] = useState("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80"); // Default Mountains
  const [creatingBoard, setCreatingBoard] = useState(false);

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
  const [isRenamingWorkspace, setIsRenamingWorkspace] = useState(false);
  const [workspaceDraftName, setWorkspaceDraftName] = useState("");
  const [isSavingWorkspaceName, setIsSavingWorkspaceName] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const res = await api.get(API_ENDPOINTS.USERS.SEARCH, { params: { query: searchQuery } });
          const users = res.data || [];
          setSearchResults(users.filter(u => u.email !== user?.email)); // prevent inviting self
          setShowSearchDropdown(true);
        } catch (error) {
          console.error("User search failed", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.email]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [workspaceRes, membersRes, boardsRes] = await Promise.all([
          api.get(API_ENDPOINTS.WORKSPACES.GET_BY_ID(id)),
          api.get(API_ENDPOINTS.WORKSPACES.MEMBERS(id)),
          api.get(API_ENDPOINTS.BOARDS.BY_WORKSPACE(id)),
        ]);
        setWorkspace(workspaceRes.data);
        setMembers(membersRes.data || []);
        setBoards(boardsRes.data || []);
      } catch (error) {
        toast.error("Failed to load workspace members.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const getDisplayName = (member) => {
    const name = member?.name?.trim() || "";
    if (NAME_PATTERN.test(name)) return name;
    if (member?.email) return member.email.split("@")[0];
    return "Member";
  };

  const refreshMembers = async () => {
    const res = await api.get(API_ENDPOINTS.WORKSPACES.MEMBERS(id));
    setMembers(res.data || []);
  };

  const refreshBoards = async () => {
    const res = await api.get(API_ENDPOINTS.BOARDS.BY_WORKSPACE(id));
    setBoards(res.data || []);
  };

  const currentUserRole = members.find((member) => String(member.userId) === String(user?.id))?.role;
  const canRenameWorkspace = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canManageMembers = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canCreateBoard = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canInvite = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canDeleteWorkspace = currentUserRole === "OWNER";

  const handleInvite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setIsInviting(true);
    try {
      if (selectedUserId) {
        // Direct add for existing users
        await api.post(API_ENDPOINTS.WORKSPACES.MEMBERS(id), {
          userId: selectedUserId,
          role: inviteRole,
        });
        toast.success("User added to workspace successfully.");
        await refreshMembers();
      } else {
        // Email invite for new/unselected users
        await api.post(API_ENDPOINTS.WORKSPACES.INVITE(id), {
          email,
          role: inviteRole,
        });
        toast.success("Invitation sent to " + email);
      }

      setInviteEmail("");
      setSearchQuery("");
      setSelectedUserId(null);
      setInviteRole("MEMBER");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.put(API_ENDPOINTS.WORKSPACES.MEMBER_ROLE(id, userId), { role: newRole });
      await refreshMembers();
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      toast.error("Failed to change role.");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this member from workspace?")) {
      return;
    }
    try {
      await api.delete(`${API_ENDPOINTS.WORKSPACES.MEMBERS(id)}/${userId}`);
      await refreshMembers();
      toast.success("Member removed.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member.");
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    const normalizedName = boardName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      toast.error("Board name must be between 2 and 80 characters.");
      return;
    }

    setCreatingBoard(true);
    try {
      await api.post(API_ENDPOINTS.BOARDS.BY_WORKSPACE(id), {
        name: normalizedName,
        description: boardDescription.trim(),
        background: selectedBackground,
      });
      setShowCreateBoardModal(false);
      setBoardName("");
      setBoardDescription("");
      await refreshBoards();
      setActivePanel("boards");
      toast.success("Board created successfully.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create board.");
    } finally {
      setCreatingBoard(false);
    }
  };

  const handleDeleteBoard = async (boardId, boardName) => {
    if (!window.confirm(`Delete board "${boardName}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`${API_ENDPOINTS.BOARDS.BASE}/${boardId}`);
      await refreshBoards();
      toast.success("Board deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete board.");
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!window.confirm(`Are you sure you want to delete workspace "${workspace.name}"? This action is permanent and will delete all boards, lists, and cards.`)) {
      return;
    }
    try {
      await api.delete(API_ENDPOINTS.WORKSPACES.GET_BY_ID(id));
      toast.success("Workspace deleted successfully.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete workspace.");
    }
  };

  const startWorkspaceRename = () => {
    if (!canRenameWorkspace || !workspace?.name) return;
    setWorkspaceDraftName(workspace.name);
    setIsRenamingWorkspace(true);
  };

  const cancelWorkspaceRename = () => {
    setWorkspaceDraftName(workspace?.name || "");
    setIsRenamingWorkspace(false);
  };

  const handleWorkspaceRename = async () => {
    const normalizedName = workspaceDraftName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      toast.error("Workspace name must be between 2 and 80 characters.");
      return;
    }
    if (normalizedName === workspace?.name) {
      setIsRenamingWorkspace(false);
      return;
    }

    setIsSavingWorkspaceName(true);
    try {
      const response = await api.put(API_ENDPOINTS.WORKSPACES.UPDATE(id), {
        name: normalizedName,
        description: workspace?.description ?? "",
      });
      if (response.data) {
        setWorkspace(response.data);
      } else {
        setWorkspace((prev) => (prev ? { ...prev, name: normalizedName } : prev));
      }
      toast.success("Workspace name updated.");
      setIsRenamingWorkspace(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update workspace name.");
    } finally {
      setIsSavingWorkspaceName(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-12">
        <LoadingSkeleton type="card" />
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="animate-fade-in" style={{ padding: "1.1rem 2rem 2rem", width: "100%", maxWidth: "none" }}>
      <header style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.85rem" }}>
          <Link to="/dashboard" style={{ color: "var(--accent-secondary)" }}>Dashboard</Link>
          <ChevronRight size={12} />
          {!isRenamingWorkspace ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={startWorkspaceRename}
              disabled={!canRenameWorkspace}
              title={canRenameWorkspace ? "Rename workspace" : "Only Owner/Admin can rename workspace"}
              style={{
                padding: "0.2rem 0.55rem",
                fontSize: "0.82rem",
                borderRadius: 999,
                color: "var(--accent-secondary)",
                borderColor: "rgba(6, 182, 212, 0.4)",
                background: "rgba(6, 182, 212, 0.08)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>{workspace.name}</span>
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <input
                type="text"
                className="input"
                value={workspaceDraftName}
                onChange={(e) => setWorkspaceDraftName(e.target.value)}
                maxLength={80}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!isSavingWorkspaceName) handleWorkspaceRename();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    if (!isSavingWorkspaceName) cancelWorkspaceRename();
                  }
                }}
                style={{ width: 280, paddingTop: "0.45rem", paddingBottom: "0.45rem", fontSize: "0.82rem" }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "0.35rem 0.55rem" }}
                onClick={handleWorkspaceRename}
                disabled={isSavingWorkspaceName}
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.35rem 0.55rem" }}
                onClick={cancelWorkspaceRename}
                disabled={isSavingWorkspaceName}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          {canDeleteWorkspace && (
            <button
              className="btn btn-secondary"
              onClick={handleDeleteWorkspace}
              style={{ color: "var(--color-danger)", borderColor: "rgba(239, 68, 68, 0.4)" }}
            >
              <Trash2 size={16} />
              Delete Workspace
            </button>
          )}
          {canCreateBoard && (
            <button className="btn btn-primary" onClick={() => setShowCreateBoardModal(true)}>
              <Plus size={16} />
              Create Board
            </button>
          )}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "1rem", alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", minHeight: 560 }}>
          <aside
            className="glass-heavy"
            style={{ borderRadius: "var(--radius-xl)", padding: "0.9rem", minHeight: 500, display: "flex", flexDirection: "column" }}
          >
            <button
              className={activePanel === "members" ? "btn btn-primary" : "btn btn-secondary"}
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: "0.7rem" }}
              onClick={() => setActivePanel("members")}
            >
              <Users size={16} />
              Workspace Members
            </button>
            {canInvite && (
              <button
                className={activePanel === "invite" ? "btn btn-primary" : "btn btn-secondary"}
                style={{ width: "100%", justifyContent: "flex-start", marginBottom: "1rem" }}
                onClick={() => setActivePanel("invite")}
              >
                <UserPlus size={16} />
                Invite to Workspace
              </button>
            )}
            <button
              className={activePanel === "boards" ? "btn btn-primary" : "btn btn-secondary"}
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: "1rem" }}
              onClick={() => setActivePanel("boards")}
            >
              <Layers size={16} />
              Boards ({boards.length})
            </button>
          </aside>
        </div>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 420 }}>
          {activePanel === "members" && (
            <section className="glass-heavy" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-glass)" }}>
                <h2 style={{ fontSize: "2rem" }}>Workspace Members</h2>
                <p style={{ color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  {members.length} member{members.length === 1 ? "" : "s"}
                </p>
              </div>

              {members.length > 0 ? (
                members.map((member) => (
                  <motion.div
                    key={member.id ?? member.userId}
                    layout
                    style={{
                      padding: "1.05rem 1.25rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      borderBottom: "1px solid var(--border-glass)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "1.35rem" }}>
                        {getDisplayName(member).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.1rem" }}>{getDisplayName(member)}</p>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Shield size={12} style={{ color: "var(--accent-secondary)" }} />
                          {member.role}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      {canManageMembers ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                          className="input"
                          style={{ width: 190, paddingTop: "0.65rem", paddingBottom: "0.65rem", fontSize: "0.95rem" }}
                          disabled={
                            String(member.userId) === String(user?.id) ||
                            (currentUserRole === "ADMIN" && (member.role === "OWNER" || member.role === "ADMIN"))
                          }
                        >
                          {WORKSPACE_ROLE_OPTIONS.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleOption.charAt(0) + roleOption.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                      ) : (
                        null
                      )}

                      {(canManageMembers || String(member.userId) === String(user?.id)) && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "0.5rem 0.8rem", color: "var(--color-danger)", borderColor: "rgba(239,68,68,0.45)" }}
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={currentUserRole === "ADMIN" && (member.role === "OWNER" || member.role === "ADMIN") && String(member.userId) !== String(user?.id)}
                        >
                          {String(member.userId) === String(user?.id) ? "Leave" : "Delete"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No members found.</div>
              )}
            </section>
          )}

          {activePanel === "invite" && (
            <section className="glass-heavy" style={{ borderRadius: "var(--radius-xl)", padding: "1.25rem", height: "fit-content" }}>
              <h2 style={{ fontSize: "2rem", marginBottom: "0.45rem" }}>Invite to Workspace</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
                Invite new members to collaborate on boards and tasks.
              </p>

              <form onSubmit={handleInvite}>
                <div className="input-icon-wrapper" style={{ marginBottom: "0.8rem", position: 'relative' }} ref={searchContainerRef}>
                  <Search className="input-icon" size={18} />
                  <input
                    type="text"
                    value={searchQuery || inviteEmail}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setInviteEmail(e.target.value);
                      setSelectedUserId(null);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSearchDropdown(true);
                    }}
                    placeholder="Search by name or email address..."
                    className="input"
                    autoComplete="off"
                  />
                  {showSearchDropdown && (searchQuery.length >= 2 || isSearching) && (
                    <div className="glass-heavy" style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-premium)',
                      maxHeight: '240px',
                      overflowY: 'auto',
                      zIndex: 50,
                      border: '1px solid var(--border-glass)'
                    }}>
                      {isSearching ? (
                        <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Searching users...</div>
                      ) : searchResults.length > 0 ? (
                        <div style={{ padding: '0.25rem' }}>
                          {searchResults.map(userResult => (
                            <div
                              key={userResult.id}
                              onClick={() => {
                                setInviteEmail(userResult.email);
                                setSearchQuery(userResult.email);
                                setSelectedUserId(userResult.id);
                                setShowSearchDropdown(false);
                              }}
                              style={{
                                padding: '0.5rem 0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem', fontWeight: 600 }}>
                                {userResult.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userResult.name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userResult.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          No users found matching "{searchQuery}". <br />
                          <span style={{ fontSize: '0.75rem' }}>You can still send an invite if it's a valid email.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="input-group" style={{ marginBottom: "0.8rem" }}>
                  <label className="label">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="input"
                  >
                    {WORKSPACE_ROLE_OPTIONS.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {roleOption.charAt(0) + roleOption.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", marginBottom: "0.8rem" }}
                >
                  {isInviting ? (selectedUserId ? "Adding..." : "Sending...") : (selectedUserId ? "Add to Workspace" : "Send Invitation")}
                </button>
              </form>
            </section>
          )}

          {activePanel === "boards" && (
            <section className="glass-heavy" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-glass)" }}>
                <h2 style={{ fontSize: "2rem" }}>Boards</h2>
                <p style={{ color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  {boards.length} board{boards.length === 1 ? "" : "s"} created so far
                </p>
              </div>

              {boards.length > 0 ? (
                boards.map((board) => (
                  <div
                    key={board.id}
                    style={{
                      padding: "1rem 1.25rem",
                      borderBottom: "1px solid var(--border-glass)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.8rem",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem", marginBottom: "0.2rem" }}>
                        {board.name}
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        {board.description?.trim() || "No description"}
                      </p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => navigate(`/workspace/${id}/board/${board.id}`)}>
                      Open
                    </button>
                    {canManageMembers && (
                      <button
                        className="btn btn-secondary"
                        style={{ color: "var(--color-danger)", borderColor: "rgba(239,68,68,0.45)" }}
                        onClick={() => handleDeleteBoard(board.id, board.name)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No boards created yet.
                </div>
              )}
            </section>
          )}

          {activePanel === "" && (
            <section className="glass-heavy" style={{ borderRadius: "var(--radius-xl)", minHeight: 420 }} />
          )}
        </div>
      </div>

      {showCreateBoardModal && (
        <div className="modal-overlay" onClick={() => !creatingBoard && setShowCreateBoardModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3>Create Board</h3>
              <button
                className="btn-ghost"
                style={{ padding: "0.2rem" }}
                onClick={() => setShowCreateBoardModal(false)}
                disabled={creatingBoard}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBoard}>
              <div className="input-group">
                <label className="label">Board Name</label>
                <input
                  type="text"
                  className="input"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  placeholder="e.g. Product Roadmap"
                  maxLength={80}
                  required
                />
              </div>

              <div className="input-group">
                <label className="label">Description (Optional)</label>
                <input
                  type="text"
                  className="input"
                  value={boardDescription}
                  onChange={(e) => setBoardDescription(e.target.value)}
                  placeholder="Add a short description"
                  maxLength={180}
                />
              </div>

              <div className="input-group">
                <label className="label">Board Background</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                  {DEFAULT_BACKGROUNDS.map((bg) => (
                    <div
                      key={bg.name}
                      onClick={() => setSelectedBackground(bg.url)}
                      style={{
                        position: 'relative',
                        width: '80px',
                        height: '50px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: selectedBackground === bg.url ? '2px solid var(--accent-secondary)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                      title={bg.name}
                    >
                      <img
                        src={bg.thumbnail}
                        alt={bg.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {selectedBackground === bg.url && (
                        <div style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          background: 'var(--accent-secondary)',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff'
                        }}>
                          <Check size={10} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateBoardModal(false)} disabled={creatingBoard}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingBoard}>
                  {creatingBoard ? "Creating..." : "Create Board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceMembers;
