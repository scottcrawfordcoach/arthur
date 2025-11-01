import { MessageSquarePlus, Settings, Trash2, RefreshCw, Edit2, Folder } from 'lucide-react';
import { useState } from 'react';

export default function Sidebar({ 
  sessions, 
  currentSessionId, 
  onNewChat, 
  onSelectSession, 
  onDeleteSession,
  onShowPreferences,
  onShowProjects,
  onRefreshSessions
}) {
  const [hoveredSession, setHoveredSession] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const startEdit = (session, e) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveEdit = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle })
      });
      setEditingId(null);
      onRefreshSessions();
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-mint-700 mb-4">
          🧠 ScottBot Local
        </h1>
        
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-mint-500 hover:bg-mint-600 text-white px-4 py-3 rounded-lg transition-colors font-medium"
        >
          <MessageSquarePlus size={20} />
          New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            No chats yet. Start a new one!
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              onMouseEnter={() => setHoveredSession(session.id)}
              onMouseLeave={() => setHoveredSession(null)}
              className={`
                relative group p-3 mb-2 rounded-lg cursor-pointer transition-all
                ${currentSessionId === session.id 
                  ? 'bg-mint-100 border-2 border-mint-400' 
                  : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                }
              `}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {editingId === session.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(session.id, e);
                          if (e.key === 'Escape') cancelEdit(e);
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-mint-500"
                        autoFocus
                      />
                      <button
                        onClick={(e) => saveEdit(session.id, e)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-gray-800 truncate">
                        {session.title || 'New Chat'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{session.message_count || 0} messages</span>
                        {session.bundle_count ? (
                          <>
                            <span>•</span>
                            <span>{session.bundle_count} bundle{session.bundle_count === 1 ? '' : 's'}</span>
                          </>
                        ) : null}
                        <span>•</span>
                        <span>{formatDate(session.updated_at)}</span>
                      </div>
                    </>
                  )}
                </div>
                
                {hoveredSession === session.id && editingId !== session.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => startEdit(session, e)}
                      className="p-1 hover:bg-mint-100 rounded transition-colors"
                      title="Rename"
                    >
                      <Edit2 size={14} className="text-mint-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={onRefreshSessions}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>

          <button
            onClick={onShowProjects}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Folder size={18} />
            Projects
          </button>
        
        <button
          onClick={onShowPreferences}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
        >
          <Settings size={18} />
          Preferences
        </button>
      </div>
    </div>
  );
}
