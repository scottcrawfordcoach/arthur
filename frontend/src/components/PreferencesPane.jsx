import { useState } from 'react';
import { X, Save } from 'lucide-react';

export default function PreferencesPane({
  preferences,
  onUpdate,
  onClose
}) {
  const [localPrefs, setLocalPrefs] = useState({
    userName: preferences.userName || '',
    userContext: preferences.userContext || '',
    responseStyle: preferences.responseStyle || 'balanced',
    autoWebSearch: preferences.autoWebSearch || 'auto',
    ...preferences
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each preference
      for (const [key, value] of Object.entries(localPrefs)) {
        await onUpdate(key, value);
      }
      
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Preferences</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* User Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={localPrefs.userName}
              onChange={(e) => setLocalPrefs({ ...localPrefs, userName: e.target.value })}
              placeholder="How should I address you?"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none"
            />
          </div>

          {/* User Context */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context About You
            </label>
            <textarea
              value={localPrefs.userContext}
              onChange={(e) => setLocalPrefs({ ...localPrefs, userContext: e.target.value })}
              placeholder="Tell me about yourself, your goals, preferences, or anything that helps me assist you better..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none resize-none"
              rows={5}
            />
            <p className="text-sm text-gray-500 mt-1">
              This information will be used to personalize responses and improve context recall.
            </p>
          </div>

          {/* Response Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Style
            </label>
            <select
              value={localPrefs.responseStyle}
              onChange={(e) => setLocalPrefs({ ...localPrefs, responseStyle: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none"
            >
              <option value="concise">Concise - Short and to the point</option>
              <option value="balanced">Balanced - Moderate detail</option>
              <option value="detailed">Detailed - Thorough explanations</option>
              <option value="conversational">Conversational - Friendly and casual</option>
            </select>
          </div>

          {/* Web Search Preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Web Search
            </label>
            <select
              value={localPrefs.autoWebSearch}
              onChange={(e) => setLocalPrefs({ ...localPrefs, autoWebSearch: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none"
            >
              <option value="auto">Automatic - Let AI decide</option>
              <option value="always">Always - Search web for every query</option>
              <option value="never">Never - Only use local knowledge</option>
            </select>
          </div>

          {/* Memory & Recall */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Memory & Context
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={localPrefs.enableMemory !== false}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, enableMemory: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Enable semantic memory (recall relevant past conversations)
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={localPrefs.enableFileRecall !== false}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, enableFileRecall: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Enable file content recall
                </span>
              </label>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={localPrefs.additionalNotes || ''}
              onChange={(e) => setLocalPrefs({ ...localPrefs, additionalNotes: e.target.value })}
              placeholder="Any other preferences or instructions for the assistant..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-mint-400 focus:outline-none resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-mint-500 hover:bg-mint-600 disabled:bg-gray-300 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
