import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import PreferencesPane from './components/PreferencesPane';
import ProjectsPane from './components/ProjectsPane';
import UnifiedTimeline from './components/UnifiedTimeline';
import HistoryExplorer from './components/HistoryExplorer';

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [preferences, setPreferences] = useState({});
  const [projectBuckets, setProjectBuckets] = useState([]);
  const [activeProjectBucket, setActiveProjectBucket] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showHistoryExplorer, setShowHistoryExplorer] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
    fetchPreferences();
    fetchProjectBucketsData();
    // Listen for global open-session events (from UnifiedTimeline snapshot drill-down)
    const onOpenSession = (e) => {
      const sessionId = e?.detail?.sessionId;
      if (sessionId) {
        setCurrentSessionId(sessionId);
        fetchSessions();
        fetchProjectBucketsData(sessionId);
      }
    };
    window.addEventListener('open-session', onOpenSession);
    return () => window.removeEventListener('open-session', onOpenSession);
  }, []);

  useEffect(() => {
    if (currentSessionId !== null) {
      fetchProjectBucketsData(currentSessionId);
    }
  }, [currentSessionId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
      
      // Select most recent session if none selected
      if (!currentSessionId && data.sessions?.length > 0) {
        setCurrentSessionId(data.sessions[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/preferences');
      const data = await response.json();
      setPreferences(data.preferences || {});
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  };

  const fetchProjectBucketsData = async (sessionIdParam) => {
    try {
      const sessionRef = sessionIdParam ?? currentSessionId;
      const params = new URLSearchParams({ includeFiles: 'true' });
      if (sessionRef) {
        params.append('sessionId', sessionRef);
      }

      const response = await fetch(`/api/project-buckets?${params.toString()}`);
      const data = await response.json();
      setProjectBuckets(data.buckets || []);
      setActiveProjectBucket(data.activeBucket || null);
    } catch (error) {
      console.error('Failed to fetch project buckets:', error);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null); // Will create new session on first message
  };

  const handleSelectSession = (sessionId) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(sessions.filter(s => s.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleUpdatePreference = async (key, value) => {
    try {
      await fetch(`/api/preferences/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      
      setPreferences({ ...preferences, [key]: value });
    } catch (error) {
      console.error('Failed to update preference:', error);
    }
  };

  const handleUpdateProjectBucket = async (slot, updates) => {
    try {
      const response = await fetch(`/api/project-buckets/${slot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update project bucket ${slot}`);
      }

      await fetchProjectBucketsData();
    } catch (error) {
      console.error('Failed to update project bucket:', error);
      throw error;
    }
  };

  const handleUploadProjectBucketFile = async (slot, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/project-buckets/${slot}/files`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      await fetchProjectBucketsData();
    } catch (error) {
      console.error('Failed to upload project file:', error);
      throw error;
    }
  };

  const handleDeleteProjectBucketFile = async (slot, associationId) => {
    try {
      const response = await fetch(`/api/project-buckets/${slot}/files/${associationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Delete failed');
      }

      await fetchProjectBucketsData();
    } catch (error) {
      console.error('Failed to delete project file:', error);
      throw error;
    }
  };

  const handleActivateProjectBucket = async (slot) => {
    if (!currentSessionId) {
      return;
    }

    try {
      const response = await fetch(`/api/project-buckets/${slot}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Activation failed');
      }

      await fetchProjectBucketsData();
    } catch (error) {
      console.error('Failed to activate project bucket:', error);
    }
  };

  const handleClearActiveProjectBucket = async () => {
    if (!currentSessionId || !activeProjectBucket) {
      return;
    }

    try {
      const response = await fetch(`/api/project-buckets/${activeProjectBucket.slot}/activate?sessionId=${currentSessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Deactivate failed');
      }

      await fetchProjectBucketsData();
    } catch (error) {
      console.error('Failed to clear project bucket:', error);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onShowPreferences={() => {
          setShowProjects(false);
          setShowPreferences(true);
        }}
        onShowProjects={() => {
          setShowPreferences(false);
          setShowProjects(true);
        }}
        onRefreshSessions={fetchSessions}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Top-right toggles for timeline/history (hide when open to avoid overlay intercepting clicks) */}
        {!showTimeline && !showHistoryExplorer && (
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={() => setShowTimeline(true)}
              className="px-3 py-1 text-xs bg-white/80 border border-gray-200 rounded shadow-sm hover:bg-white"
              title="Show timeline"
            >
              Show Timeline
            </button>
          </div>
        )}
        {!showHistoryExplorer && !showTimeline && (
          <div className="absolute top-9 right-2 z-10">
            <button
              onClick={() => setShowHistoryExplorer(true)}
              className="px-3 py-1 text-xs bg-white/80 border border-gray-200 rounded shadow-sm hover:bg-white"
              title="Show history"
            >
              History
            </button>
          </div>
        )}

        <ChatWindow
          sessionId={currentSessionId}
          onSessionCreated={(id) => {
            setCurrentSessionId(id);
            fetchSessions();
          }}
        />
      </div>

      {/* Right-side Unified Timeline */}
      {showTimeline && (
        <div className="relative">
          <UnifiedTimeline />
          {/* Close button anchored over the timeline panel itself */}
          <div className="absolute top-2 right-2 z-20">
            <button
              onClick={() => setShowTimeline(false)}
              className="px-2 py-1 text-xs bg-white/90 border border-gray-200 rounded shadow-sm hover:bg-white"
              title="Hide timeline"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showHistoryExplorer && (
        <div className="relative">
          <HistoryExplorer onClose={() => setShowHistoryExplorer(false)} />
        </div>
      )}

      {/* Preferences Pane (Modal) */}
      {showPreferences && (
        <PreferencesPane
          preferences={preferences}
          onUpdate={handleUpdatePreference}
          onClose={() => setShowPreferences(false)}
        />
      )}

      {showProjects && (
        <ProjectsPane
          projectBuckets={projectBuckets}
          activeProjectBucket={activeProjectBucket}
          currentSessionId={currentSessionId}
          onUpdateBucket={handleUpdateProjectBucket}
          onUploadBucketFile={handleUploadProjectBucketFile}
          onDeleteBucketFile={handleDeleteProjectBucketFile}
          onActivateBucket={handleActivateProjectBucket}
          onClearActiveBucket={handleClearActiveProjectBucket}
          onClose={() => setShowProjects(false)}
        />
      )}
    </div>
  );
}

export default App;
