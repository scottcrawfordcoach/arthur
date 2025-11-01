# 📚 Reference Library

This is your personal reference library managed by the Librarian system.

## 📁 Folder Structure

Each category contains markdown files with YAML frontmatter metadata:

```
LIBRARY/
├── LIBRARY_INDEX.md          ← Master index (start here!)
├── LIBRARY_INDEX.json         ← Machine-readable index
├── AI_AMA/                    ← AI and Machine Learning content
├── BLOGS/                     ← Blog posts and articles
├── CLIENT_HANDOUTS/           ← Client educational materials
├── NEWSLETTERS/               ← Newsletter content
├── REFERENCE_MATERIAL/        ← General reference materials
└── SOCIAL_POSTS/              ← Social media content
```

## 🚀 Quick Start

### View Your Library
1. **Open LIBRARY_INDEX.md** - Browse all your documents
2. **Click any link** - Opens the full document
3. **Search with Ctrl+F** - Find anything quickly

### Add New Documents
```bash
# From project root
python librarian.py add "document.pdf"

# Bulk import
python librarian.py import "folder/" --recursive
```

### Search
```bash
# Full-text search
python librarian.py search "machine learning"

# Search in this folder
grep -r "search term" .
```

## 📝 File Format

Every document is a markdown file with YAML frontmatter:

```markdown
---
title: Document Title
category: AI_AMA
tags: [machine-learning, important]
keywords: [neural networks, transformers]
date_added: '2025-10-07T10:30:00'
summary: Brief description...
---

# Document Title

[Content here...]
```

## 🔗 Use With

- **Obsidian** - Open this folder as a vault
- **VS Code** - Full-text search, markdown preview
- **Git** - Track changes over time
- **Any text editor** - Plain markdown, works everywhere

## 🔄 Update Index

When you add new documents:

```bash
python librarian.py update-index
```

## 🌐 Cloud Sync

Backup to Supabase:

```bash
python librarian.py sync
```

---

**All files are portable markdown. Your knowledge, your format.** 📚✨
