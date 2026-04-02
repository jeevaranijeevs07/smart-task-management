import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * Redirects /workspace/:workspaceId to the full workspace management UI
 * at /workspace/:workspaceId/members with the Boards tab active by default.
 */
const WorkspaceBoard = () => {
    const { workspaceId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (workspaceId) {
            navigate(`/workspace/${workspaceId}/members`, {
                replace: true,
                state: { targetTab: 'boards' },
            });
        }
    }, [workspaceId, navigate]);

    return null;
};

export default WorkspaceBoard;
