# Reference Library Import Guide

This guide explains how to bulk import your books and documents into ARTHUR's reference library for instant semantic search.

---

## Quick Start

### Option 1: Using the Helper Scripts

**Windows:**
```bash
import-library.bat "./path/to/your/books"
```

**Mac/Linux:**
```bash
chmod +x import-library.sh
./import-library.sh "./path/to/your/books"
```

### Option 2: Direct Node Command

```bash
node backend/scripts/bulk-import-library.js "./path/to/your/books"
```

---

## Step-by-Step Process

### 1. Prepare Your Books

**Supported formats:**
- ✅ `.md` (Markdown)
- ✅ `.txt` (Plain text)
- ✅ `.pdf` (PDF documents)
- ✅ `.epub` (eBooks)

**Convert EPUB/PDF to Markdown (Recommended):**

```bash
# Place books in converter input folder
cp your-books/*.epub "./DOCUMENT _TO_MD_CONVERTER V1/input_docs/"

# Run conversion
cd "./DOCUMENT _TO_MD_CONVERTER V1"
python batch_doc_to_md.py

# Converted files will be in output_md/
```

### 2. Organize Your Library

**Recommended structure:**
```
my-library/
├── leadership/
│   ├── Atomic Habits by James Clear.md
│   └── Deep Work by Cal Newport.md
├── psychology/
│   ├── Thinking Fast and Slow by Daniel Kahneman.md
│   └── Influence by Robert Cialdini.md
└── productivity/
    ├── Getting Things Done by David Allen.md
    └── The 4-Hour Workweek by Tim Ferriss.md
```

**File naming conventions:**
- `"Title by Author.md"` → Auto-extracts author
- `"Title_ Subtitle by Author EPUB.md"` → Cleans up automatically
- Underscores converted to spaces

### 3. Run the Import

```bash
# Import all books from a directory
node backend/scripts/bulk-import-library.js "./my-library"

# The script will:
# ✅ Scan directory recursively
# ✅ Extract metadata (title, author, category)
# ✅ Chunk large books into 2000-token pieces
# ✅ Generate embeddings for semantic search
# ✅ Detect and skip duplicates
# ✅ Store in reference_documents table
```

---

## What the Import Does

### Intelligent Chunking

Large books are split into chunks with:
- **Max size**: 2000 tokens (~8000 characters)
- **Overlap**: 200 tokens between chunks (preserves context)
- **Smart splitting**: Chunks on chapter/section boundaries

**Example:**
```
"Atomic Habits by James Clear.md" (150,000 words)
↓ Chunked into
- Atomic Habits (Part 1)   [Introduction + Chapter 1-3]
- Atomic Habits (Part 2)   [Chapter 4-7]
- Atomic Habits (Part 3)   [Chapter 8-11]
- ... (15 chunks total)
```

### Metadata Extraction

Automatically extracts:
- **Title**: From filename
- **Author**: From "Title by Author" pattern
- **Category**: Inferred from content keywords
  - Leadership, Productivity, Psychology, Business, Science, Health
- **Tags**: Auto-generated
  - Default: `['reference', 'imported', 'bulk-upload']`
  - Category: `'productivity'`
  - Author: `'james-clear'`

### Semantic Search Embeddings

Each chunk gets a vector embedding:
- **Model**: `text-embedding-3-small`
- **Dimensions**: 1536
- **Use case**: Find relevant content via semantic similarity

### Duplicate Detection

Prevents re-importing:
- Calculates SHA-256 hash of content
- Checks database before importing
- Skips if already exists

---

## Configuration

Edit `backend/scripts/bulk-import-library.js` to customize:

```javascript
const CONFIG = {
  maxChunkSize: 2000,        // Tokens per chunk
  overlapSize: 200,          // Token overlap
  batchSize: 10,             // Files per batch
  delayBetweenBatches: 1000, // ms between batches
  supportedExtensions: ['.md', '.txt', '.pdf', '.epub'],
  defaultTags: ['reference', 'imported', 'bulk-upload']
};
```

---

## Output Example

```
📚 ARTHUR Reference Library Bulk Import

Source: ./my-library
Database: ./data/db/ai_local.db

Found 12 files to process

📦 Processing batch 1/2
────────────────────────────────────────────────────────────

📄 Atomic Habits by James Clear.md
   📝 Created 15 chunks
   🔄 Processing chunk 15/15...
   ✅ Imported 15 chunks

📄 Deep Work by Cal Newport.md
   📝 Created 12 chunks
   🔄 Processing chunk 12/12...
   ✅ Imported 12 chunks

...

════════════════════════════════════════════════════════════
📊 IMPORT SUMMARY
════════════════════════════════════════════════════════════
Files processed:     12
Files skipped:       0 (duplicates)
Chunks created:      187
Embeddings generated: 187
Errors:              0
Duration:            45.3s
════════════════════════════════════════════════════════════

✅ Import complete! Your reference library is now searchable.
💡 Try asking Arthur about topics from your imported books.
```

---

## How It's Used in ARTHUR

Once imported, your books are automatically searched when:

1. **Context Knight** requests relevant context
   ```javascript
   // User asks: "How do I build better habits?"
   // Context Knight queries reference_documents
   // Finds chunks from "Atomic Habits" with high semantic similarity
   ```

2. **3D Relevance Scoring** ranks results
   ```
   Semantic:  0.92 (highly relevant to "habits")
   Recency:   1.00 (just imported)
   Frequency: 0.00 (not yet referenced)
   Vehemence: 0.50 (neutral)
   ───────────────────────────────────────
   Total:     0.74 (very relevant!)
   ```

3. **Arthur synthesizes response**
   ```
   "Based on 'Atomic Habits' by James Clear in your reference library,
   building better habits involves four key laws..."
   ```

---

## Query Your Library

After import, you can ask:

**General queries:**
- "What does Atomic Habits say about habit formation?"
- "Summarize the key ideas from Deep Work"
- "What productivity techniques are in my library?"

**Cross-book synthesis:**
- "Compare the habit formation strategies in my library"
- "What do my leadership books say about delegation?"

**Author-specific:**
- "What books by Cal Newport do I have?"
- "Summarize all content from James Clear"

---

## Troubleshooting

### No files found
**Problem**: Script reports 0 files
**Solution**: Check file extensions (.md, .txt, .pdf, .epub)

### Embedding errors
**Problem**: "Embedding generation failed"
**Solution**: Check OpenAI API key in `.env`
```bash
OPENAI_API_KEY=sk-...
```

### Duplicate skipped
**Problem**: "Skipped (duplicate: Title)"
**Solution**: File already imported. Delete from DB to re-import:
```sql
DELETE FROM reference_documents WHERE title LIKE '%Title%';
```

### Large files timing out
**Problem**: Very large PDFs fail
**Solution**: 
1. Convert to Markdown first
2. Or increase `maxChunkSize` in config

---

## Advanced Usage

### Import specific categories

```bash
# Leadership books only
node backend/scripts/bulk-import-library.js "./library/leadership"

# All categories
node backend/scripts/bulk-import-library.js "./library"
```

### Re-import with new embeddings

```sql
-- Clear existing imports
DELETE FROM reference_documents WHERE tags LIKE '%bulk-upload%';

-- Re-run import
node backend/scripts/bulk-import-library.js "./library"
```

### Check what's imported

```sql
-- Count imported documents
SELECT COUNT(*) FROM reference_documents;

-- List all books
SELECT title, file_type, upload_date 
FROM reference_documents 
ORDER BY upload_date DESC;

-- Find specific book
SELECT * FROM reference_documents 
WHERE title LIKE '%Atomic Habits%';
```

---

## Performance Tips

1. **Convert to Markdown first** - Much faster than PDF processing
2. **Import during off-hours** - OpenAI embeddings have rate limits
3. **Batch small files** - Process 10-20 files at a time
4. **Monitor token usage** - Each chunk = 1 embedding API call

---

## Cost Estimation

**OpenAI Embeddings Pricing** (as of 2025):
- `text-embedding-3-small`: $0.00002 per 1K tokens

**Example calculation:**
```
12 books × 15 chunks each = 180 chunks
180 chunks × 2000 tokens = 360,000 tokens
360,000 / 1000 × $0.00002 = $0.0072 (less than 1 cent!)
```

Very affordable for personal libraries! 📚💰

---

## Summary

**To import your books:**

1. Convert to Markdown (if needed)
2. Run: `node backend/scripts/bulk-import-library.js "./path/to/books"`
3. Wait for embeddings to generate
4. Ask Arthur questions about your books!

**Benefits:**
- ✅ Instant semantic search across entire library
- ✅ Context-aware responses using your books
- ✅ No need for external searches
- ✅ Private, local-first knowledge base

**Your books become Arthur's knowledge!** 🧠📚

---

## Next Steps

After importing:
1. Try asking Arthur about topics from your books
2. Check the terminal logs to see 3D relevance scoring
3. Monitor which books get referenced most (frequency score)
4. Add more books as you read them!

Happy reading! 📖✨
