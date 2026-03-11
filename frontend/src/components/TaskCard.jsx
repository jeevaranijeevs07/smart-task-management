import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { AlignLeft, MessageSquare, Paperclip, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './TaskCard.css';

const TaskCard = ({ task, index }) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const priorityColors = {
    High: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--color-danger)' },
    Medium: { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--color-warning)' },
    Low: { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--color-success)' },
  };

  const style = priorityColors[task.priority] || priorityColors.Low;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${snapshot.isDragging ? 'dragging' : ''}`}
          data-priority={task.priority}
          style={{
            ...provided.draggableProps.style,
          }}
        >
          <div className="task-card-header">
            <span
              className="task-priority-tag"
              style={{ backgroundColor: style.bg, color: style.text }}
            >
              {task.priority}
            </span>

            <div className="relative">
              <button
                className="btn-ghost p-1 rounded-md text-muted hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
              >
                <MoreVertical size={14} />
              </button>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    className="absolute right-0 top-8 w-32 glass-heavy rounded-lg shadow-premium z-10 border border-white/10"
                  >
                    <div className="flex flex-col p-1">
                      <button className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 rounded-md transition-colors text-secondary hover:text-primary">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10 rounded-md transition-colors text-red-400">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <h4 className="task-title">{task.title}</h4>
          <p className="task-excerpt">{task.description}</p>

          <div className="task-footer">
            <div className="task-meta">
              <div className="meta-item">
                <AlignLeft size={14} />
              </div>
              <div className="meta-item">
                <MessageSquare size={14} />
                <span>2</span>
              </div>
              <div className="meta-item">
                <Paperclip size={14} />
                <span>1</span>
              </div>
            </div>

            <div className="task-assignee">
              <img src={task.assigneeAvatar} alt="Assignee" />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;
