// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function ProjectsPane({
  projectBuckets = [],
  activeProjectBucket,
  currentSessionId,
  onUpdateBucket,
  onUploadBucketFile,
  onDeleteBucketFile,
  onActivateBucket,
  onClearActiveBucket,
  onClose
}) {
  const [bucketStates, setBucketStates] = useState(() => mapBuckets(projectBuckets));
  const [saving, setSaving] = useState({});
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setBucketStates(mapBuckets(projectBuckets));
  }, [projectBuckets]);

  const handleFieldChange = (slot, field, value) => {
    setBucketStates((prev) =>
      prev.map((bucket) =>
        bucket.slot === slot ? { ...bucket, [field]: value } : bucket
      )
    );
  };

  const handleSaveDetails = async (slot) => {
    if (!onUpdateBucket) return;
    const target = bucketStates.find((bucket) => bucket.slot === slot);
    if (!target) return;

    setSaving((prev) => ({ ...prev, [slot]: true }));
    setErrors((prev) => ({ ...prev, [slot]: null }));

    try {
      await onUpdateBucket(slot, {
        name: target.name,
        description: target.description
      });
    } catch (error) {
      setErrors((prev) => ({ ...prev, [slot]: error.message }));
    } finally {
      setSaving((prev) => ({ ...prev, [slot]: false }));
    }
  };

  const handleUpload = async (slot, file) => {
    if (!file || !onUploadBucketFile) return;
    setUploading((prev) => ({ ...prev, [slot]: true }));
    setErrors((prev) => ({ ...prev, [slot]: null }));

    try {
      await onUploadBucketFile(slot, file);
    } catch (error) {
      setErrors((prev) => ({ ...prev, [slot]: error.message }));
    } finally {
      setUploading((prev) => ({ ...prev, [slot]: false }));
    }
  };

  const handleRemoveFile = async (slot, associationId) => {
    if (!onDeleteBucketFile) return;
    setErrors((prev) => ({ ...prev, [slot]: null }));
    try {
      await onDeleteBucketFile(slot, associationId);
    } catch (error) {
      setErrors((prev) => ({ ...prev, [slot]: error.message }));
    }
  };

  const handleActivate = async (slot) => {
    if (!onActivateBucket || !currentSessionId) return;
    setErrors((prev) => ({ ...prev, [slot]: null }));
    try {
      await onActivateBucket(slot);
    } catch (error) {
      setErrors((prev) => ({ ...prev, [slot]: error.message }));
    }
  };

  const handleClear = async () => {
    if (!onClearActiveBucket || !activeProjectBucket || !currentSessionId) return;
    try {
      await onClearActiveBucket();
    } catch (error) {
      console.error('Failed to clear active bucket:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Project Buckets</h2>
            <p className="text-sm text-gray-500 mt-1">
              Load specific project context, instructions, and up to 20 reference files per bucket.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {currentSessionId
              ? activeProjectBucket
                ? `Active bucket for this chat: ${activeProjectBucket.name || `Project ${activeProjectBucket.slot}`}`
                : 'No project bucket is active for this chat yet.'
              : 'Open or start a chat to activate a project bucket.'}
          </div>
          {currentSessionId && activeProjectBucket && (
            <button
              onClick={handleClear}
              className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear Active Bucket
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {bucketStates.map((bucket) => {
            const isActive = activeProjectBucket && activeProjectBucket.slot === bucket.slot;
            return (
              <div
                key={bucket.slot}
                className={`border rounded-xl p-5 transition-shadow bg-white ${
                  isActive ? 'border-mint-400 shadow-lg shadow-mint-100/40' : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-800">Bucket {bucket.slot}</h3>
                        {isActive && (
                          <span className="text-xs uppercase tracking-wide bg-mint-100 text-mint-600 px-2 py-1 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {bucket.files.length} / 20 files linked
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleSaveDetails(bucket.slot)}
                        disabled={saving[bucket.slot]}
                        className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                      >
                        {saving[bucket.slot] ? 'Saving…' : 'Save Details'}
                      </button>
                      <button
                        onClick={() => handleActivate(bucket.slot)}
                        disabled={!currentSessionId}
                        className="px-3 py-1 text-xs border border-mint-400 text-mint-600 rounded-lg hover:bg-mint-50 disabled:opacity-50"
                      >
                        Set Active
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <input
                      type="text"
                      value={bucket.name}
                      onChange={(e) => handleFieldChange(bucket.slot, 'name', e.target.value)}
                      placeholder={`Project ${bucket.slot}`}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none"
                    />
                    <textarea
                      value={bucket.description}
                      onChange={(e) => handleFieldChange(bucket.slot, 'description', e.target.value)}
                      placeholder="Provide instructions, goals, or prompts for this project"
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none resize-none"
                      rows={3}
                    />

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        Reference Files
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleUpload(bucket.slot, file);
                              e.target.value = '';
                            }
                          }}
                          className="text-xs"
                          disabled={uploading[bucket.slot] || bucket.files.length >= 20}
                        />
                        {uploading[bucket.slot] && (
                          <span className="text-xs text-gray-500">Uploading…</span>
                        )}
                      </div>
                      <ul className="mt-3 space-y-2 max-h-44 overflow-y-auto pr-1">
                        {bucket.files.map((file) => (
                          <li
                            key={file.association_id}
                            className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg"
                          >
                            <div className="flex-1 min-w-0 pr-3">
                              <p className="font-medium text-gray-700 truncate" title={file.original_name}>
                                {file.original_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {file.conversion_status === 'completed' ? 'Ready' : file.conversion_status || 'Processing'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveFile(bucket.slot, file.association_id)}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                        {bucket.files.length === 0 && (
                          <li className="text-xs text-gray-400">
                            No files linked yet. Upload briefs, notes, or assets to prime this project.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {errors[bucket.slot] && (
                    <p className="text-xs text-red-500">{errors[bucket.slot]}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-200 text-sm text-gray-500 bg-gray-50 rounded-b-2xl">
          Tip: Once a project is active, just say "Let's work on &lt;name&gt;" or start giving instructions—the assistant will automatically pull in those files.
        </div>
      </div>
    </div>
  );
}

function mapBuckets(buckets) {
  const bySlot = new Map((buckets || []).map((bucket) => [bucket.slot, bucket]));
  const mapped = [];
  for (let slot = 1; slot <= 4; slot++) {
    const bucket = bySlot.get(slot) || {
      slot,
      id: null,
      name: `Project ${slot}`,
      description: '',
      files: []
    };
    mapped.push({
      id: bucket.id,
      slot,
      name: bucket.name || `Project ${slot}`,
      description: bucket.description || '',
      files: bucket.files || []
    });
  }
  return mapped;
}
