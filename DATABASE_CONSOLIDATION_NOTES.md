# Database Consolidation Notes

## Issue Identified
The project had **5 different SQLite database files** in use across different scripts and services, causing confusion about which database contained what data.

## Database Files Found

1. **`./data/db/ai_local.db`** ✅ **PRIMARY DATABASE** (Server & Production)
   - Used by: backend/server.js, backend/services/db.js
   - Used by: bulk-import-library.js, most migration scripts
   - **This is the correct database for production use**

2. **`./data/db/arthur_local.db`** (Librarian & Tests)
   - Used by: backend/services/Librarian.js
   - Used by: Some older scripts
   - **Should be consolidated with ai_local.db**

3. **`./arthur_local.db`** (Root directory - Old scripts)
   - Used by: generate-synthetic-history.js, init-database.js
   - Legacy location from earlier development

4. **`./data/arthur.db`** (Data directory)
   - Created during troubleshooting
   - Not actively used by any service

5. **`./backend/data/db/ai_local.db`** (Alternate path)
   - Duplicate/symlink of main database

## Resolution

### Current State (✅ FIXED)
- **bulk-import-library.js** now correctly uses `./data/db/ai_local.db`
- Added `metadata` and `tags` columns to `reference_library_chunks` table in the correct database
- **112 book chunks successfully imported** with credibility metadata
- Source credibility system fully operational

### Remaining Consolidation Work
1. **Update Librarian.js** to use `./data/db/ai_local.db` instead of `arthur_local.db`
2. **Update old scripts** to use the primary database path
3. **Clean up unused database files** (after backup)

## Verification Commands

```bash
# Check which database has data
node -e "const db = require('better-sqlite3')('./data/db/ai_local.db'); const count = db.prepare('SELECT COUNT(*) as n FROM reference_library_chunks').get(); console.log('Chunks:', count.n);"

# Check credibility stats
node -e "const db = require('better-sqlite3')('./data/db/ai_local.db'); const stats = db.prepare('SELECT json_extract(metadata, \"$.credibility\") as level, COUNT(*) as count FROM reference_library_chunks GROUP BY level').all(); stats.forEach(s => console.log(s.level + ':', s.count));"
```

## Import Results

✅ **38 books successfully imported** into `reference_library_chunks` table
✅ **Full credibility assessment** for each source:
- HIGH: Scientific research (Cialdini, etc.)
- MODERATE: Evidence-based (Duckworth, Grant, Seligman)
- LOW: Anecdotal/Philosophical (Goggins, Greene)

✅ **Credibility boost** integrated into Librarian 3D scoring
✅ **Metadata stored** for citation disclaimers

Copyright (c) 2025 Scott Crawford. All rights reserved.
