// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { useState } from 'react';
import { X, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function FileUpload({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [knowledgeTier, setKnowledgeTier] = useState('reference_library'); // default tier
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
      // Smart default tier based on filename
      setKnowledgeTier(detectKnowledgeTier(selectedFile.name, selectedFile.type));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer?.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
      // Smart default tier based on filename
      setKnowledgeTier(detectKnowledgeTier(droppedFile.name, droppedFile.type));
    }
  };

  const detectKnowledgeTier = (filename, mimeType) => {
    const name = filename.toLowerCase();
    
    // Core knowledge patterns
    if (name.includes('icf') || name.includes('competenc') || 
        name.includes('framework') || name.includes('standard')) {
      return 'core_knowledge';
    }
    
    // Personal journal patterns
    if ((name.includes('note') || name.includes('journal') || 
         name.includes('diary') || name.includes('log')) &&
        (mimeType.includes('text') || name.endsWith('.md') || name.endsWith('.txt'))) {
      return 'personal_journal';
    }
    
    // Archive patterns
    if (name.includes('tax') || name.includes('legal') || 
        name.includes('receipt') || name.includes('invoice')) {
      return 'archive';
    }
    
    // Default to reference library (books, PDFs, documents)
    return 'reference_library';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setDuplicateInfo(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('knowledgeTier', knowledgeTier);
    formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      // Handle duplicate detection
      if (data.isDuplicate) {
        setDuplicateInfo(data.duplicate);
        setUploading(false);
        return;
      }
      
      setResult(data.file);
      
      // Call onSuccess callback with the acknowledgment
      if (onSuccess && data.file?.acknowledgment) {
        onSuccess({
          fileName: data.file.originalName,
          acknowledgment: data.file.acknowledgment,
          fileId: data.file.fileId
        });
      }
      
      // Auto-close after success (longer delay if there's an acknowledgment to read)
      const delay = data.file?.acknowledgment ? 4000 : 2000;
      setTimeout(() => {
        onClose();
      }, delay);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Upload File</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* File Input */}
        <div className="mb-6">
          <label className="block w-full">
            <div 
              className="border-2 border-dashed border-gray-300 hover:border-mint-400 rounded-lg p-8 text-center cursor-pointer transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">
                {file ? file.name : 'Click to select file or drag and drop'}
              </p>
              <p className="text-sm text-gray-400">
                Supports: Documents, Images, Audio, Video, Archives
              </p>
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept="*/*"
              />
            </div>
          </label>
        </div>

        {/* Knowledge Tier Selection */}
        {file && (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What type of content is this?
              </label>
              <div className="space-y-2">
                <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-mint-500 has-[:checked]:bg-mint-50">
                  <input
                    type="radio"
                    name="knowledgeTier"
                    value="core_knowledge"
                    checked={knowledgeTier === 'core_knowledge'}
                    onChange={(e) => setKnowledgeTier(e.target.value)}
                    className="mr-3 mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">🎯 Core Knowledge</p>
                    <p className="text-sm text-gray-500">
                      Always search this content (frameworks, competencies, standards)
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-mint-500 has-[:checked]:bg-mint-50">
                  <input
                    type="radio"
                    name="knowledgeTier"
                    value="personal_journal"
                    checked={knowledgeTier === 'personal_journal'}
                    onChange={(e) => setKnowledgeTier(e.target.value)}
                    className="mr-3 mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">📔 Personal Journal</p>
                    <p className="text-sm text-gray-500">
                      Track patterns over time (notes, reflections, wellness data)
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-mint-500 has-[:checked]:bg-mint-50">
                  <input
                    type="radio"
                    name="knowledgeTier"
                    value="reference_library"
                    checked={knowledgeTier === 'reference_library'}
                    onChange={(e) => setKnowledgeTier(e.target.value)}
                    className="mr-3 mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">📚 Reference Library</p>
                    <p className="text-sm text-gray-500">
                      Search when relevant (books, articles, long-form content)
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-mint-500 has-[:checked]:bg-mint-50">
                  <input
                    type="radio"
                    name="knowledgeTier"
                    value="archive"
                    checked={knowledgeTier === 'archive'}
                    onChange={(e) => setKnowledgeTier(e.target.value)}
                    className="mr-3 mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">🗄️ Archive Only</p>
                    <p className="text-sm text-gray-500">
                      Store but don't auto-search (legal docs, receipts, backups)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Tags Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (optional, comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., work, important, reference"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none"
              />
            </div>

            {/* Duplicate Warning */}
            {duplicateInfo && (
              <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle size={24} className="text-yellow-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 mb-2">⚠️ Duplicate File Detected</p>
                    <p className="text-sm text-yellow-800 mb-2">
                      This file appears to be identical to <strong>{duplicateInfo.existingFile}</strong>, 
                      which was uploaded on {new Date(duplicateInfo.uploadedOn).toLocaleDateString()}.
                    </p>
                    <p className="text-sm text-yellow-700">
                      Tier: <span className="font-medium">{duplicateInfo.tier}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                  >
                    Cancel Upload
                  </button>
                  <button
                    onClick={() => {
                      setDuplicateInfo(null);
                      // Could implement "upload anyway" logic here if needed
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                  >
                    View Existing File
                  </button>
                </div>
              </div>
            )}

            {/* Result/Error */}
            {result && (
              <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 mb-2">Upload successful!</p>
                  {result.acknowledgment && (
                    <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                      {result.acknowledgment}
                    </p>
                  )}
                  <p className="text-xs text-green-600">
                    File ID: {result.fileId} • Status: {result.status}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={24} className="text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800">Upload failed</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 px-6 py-3 bg-mint-500 hover:bg-mint-600 disabled:bg-gray-300 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Upload
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
