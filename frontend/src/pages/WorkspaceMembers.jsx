import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Check, ChevronRight, ChevronDown, Layers, Plus, RefreshCw, Search, Settings, Shield, Trash2, UserPlus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { API_ENDPOINTS } from "../config/apiConfig";
import { LoadingSkeleton } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";

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
  const [boardAdminAccess, setBoardAdminAccess] = useState({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
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
      setError(null);
      try {
        const [workspaceRes, membersRes, boardsRes] = await Promise.all([
          api.get(API_ENDPOINTS.WORKSPACES.GET_BY_ID(id)),
          api.get(API_ENDPOINTS.WORKSPACES.MEMBERS(id)),
          api.get(API_ENDPOINTS.BOARDS.BY_WORKSPACE(id)),
        ]);
        setWorkspace(workspaceRes.data);
        setMembers(membersRes.data || []);
        setBoards(boardsRes.data || []);
      } catch (err) {
        console.error("Error loading workspace:", err);
        setError(err.response?.data?.message || "Failed to load workspace data.");
        toast.error("Failed to load workspace members.");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const handleRetry = () => {
    // This will trigger the effect above since id hasn't changed but we want to re-run it
    // Actually, it's better to just call fetchData if we extract it, or just use a dummy state.
    window.location.reload(); 
  };

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

  const currentUserRole = (members.find((member) => String(member.userId) === String(user?.id))?.role || "").toUpperCase();
  const canRenameWorkspace = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canManageMembers = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canCreateBoard = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canInvite = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const canDeleteWorkspace = currentUserRole === "OWNER";
  const canDeleteBoardByRole = (boardId) =>
    canManageMembers || Boolean(boardAdminAccess[String(boardId)]);

  const RoleSelect = ({ value, onChange, options, disabled = false, width = "100%" }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const [menuStyle, setMenuStyle] = useState(null);

    useEffect(() => {
      const handler = (e) => {
        if (ref.current && !ref.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
      if (!open || !ref.current) return;
      const updatePos = () => {
        const rect = ref.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const menuWidth = rect.width;
        const left = Math.min(Math.max(rect.left, 8), viewportWidth - menuWidth - 8);
        const top = rect.bottom + 8;
        setMenuStyle({
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          width: `${menuWidth}px`,
          maxWidth: "calc(100vw - 16px)",
          zIndex: 1000,
        });
      };
      updatePos();
      window.addEventListener("resize", updatePos);
      window.addEventListener("scroll", updatePos, true);
      return () => {
        window.removeEventListener("resize", updatePos);
        window.removeEventListener("scroll", updatePos, true);
      };
    }, [open]);

    const format = (opt) => opt.charAt(0) + opt.slice(1).toLowerCase();

    return (
      <div ref={ref} style={{ position: "relative", width }}>
        <button
          type="button"
          className={`input role-select-button${open ? " is-open" : ""}`}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          disabled={disabled}
          style={{
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <span>{format(value)}</span>
          <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
        </button>
        {open && !disabled && menuStyle && typeof document !== "undefined" && (
          createPortal(
            <div
              className="glass"
              style={{
                ...menuStyle,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-glass)",
                overflow: "hidden",
                boxShadow: "var(--shadow-premium)",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.75rem 1rem",
                    background: opt === value ? "rgba(79, 70, 229, 0.12)" : "transparent",
                    color: "var(--text-primary)",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79, 70, 229, 0.12)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = opt === value ? "rgba(79, 70, 229, 0.12)" : "transparent")}
                >
                  {format(opt)}
                </button>
              ))}
            </div>,
            document.body
          )
        )}
      </div>
    );
  };

  useEffect(() => {
    let isCancelled = false;

    const resolveBoardAdminAccess = async () => {
      if (!boards.length || !user?.id) {
        setBoardAdminAccess({});
        return;
      }

      if (canManageMembers) {
        const fullAccess = Object.fromEntries((boards || []).map((board) => [String(board.id), true]));
        setBoardAdminAccess(fullAccess);
        return;
      }

      const entries = await Promise.all(
        (boards || []).map(async (board) => {
          try {
            const res = await api.get(API_ENDPOINTS.BOARDS.GET_BY_ID(board.id));
            const role = (res.data?.members || []).find((m) => String(m.userId) === String(user?.id))?.role;
            return [String(board.id), String(role || "").toUpperCase() === "ADMIN"];
          } catch {
            return [String(board.id), false];
          }
        })
      );

      if (!isCancelled) {
        setBoardAdminAccess(Object.fromEntries(entries));
      }
    };

    resolveBoardAdminAccess();
    return () => {
      isCancelled = true;
    };
  }, [boards, canManageMembers, user?.id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setIsInviting(true);
    try {
      if (selectedUserId && canManageMembers) {
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
      toast.error(error.response?.data?.message || "Failed to change role.");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this member from workspace?")) {
      return;
    }
    const isSelf = String(userId) === String(user?.id);
    try {
      await api.delete(`${API_ENDPOINTS.WORKSPACES.MEMBERS(id)}/${userId}`);
      if (isSelf) {
        toast.success("You left the workspace.");
        navigate("/dashboard#workspaces");
        return;
      }
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

  if (error) {
    return (
      <div className="container py-20 text-center">
        <div className="glass-card p-12 inline-block" style={{ maxWidth: 500 }}>
          <AlertCircle size={48} style={{ color: "var(--color-danger)", marginBottom: "1.5rem" }} />
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>Oops! Something went wrong</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>{error}</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </button>
            <button className="btn btn-primary" onClick={handleRetry}>
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace && !isLoading) {
    return (
      <div className="container py-20 text-center">
        <div className="glass-card p-12 inline-block" style={{ maxWidth: 500 }}>
          <Layers size={48} style={{ color: "var(--accent-secondary)", marginBottom: "1.5rem" }} />
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>Workspace Not Found</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>This workspace doesn't exist or you don't have access to it.</p>
          <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
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
                style={{ width: '100%', maxWidth: 280, paddingTop: "0.45rem", paddingBottom: "0.45rem", fontSize: "0.82rem" }}
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
        <div className="mobile-stack" style={{ justifyContent: "flex-end", gap: "0.75rem" }}>
          {canCreateBoard && (
            <button className="btn btn-primary" onClick={() => setShowCreateBoardModal(true)}>
              <Plus size={16} />
              Create Board
            </button>
          )}
        </div>
      </header>

      <div className="responsive-grid-2" style={{ alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", minHeight: 'auto' }}>
          <aside
            className="glass-heavy"
            style={{ borderRadius: "var(--radius-xl)", padding: "0.9rem", minHeight: 'auto', display: "flex", flexDirection: "column" }}
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
            <button
              className={activePanel === "settings" ? "btn btn-primary" : "btn btn-secondary"}
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: "1rem" }}
              onClick={() => setActivePanel("settings")}
            >
              <Settings size={16} />
              Workspace Settings
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
                        <RoleSelect
                          value={member.role}
                          onChange={(newRole) => handleChangeRole(member.userId, newRole)}
                          options={WORKSPACE_ROLE_OPTIONS.filter((roleOption) => {
                            if (currentUserRole === "OWNER") return true;
                            return roleOption === "MEMBER" || roleOption === "VIEWER";
                          })}
                          disabled={
                            currentUserRole === "ADMIN" &&
                            (member.role === "OWNER" || member.role === "ADMIN" || String(member.userId) === String(user?.id))
                          }
                          width="190px"
                        />
                      ) : null}

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
                  <RoleSelect
                    value={inviteRole}
                    onChange={setInviteRole}
                    options={
                      currentUserRole === "OWNER"
                        ? WORKSPACE_ROLE_OPTIONS
                        : WORKSPACE_ROLE_OPTIONS.filter((r) => r === "MEMBER" || r === "VIEWER")
                    }
                    disabled={!canInvite}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", marginBottom: "0.8rem" }}
                >
                  {isInviting ? (selectedUserId && canManageMembers ? "Adding..." : "Sending...") : (selectedUserId && canManageMembers ? "Add to Workspace" : "Send Invitation")}
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
                    {canDeleteBoardByRole(board.id) && (
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

          {activePanel === "settings" && (
            <section className="glass-heavy" style={{ borderRadius: "var(--radius-xl)", padding: "1.5rem" }}>
              <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Workspace Settings</h2>
              
              <div style={{ 
                padding: "1.25rem", 
                borderRadius: "var(--radius-lg)", 
                background: "rgba(239, 68, 68, 0.05)", 
                border: "1px solid rgba(239, 68, 68, 0.2)",
                marginTop: "1rem"
              }}>
                <h3 style={{ color: "var(--color-danger)", fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={18} />
                  Danger Zone
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
                  Once you delete a workspace, all its boards and data will be permanently removed. This action cannot be undone.
                </p>
                {canDeleteWorkspace ? (
                  <button
                    className="btn"
                    onClick={handleDeleteWorkspace}
                    style={{ background: "var(--color-danger)", color: "white", fontWeight: 600, border: "none" }}
                  >
                    <Trash2 size={16} />
                    Delete this Workspace
                  </button>
                ) : (
                  <p style={{ fontSize: "0.82rem", color: "var(--color-danger)", fontStyle: "italic" }}>
                    Only the Workspace Owner can perform this action.
                  </p>
                )}
              </div>
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
      </div>
    </div>
  );
};

export default WorkspaceMembers;
