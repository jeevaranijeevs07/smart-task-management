import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { ChevronRight, Plus, Settings, Share2, Users } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import './Board.css';

const initialData = {
    tasks: {
        'task-1': { id: 'task-1', title: 'Design Landing Page', description: 'Create high-fidelity mockups for new homepage.', priority: 'High', assigneeAvatar: 'https://i.pravatar.cc/150?img=11' },
        'task-2': { id: 'task-2', title: 'Setup Authentication', description: 'Implement JWT based auth flow.', priority: 'High', assigneeAvatar: 'https://i.pravatar.cc/150?img=12' },
        'task-3': { id: 'task-3', title: 'Migrate Database', description: 'Move from SQLite to PostgreSQL.', priority: 'Medium', assigneeAvatar: 'https://i.pravatar.cc/150?img=13' },
        'task-4': { id: 'task-4', title: 'Update README', description: 'Flesh out setup instructions.', priority: 'Low', assigneeAvatar: 'https://i.pravatar.cc/150?img=14' },
        'task-5': { id: 'task-5', title: 'Fix Header Bug', description: 'Mobile menu doesn\'t close on navigation.', priority: 'Medium', assigneeAvatar: 'https://i.pravatar.cc/150?img=15' },
        'task-6': { id: 'task-6', title: 'Optimize Images', description: 'Compress assets for faster load time.', priority: 'Low', assigneeAvatar: 'https://i.pravatar.cc/150?img=16' },
    },
    columns: {
        'column-1': {
            id: 'column-1',
            title: 'To Do',
            taskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
        },
        'column-2': {
            id: 'column-2',
            title: 'In Progress',
            taskIds: ['task-5'],
        },
        'column-3': {
            id: 'column-3',
            title: 'Done',
            taskIds: ['task-6'],
        }
    },
    columnOrder: ['column-1', 'column-2', 'column-3'],
};

const Board = () => {
    const [data, setData] = useState(initialData);

    const onDragEnd = result => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const startColumn = data.columns[source.droppableId];
        const finishColumn = data.columns[destination.droppableId];

        if (startColumn === finishColumn) {
            const newTaskIds = Array.from(startColumn.taskIds);
            newTaskIds.splice(source.index, 1);
            newTaskIds.splice(destination.index, 0, draggableId);

            const newColumn = { ...startColumn, taskIds: newTaskIds };
            setData({
                ...data,
                columns: { ...data.columns, [newColumn.id]: newColumn },
            });
            return;
        }

        // Moving from one list to another
        const startTaskIds = Array.from(startColumn.taskIds);
        startTaskIds.splice(source.index, 1);
        const newStart = { ...startColumn, taskIds: startTaskIds };

        const finishTaskIds = Array.from(finishColumn.taskIds);
        finishTaskIds.splice(destination.index, 0, draggableId);
        const newFinish = { ...finishColumn, taskIds: finishTaskIds };

        setData({
            ...data,
            columns: {
                ...data.columns,
                [newStart.id]: newStart,
                [newFinish.id]: newFinish,
            },
        });
    };

    return (
        <div className="board-container animate-fade-in">
            <div className="board-header">
                <div className="board-title-group">
                    <div className="board-path">
                        <span>Workspaces</span> <ChevronRight size={12} /> <span>Project Alpha</span>
                    </div>
                    <h2>Project Alpha</h2>
                </div>

                <div className="board-actions">
                    <div className="members-stack">
                        <img src="https://i.pravatar.cc/150?img=11" alt="M" />
                        <img src="https://i.pravatar.cc/150?img=12" alt="M" />
                        <img src="https://i.pravatar.cc/150?img=13" alt="M" />
                        <div className="member-plus">+3</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="btn-secondary py-2 px-3">
                            <Share2 size={16} />
                            Share
                        </button>
                        <button
                            className="btn-primary py-2 px-3 shadow-glow"
                            onClick={() => window.location.href = '/workspace/1/members'}
                        >
                            <Users size={16} />
                            Members
                        </button>
                        <button className="btn-secondary py-2 px-2">
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="board-scroller">
                    {data.columnOrder.map((columnId) => {
                        const column = data.columns[columnId];
                        const tasks = column.taskIds.map(taskId => data.tasks[taskId]);
                        return <KanbanColumn key={column.id} column={column} tasks={tasks} />;
                    })}

                    {/* Add Column Button */}
                    <div className="min-w-[320px]">
                        <button className="btn btn-ghost w-full justify-start py-4 opacity-50 hover:opacity-100 hover:bg-white/5">
                            <Plus size={20} />
                            Add another list
                        </button>
                    </div>
                </div>
            </DragDropContext>

            {/* Mobile FAB */}
            <button className="mobile-fab">
                <Plus size={24} className="text-white" />
            </button>
        </div>
    );
};

export default Board;
