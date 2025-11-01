// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { useEffect, useRef, useState, useMemo } from 'react';
import { Clock, Bot, User, Info, RefreshCw, ChevronDown, ChevronUp, Archive } from 'lucide-react';

export default function UnifiedTimeline({ embedded = false, className = '' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState(null);

  // Centralized fetch function reused by button/event/poll
  const fetchTimeline = async () => {
    // Abort any in-flight request
    if (controllerRef.current) controllerRef.current.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    try {
      setLoading(true);
      const resp = await fetch('/api/history/timeline?limit=100', { signal: ctrl.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const rawItems = Array.isArray(data.timeline) ? data.timeline : (data.items || []);
      const normalized = rawItems.map((it) => ({
        id: it.id,
        session_id: it.session_id || it.sessionId,
        role: it.role || (it.itemType === 'bundle' || it.item_type === 'bundle' ? 'bundle' : 'assistant'),
        item_type: it.itemType || it.item_type || 'message',
        message_count: it.messageCount || it.message_count || null,
        title: it.title,
        summary: it.summary,
        created_at: it.created_at || it.timestamp,
        content_preview: it.content_preview || it.summary || it.title || it.content || '(no content)'
      }));
      setItems(normalized);
      setError(null);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchTimeline();
    const onRefresh = () => mounted && fetchTimeline();
    window.addEventListener('timeline:refresh', onRefresh);
    const poll = setInterval(() => mounted && fetchTimeline(), 60000);
    return () => {
      mounted = false;
      window.removeEventListener('timeline:refresh', onRefresh);
      clearInterval(poll);
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  const grouped = useMemo(() => {
    const byDay = new Map();
    for (const it of items) {
      const d = it.created_at ? new Date(it.created_at) : new Date();
      const key = d.toDateString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(it);
    }
    // Keep original order (assumed recency-first), but grouped headings
    const arr = [];
    for (const [day, list] of byDay.entries()) {
      arr.push({ __type: 'day', day });
      for (const it of list) arr.push(it);
    }
    return arr;
  }, [items]);

  const iconForItem = (item) => {
    if (item.item_type === 'bundle') return <Archive size={16} className="text-amber-600"/>;
    if (item.role === 'assistant') return <Bot size={16} className="text-mint-600"/>;
    if (item.role === 'user') return <User size={16} className="text-gray-600"/>;
    return <Info size={16} className="text-blue-600"/>;
  };

  const timeLabel = (ts) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  const loadSnapshot = async (messageId) => {
    if (!messageId) return;
    setSnapError(null);
    setSnapLoading(true);
    setSelectedId(messageId);
    try {
      const resp = await fetch(`/api/history/snapshot/${encodeURIComponent(messageId)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setSnapshot(data);
    } catch (e) {
      setSnapError(e.message || String(e));
      setSnapshot(null);
    } finally {
      setSnapLoading(false);
    }
  };

  const containerClasses = embedded
    ? `w-full h-full flex flex-col bg-white ${className}`.trim()
    : `w-96 max-w-full h-full flex flex-col bg-white/80 backdrop-blur-sm border-l border-gray-200 ${className}`.trim();

  return (
    <div className={containerClasses}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-mint-700 font-semibold">
          <Clock size={18} /> Unified Timeline
        </div>
        <button
          onClick={fetchTimeline}
          className="p-2 rounded hover:bg-gray-100 text-gray-600"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-500">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-500">No activity yet.</div>
        ) : (
          <div className="space-y-2">
            {grouped.map((it, idx) => it.__type === 'day' ? (
              <div key={`day-${it.day}-${idx}`} className="flex items-center justify-center py-1">
                <div className="text-[11px] text-gray-500 bg-white/70 px-3 py-1 rounded-full shadow-sm">
                  {it.day}
                </div>
              </div>
            ) : (
              <div
                key={it.id || idx}
                className={`flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer ${selectedId === it.id ? 'bg-gray-50' : ''}`}
                onClick={() => loadSnapshot(it.id)}
              >
                <div className="mt-0.5">{iconForItem(it)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-500" title={it.created_at ? new Date(it.created_at).toLocaleString() : ''}>
                      {timeLabel(it.created_at)}
                    </div>
                    {it.session_id && (
                      <div className="text-[10px] text-gray-400">S:{String(it.session_id).slice(-6)}</div>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 truncate flex items-center gap-1">
                    <span className="truncate">
                      {it.item_type === 'bundle' && it.message_count ? `🗂️ ${it.message_count} msgs · ` : ''}
                      {it.title || it.content_preview || '(no content)'}
                    </span>
                    {selectedId === it.id ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-300"/>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot drawer */}
      <div className="border-t border-gray-200 max-h-60 overflow-y-auto bg-white/90" style={{ display: selectedId ? 'block' : 'none' }}>
        {snapLoading ? (
          <div className="p-3 text-sm text-gray-500">Loading context…</div>
        ) : snapError ? (
          <div className="p-3 text-sm text-red-600">{snapError}</div>
        ) : snapshot ? (
          <div className="p-3 space-y-2">
            {snapshot.anchor?.itemType === 'bundle' && (
              <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded p-2">
                <div className="font-semibold">Archived segment</div>
                <div>{snapshot.anchor.summary}</div>
                {snapshot.anchor.range?.start && snapshot.anchor.range?.end && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    {new Date(snapshot.anchor.range.start).toLocaleString()} → {new Date(snapshot.anchor.range.end).toLocaleString()}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500">Session: {snapshot.anchor?.sessionId ? String(snapshot.anchor.sessionId).slice(-12) : '-'}</div>
              {snapshot.anchor?.sessionId && (
                <button
                  className="text-xs px-2 py-1 rounded bg-mint-500 text-white hover:bg-mint-600"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent('open-session', { detail: { sessionId: snapshot.anchor.sessionId } }));
                    } catch {}
                  }}
                  title="Open this session in chat"
                >
                  Open in Chat
                </button>
              )}
            </div>
            {(snapshot.messages || []).map((m, i) => (
              <div key={m.id || `${snapshot.anchor?.id || 'bundle'}-${i}`} className="text-sm">
                <div className="text-[11px] text-gray-400 mb-0.5">
                  {m.role || 'assistant'} · {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                </div>
                <div className={`p-2 rounded ${(m.role || 'assistant') === 'assistant' ? 'bg-gray-50' : 'bg-white border'}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
