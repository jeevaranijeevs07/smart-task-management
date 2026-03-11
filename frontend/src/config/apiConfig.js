export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/users/login',
        REGISTER: '/users/register',
        LOGOUT: '/auth/logout',
        ME: '/users/me',
        UPDATE_PROFILE: '/users/me',
        DELETE_ACCOUNT: '/users/me',
    },
    WORKSPACES: {
        BASE: '/workspaces',
        GET_ALL: '/workspaces',
        CREATE: '/workspaces',
        GET_BY_ID: (id) => `/workspaces/${id}`,
        UPDATE: (id) => `/workspaces/${id}`,
        MEMBERS: (id) => `/workspaces/${id}/members`,
        MEMBER_ROLE: (workspaceId, userId) => `/workspaces/${workspaceId}/members/${userId}/role`,
        INVITE: (id) => `/workspaces/${id}/invitations`,
    },
    USERS: {
        SEARCH: '/users/search',
    },
    BOARDS: {
        BASE: '/boards',
        BY_WORKSPACE: (workspaceId) => `/workspaces/${workspaceId}/boards`,
        GET_BY_ID: (id) => `/boards/${id}`,
        UPDATE: (id) => `/boards/${id}`,
        DELETE: (id) => `/boards/${id}`,
        MEMBERS: (id) => `/boards/${id}/members`,
        LISTS: (boardId) => `/boards/${boardId}/lists`,
        LIST_BY_ID: (boardId, listId) => `/boards/${boardId}/lists/${listId}`,
        LISTS_REORDER: (boardId) => `/boards/${boardId}/lists/reorder`,
    },
    CARDS: {
        BY_WORKSPACE: (workspaceId) => `/workspaces/${workspaceId}/cards`,
        CREATE: (workspaceId) => `/workspaces/${workspaceId}/cards`,
        GET_BY_ID: (cardId) => `/cards/${cardId}`,
        UPDATE: (cardId) => `/cards/${cardId}`,
        DELETE: (cardId) => `/cards/${cardId}`,
        MOVE: (cardId) => `/cards/${cardId}/move`,
        ASSIGN: (cardId) => `/cards/${cardId}/assign`,
        REMOVE_ASSIGN: (cardId, userId) => `/cards/${cardId}/assign/${userId}`,
        CHECKLIST: (cardId) => `/cards/${cardId}/checklists`,
        CHECKLIST_ITEM: (checklistId) => `/checklists/${checklistId}/items`,
        CHECKLIST_ITEM_UPDATE: (itemId) => `/checklist-items/${itemId}`,
        CHECKLIST_ITEM_DELETE: (itemId) => `/checklist-items/${itemId}`,
        COMMENT: (cardId) => `/cards/${cardId}/comments`,
        ATTACHMENT: (cardId) => `/cards/${cardId}/attachments`,
        ATTACHMENT_DELETE: (cardId, attachmentId) => `/cards/${cardId}/attachments/${attachmentId}`,
    },
    INVITATIONS: {
        ACCEPT: '/invitations/accept',
    },
    NOTIFICATIONS: {
        GET_ALL: '/notifications',
        MARK_READ: (id) => `/notifications/${id}/read`,
        MARK_ALL_READ: '/notifications/read-all',
        DELETE: (id) => `/notifications/${id}`,
    },
    ACTIVITIES: {
        RECENT: '/activities/recent',
    }
};


export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
    TIMEOUT: 10000,
};
