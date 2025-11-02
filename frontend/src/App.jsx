// Copyright (c) 2025 Scott Crawford. All rights reserved.

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
  const [personalContext, setPersonalContext] = useState({});
  const [userMemory, setUserMemory] = useState({});
  const [projectBuckets, setProjectBuckets] = useState([]);
  const [activeProjectBucket, setActiveProjectBucket] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showHistoryExplorer, setShowHistoryExplorer] = useState(false);
  const [smartTopics, setSmartTopics] = useState([]);
  const [currentTopicContext, setCurrentTopicContext] = useState(null);
  const [virtualThread, setVirtualThread] = useState(null); // { topic, messages, topicId }
  const [notification, setNotification] = useState(null); // { message, type }

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  fetchPreferences();
  fetchPersonalContext();
  fetchUserMemory();
    fetchProjectBucketsData();
    fetchSmartTopics();
    
    // Listen for global open-session events (from UnifiedTimeline snapshot drill-down)
    const onOpenSession = (e) => {
      const sessionId = e?.detail?.sessionId;
      if (sessionId) {
        setCurrentSessionId(sessionId);
        setCurrentTopicContext(null);
        setVirtualThread(null); // Clear virtual thread when opening a session
        fetchSessions();
        fetchProjectBucketsData(sessionId);
        fetchSmartTopics();
      }
    };
    
    // Listen for open-virtual-thread events (from topic cloud clicks)
    const onOpenVirtualThread = (e) => {
      const { topic, snapshot } = e?.detail || {};
      if (topic && snapshot?.items) {
        setVirtualThread({
          topic: topic.topic,
          topicId: topic.topicId,
          messages: snapshot.items,
          sessionId: topic.sessionId, // Representative session for bucket/context
          lastActive: topic.lastActive,
          count: topic.count
        });
        setCurrentSessionId(null); // Clear regular session
        setCurrentTopicContext(topic);
        // Don't fetch sessions - we're in virtual thread mode
      }
    };
    
    window.addEventListener('open-session', onOpenSession);
    window.addEventListener('open-virtual-thread', onOpenVirtualThread);
    return () => {
      window.removeEventListener('open-session', onOpenSession);
      window.removeEventListener('open-virtual-thread', onOpenVirtualThread);
    };
  }, []);

  useEffect(() => {
    if (currentSessionId !== null) {
      fetchProjectBucketsData(currentSessionId);
    }
  }, [currentSessionId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions?limit=30');
      const data = await response.json();
      setSessions(data.sessions || []);
      
      // Select most recent session if none selected
      if (!currentSessionId && data.sessions?.length > 0) {
        setCurrentSessionId(data.sessions[0].id);
        setCurrentTopicContext(null);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchSmartTopics = async () => {
    try {
      const response = await fetch('/api/topics/summary?limit=10');
      const data = await response.json();
      const items = Array.isArray(data) ? data : data.items;
      setSmartTopics(items || []);
    } catch (error) {
      console.error('Failed to fetch smart topics:', error);
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

  const fetchPersonalContext = async () => {
    try {
      const res = await fetch('/api/preferences/personal-context');
      const data = await res.json();
      setPersonalContext(data.personalContext || {});
    } catch (error) {
      console.error('Failed to fetch personal context:', error);
    }
  };

  const fetchUserMemory = async () => {
    try {
      const res = await fetch('/api/preferences/memory');
      const data = await res.json();
      setUserMemory(data.memory || {});
    } catch (error) {
      console.error('Failed to fetch user memory:', error);
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
    setCurrentTopicContext(null);
    setVirtualThread(null); // Clear virtual thread
    
    // Show reassuring notification
    setNotification({
      message: '✓ Topics saved to cloud • Messages embedded & searchable • History preserved',
      type: 'success'
    });
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSelectSession = (sessionId, topicContext = null) => {
    setCurrentSessionId(sessionId);
    setCurrentTopicContext(topicContext);
    setVirtualThread(null); // Clear virtual thread when switching to regular session
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(sessions.filter(s => s.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setCurrentTopicContext(null);
      }
      fetchSmartTopics();
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

  const handleUpdatePersonalContext = async (type, content, extra = {}) => {
    try {
      const res = await fetch(`/api/preferences/personal-context/${encodeURIComponent(type)}` ,{
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, ...extra })
      });
      if (!res.ok) throw new Error('Failed to update personal context');
      setPersonalContext({
        ...personalContext,
        [type]: { ...(personalContext[type] || {}), content, ...extra, updatedAt: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Failed to update personal context:', error);
      throw error;
    }
  };

  const handleUpdateMemory = async (key, value, extra = {}) => {
    try {
      const res = await fetch(`/api/preferences/memory/${encodeURIComponent(key)}` ,{
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, ...extra })
      });
      if (!res.ok) throw new Error('Failed to update memory');
      setUserMemory({
        ...userMemory,
        [key]: { ...(userMemory[key] || {}), value, ...extra, updatedAt: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Failed to update user memory:', error);
      throw error;
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
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-mint-500 text-white' : 'bg-gray-800 text-white'
          }`}>
            {notification.message}
          </div>
        </div>
      )}
      
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        smartTopics={smartTopics}
        currentSessionId={currentSessionId}
        currentTopicId={currentTopicContext?.topicId || null}
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
        onRefreshSessions={() => {
          fetchSessions();
          fetchSmartTopics();
        }}
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
          topicContext={currentTopicContext}
          virtualThread={virtualThread}
          onSessionCreated={(id) => {
            setCurrentSessionId(id);
            setCurrentTopicContext(null);
            setVirtualThread(null); // Clear virtual thread when new session created
            fetchSessions();
            fetchSmartTopics();
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
          personalContext={personalContext}
          memory={userMemory}
          onUpdate={handleUpdatePreference}
          onUpdatePersonalContext={handleUpdatePersonalContext}
          onUpdateMemory={handleUpdateMemory}
          onRefresh={() => { fetchPreferences(); fetchPersonalContext(); fetchUserMemory(); }}
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
