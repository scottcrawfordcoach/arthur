# Library Sync Workflow

## Overview
Your **local LIBRARY/ folder** is the single source of truth for all reference materials. Keep it organized here, then sync to Supabase for semantic search.

---

## The Workflow

### 1. **Organize Locally** 📁
- Add/edit/reorganize files in `LIBRARY/`
- Maintain clean folder structure:
  ```
  LIBRARY/
  ├── AI_AMA/
  ├── BLOGS/
  ├── NEWSLETTERS/
  ├── REFERENCE_MATERIAL/
  │   ├── BOOKS/
  │   ├── ICF_GUIDELINES/
  │   ├── COACHING_MATERIALS/
  │   └── ...
  ```

### 2. **Sync to Supabase (Semantic Search)** 🔍
When ready to update Scottbot's knowledge:

```powershell
# From LIBRARIAN_PROJECT directory:
python batch_sync_library.py
```

**What this does:**
- ✅ Chunks documents (50-500 tokens)
- ✅ Generates embeddings (OpenAI text-embedding-3-small)
- ✅ Uploads to Supabase **database** for semantic search
- ⏭️ **Skips** Supabase Storage upload (you handle manually)

**Cost:** ~$0.003 per document for embeddings

### 3. **Optional: Manual Storage Upload** ☁️
Only when you want files backed up in Supabase Storage:

1. Open [Supabase Dashboard → Storage](https://supabase.com/dashboard)
2. Navigate to `scott-repo` bucket
3. **Drag and drop** your entire `LIBRARY/` folder
4. Supabase preserves your folder structure automatically

**When to do this:**
- After major reorganization (like today!)
- Monthly backups
- Before testing new features
- Whenever you feel like it 🎯

---

## Key Benefits

✅ **Local control:** Organize files however you want  
✅ **Fast updates:** Drag/drop when convenient  
✅ **No sync conflicts:** Manual = intentional  
✅ **Semantic search:** Database sync enables Scottbot queries  
✅ **Cost efficient:** Only generate embeddings when needed  

---

## Current State

📊 **Local Files:** 166 markdown documents  
📊 **Supabase Database:** 166 documents (chunks + embeddings)  
📊 **Supabase Storage:** Manual upload (you control timing)

### Categories:
- AI_AMA: 2
- BLOGS: 25 (voice samples)
- NEWSLETTERS: 18 (voice samples)
- CLIENT_HANDOUTS: 12
- REFERENCE_MATERIAL: 109

---

## Quick Reference

### View your library index:
```powershell
# Generate fresh index anytime:
python generate_library_index.py

# Then open:
LIBRARY/LIBRARY_INDEX.md
```

### Count documents:
```powershell
python quick_count.py
```

### Test Scottbot search:
```powershell
python test_scottbot_pipeline.py
```

---

## Tips

💡 **Add new files:** Just drop them in appropriate folder → run `batch_sync_library.py`  
💡 **Reorganize:** Move files around locally → run `batch_sync_library.py` → done!  
💡 **Backup:** Drag/drop entire LIBRARY/ to Supabase Storage whenever  
💡 **Voice samples:** BLOGS/ and NEWSLETTERS/ auto-marked for Scottbot tone learning  

---

*Last updated: October 2025 - After successful reorganization and cleanup!* 🎉
