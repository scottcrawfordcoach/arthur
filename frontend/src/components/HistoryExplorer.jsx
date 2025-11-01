// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, Search, Sparkles, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import UnifiedTimeline from './UnifiedTimeline';

const enableTopicCloud = (import.meta.env.VITE_UI_TOPIC_CLOUD ?? '1') !== '0';
const enableTopicSearch = (import.meta.env.VITE_UI_TOPIC_SEARCH ?? '1') !== '0';
const TOPIC_LIMIT = Number.parseInt(import.meta.env.VITE_TOPIC_CLOUD_LIMIT ?? '15', 10);

function clampFont(weight) {
  const normalized = Math.max(1, Math.min(100, Number(weight) || 1));
  return 16 + ((normalized / 100) * 44);
}

function formatRelative(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (diffMs < minuteMs) return 'just now';
  if (diffMs < hourMs) {
    const mins = Math.round(diffMs / minuteMs);
    return `${mins}m ago`;
  }
  if (diffMs < dayMs) {
    const hrs = Math.round(diffMs / hourMs);
    return `${hrs}h ago`;
  }
  const days = Math.round(diffMs / dayMs);
  if (days <= 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatDateTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function TopicWord({ topic, isActive, onSelect }) {
  const fontSize = clampFont(topic.weight);
  const fontWeight = topic.recencyScore >= 0.85 ? 700 : 500;
  const color = topic.colorHint || '#2563eb';
  const aria = `${topic.topic} • ${topic.count} messages • last active ${formatRelative(topic.lastActive)}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(topic)}
      className={`transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-mint-500 px-1 ${isActive ? 'scale-105' : 'hover:scale-105'}`}
      style={{ fontSize: `${fontSize}px`, fontWeight, color }}
      aria-label={aria}
      title={`${topic.topic}\n${topic.count} messages • last active ${formatRelative(topic.lastActive)}`}
    >
      {topic.topic}
    </button>
  );
}

function MessagePreview({ item }) {
  const roleLabel = item.role === 'assistant'
    ? 'Arthur'
    : item.role === 'user'
      ? 'You'
      : 'System';

  const roleClass = item.role === 'assistant'
    ? 'text-mint-600'
    : item.role === 'user'
      ? 'text-blue-600'
      : 'text-amber-600';

  return (
    <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span className={roleClass}>{roleLabel}</span>
        <span>{formatRelative(item.created_at)}</span>
      </div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
        {item.content || item.summary || '(no content)'}
      </div>
    </div>
  );
}

function SearchResult({ result, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(result)}
      className="w-full text-left rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-mint-500"
    >
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{result.role === 'assistant' ? 'Arthur' : 'You'}</span>
        <span>{formatRelative(result.createdAt)}</span>
      </div>
      <div className="mt-1 text-sm text-gray-800 overflow-hidden" style={{ maxHeight: '4.5rem' }}>
        {result.snippet || '(no content)'}
      </div>
    </button>
  );
}

export default function HistoryExplorer({ onClose }) {
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  const fetchTopics = useCallback(async () => {
    if (!enableTopicCloud) return;
    try {
      setTopicsLoading(true);
      const response = await fetch(`/api/topics/summary?limit=${TOPIC_LIMIT}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTopics(Array.isArray(data.items) ? data.items : []);
      setTopicsError(null);
    } catch (error) {
      setTopicsError(error.message || String(error));
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  const fetchSnapshot = useCallback(async (topic) => {
    if (!topic) {
      setSnapshot(null);
      setSelectedTopic(null);
      return;
    }
    try {
      setSnapshotLoading(true);
      setSnapshotError(null);
      const params = new URLSearchParams({ limit: '200', mode: 'session' });
      const response = await fetch(`/api/topics/${encodeURIComponent(topic.topicId)}/snapshot?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSnapshot(data);
      setSelectedTopic(topic);
    } catch (error) {
      setSnapshotError(error.message || String(error));
      setSnapshot(null);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
    const handler = () => fetchTopics();
    window.addEventListener('timeline:refresh', handler);
    return () => window.removeEventListener('timeline:refresh', handler);
  }, [fetchTopics]);

  const handleTopicSelect = (topic) => {
    fetchSnapshot(topic);
  };

  const handleSearch = async (event) => {
    event?.preventDefault();
    if (!enableTopicSearch) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    try {
      setSearchLoading(true);
      setSearchError(null);
      const params = new URLSearchParams({ q: trimmed, mode: 'keyword', limit: '50' });
      const response = await fetch(`/api/history/search?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSearchResults(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      setSearchError(error.message || String(error));
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleOpenSession = useCallback((sessionId) => {
    if (!sessionId) return;
    try {
      window.dispatchEvent(new CustomEvent('open-session', { detail: { sessionId } }));
    } catch (error) {
      console.warn('Failed to dispatch open-session event', error);
    }
  }, []);

  const handleSearchResultOpen = (result) => {
    handleOpenSession(result.sessionId);
    setShowFullHistory(true);
    setSelectedTopic(null);
    setSnapshot(null);
  };

  const topicCloudContent = useMemo(() => {
    if (!enableTopicCloud) {
      return null;
    }
    if (topicsLoading) {
      return <div className="text-sm text-gray-500 text-center py-8">Loading topics…</div>;
    }
    if (topicsError) {
      return <div className="text-sm text-red-600 text-center py-4">{topicsError}</div>;
    }
    if (!topics.length) {
      return <div className="text-sm text-gray-500 text-center py-8">Start a new conversation to see smart topics.</div>;
    }
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
        {topics.map((topic) => (
          <TopicWord
            key={topic.topicId}
            topic={topic}
            isActive={selectedTopic?.topicId === topic.topicId}
            onSelect={handleTopicSelect}
          />
        ))}
      </div>
    );
  }, [topics, topicsError, topicsLoading, selectedTopic]);

  return (
    <div className="w-96 max-w-full h-full flex flex-col bg-white/90 backdrop-blur-sm border-l border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-mint-700 font-semibold">
          <Sparkles size={18} /> History Explorer
        </div>
        <div className="flex items-center gap-2">
          {enableTopicCloud && (
            <button
              type="button"
              onClick={fetchTopics}
              className="p-2 rounded hover:bg-gray-100 text-gray-600"
              title="Refresh topics"
            >
              <RefreshCw size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 text-gray-600"
            title="Close history"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {enableTopicSearch && (
          <form onSubmit={handleSearch} className="rounded-lg border border-gray-200 bg-white shadow-sm p-3 space-y-2">
            <label htmlFor="history-search" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search chat history</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="history-search"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by keyword…"
                  className="w-full rounded border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 rounded bg-mint-500 text-white text-sm font-medium hover:bg-mint-600"
                disabled={searchLoading}
              >
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
            {searchError && <div className="text-xs text-red-600">{searchError}</div>}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-gray-100">
                {searchResults.map((result) => (
                  <SearchResult key={result.id} result={result} onOpen={handleSearchResultOpen} />
                ))}
              </div>
            )}
          </form>
        )}

        {enableTopicCloud && (
          <section className="rounded-lg border border-gray-200 bg-white shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Smart topics</h3>
              {selectedTopic && (
                <div className="text-xs text-gray-500">
                  Selected • {selectedTopic.count} messages • {formatRelative(selectedTopic.lastActive)}
                </div>
              )}
            </div>
            {topicCloudContent}
          </section>
        )}

        {selectedTopic && (
          <section className="rounded-lg border border-mint-200 bg-mint-50/40 shadow-sm p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-mint-700">{selectedTopic.topic}</h4>
                <p className="text-xs text-mint-600">{selectedTopic.count} messages • updated {formatRelative(selectedTopic.lastActive)}</p>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-mint-600 hover:text-mint-700"
                onClick={() => handleOpenSession(selectedTopic.sessionId)}
              >
                <ExternalLink size={14} /> Open session
              </button>
            </div>

            {snapshotLoading && <div className="text-sm text-gray-500">Loading thread…</div>}
            {snapshotError && <div className="text-sm text-red-600">{snapshotError}</div>}

            {!snapshotLoading && !snapshotError && snapshot?.items?.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {snapshot.items.map((item) => (
                  <MessagePreview key={item.id ?? `${item.bundleId}-${item.created_at}`} item={item} />
                ))}
              </div>
            )}

            {!snapshotLoading && !snapshotError && snapshot?.items?.length === 0 && (
              <div className="text-sm text-gray-500">No messages found for this topic yet.</div>
            )}
          </section>
        )}

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => setShowFullHistory((prev) => !prev)}
          >
            <span>Full chat history</span>
            {showFullHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showFullHistory && (
            <div className="h-96 border-t border-gray-100">
              <UnifiedTimeline embedded className="bg-white" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
