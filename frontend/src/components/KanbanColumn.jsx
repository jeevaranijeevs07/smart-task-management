import React, { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { MoreHorizontal, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const KanbanColumn = ({ column, tasks }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(column.title);

    return (
        <div className="kanban-column">
            <div className="column-header">
                <div className="column-title-area">
                    <div className="column-dot"></div>
                    {isEditing ? (
                        <input
                            className="input py-1 px-2 text-sm bg-white/5 border-transparent focus:border-accent-primary"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={() => setIsEditing(false)}
                            autoFocus
                        />
                    ) : (
                        <h3
                            className="column-name cursor-pointer hover:text-accent-primary transition-colors"
                            onClick={() => setIsEditing(true)}
                        >
                            {title}
                        </h3>
                    )}
                    <span className="task-badge">{tasks.length}</span>
                </div>
                <button className="btn-ghost p-1 rounded-md text-muted"><MoreHorizontal size={16} /></button>
            </div>

            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        className={`column-body ${snapshot.isDraggingOver ? 'is-dragging-over' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {tasks.map((task, index) => (
                            <TaskCard key={task.id} task={task} index={index} />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>

            <div className="column-footer">
                <button className="btn add-btn-premium">
                    <Plus size={16} />
                    Add a Task
                </button>
            </div>
        </div>
    );
};

export default KanbanColumn;
