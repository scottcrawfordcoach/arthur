🧠 ScottBot Local – Unified AI Assistant & Data Recall System

A local-first AI workspace for journaling, data conversion, tagging, and semantic recall —
built to mirror the full ScottBot / Arthur Supabase backend.

Acts as a test rig for data persistence, context retrieval, and local RAG operations
before cloud migration.

🏗️ Overview

ScottBot Local is a self-contained development environment that simulates
how the Supabase-based ScottBot platform will eventually behave.
It runs entirely on localhost, with the following goals:

Convert & store data (files, notes, journal entries, etc.)

Tag & embed everything for semantic recall

Retrieve contextually relevant information during conversations

Summarize & archive chat histories and content over time

Maintain preferences & memory about the user’s working style

Operate as a local AI assistant with ChatGPT-like UI and live file handling

Once complete, this project becomes your proof-of-concept for persistence, retrieval, and context chaining —
the backbone of both ScottBot Journal and Arthur Roundtable architectures.

🧩 Tech Stack
Layer	Tool	Purpose
Frontend	React + Vite + TailwindCSS	ChatGPT-style UI with file upload and chat history
Backend	Node.js + Express	API for chat, DB, embeddings, and converter
Database	SQLite (Drizzle ORM)	Local mirror of Supabase schema
Embeddings	OpenAI Embeddings API	Local vector index for recall
Models	GPT-4o-mini (retrieval) + GPT-5 (response)	Two-stage reasoning chain
Storage	Local /buckets folders	File and output storage
Converter	Python scripts	Multi-file converter and AI metadata extractor
🧱 Folder Structure
scottbot-local/
│
├── frontend/                      # React + Tailwind chat interface
│   ├── src/components/
│   │   ├── ChatWindow.jsx
│   │   ├── Sidebar.jsx
│   │   ├── FileUpload.jsx
│   │   ├── PreferencesPane.jsx
│   │   └── HistoryList.jsx
│   ├── src/pages/App.jsx
│   ├── src/main.jsx
│   └── index.html
│
├── backend/
│   ├── server.js                  # Express app entrypoint
│   ├── routes/
│   │   ├── chat.js                # Handles messages + recall
│   │   ├── files.js               # Upload, convert, tag
│   │   ├── preferences.js         # User prefs CRUD
│   │   ├── embeddings.js          # Vector retrieval endpoints
│   │   └── archive.js             # Summaries + compression
│   ├── services/
│   │   ├── db.js                  # SQLite init via Drizzle
│   │   ├── embeddings.js          # OpenAI vector ops
│   │   ├── recallEngine.js        # Local semantic search
│   │   ├── summarizer.js          # Context summarization
│   │   ├── fileManager.js         # Local bucket operations
│   │   ├── chatMemory.js          # Session recall + archiving
│   │   └── preferences.js         # Memory of user interaction style
│   ├── models/
│   │   ├── schema_local.sql       # Unified schema (included)
│   │   └── drizzle.config.ts      # Optional ORM setup
│   └── config.json
│
├── converter/                     # File ingestion and conversion
│   ├── main.py                    # Multi-file converter
│   ├── handlers/                  # Markdown, YAML, Audio, OCR, etc.
│   └── utils/                     # Shared helpers
│
├── buckets/                       # Local storage zones
│   ├── inbox/
│   ├── converted/
│   ├── processed/
│   ├── archive/
│   ├── outputs/
│   └── media/
│
├── data/db/
│   └── ai_local.db                # SQLite database
│
├── .env
├── package.json
└── README.md

⚙️ Environment Configuration

.env

OPENAI_API_KEY=your-key-here
MODEL_FAST=gpt-4o-mini
MODEL_MAIN=gpt-5
DATABASE_URL=./data/db/ai_local.db
BUCKET_PATH=./buckets
CONVERTER_PATH=./converter

🧠 Database Setup

Load the unified schema into SQLite:

sqlite3 ./data/db/ai_local.db < backend/models/schema_local.sql


This creates:

All core Supabase tables (wellness, journaling, goals, preferences, library, etc.)

All assistant extensions (files, chunks, chat sessions, embeddings, archives, etc.)

🧰 Core Features
1️⃣ Conversational Chat UI

ChatGPT-like design with pastel colors (mint/blue/cream)

Sidebar for chat history and file upload

New chat button and message threading

Editable Preferences pane (user notes, style, goals)

2️⃣ File Handling & Conversion

Upload any file (Markdown, text, image, audio, PDF)

Assistant asks how to process it:

“Convert to reference file”

“Store for safekeeping”

“Use for current query only”

Converted files written to /buckets/converted/ and indexed in DB

3️⃣ Semantic Storage & Recall

Texts and file chunks embedded via OpenAI embeddings

Local recall engine performs cosine similarity search

GPT-4o-mini handles retrieval → GPT-5 composes final answer

4️⃣ Persistent Chat History

Each chat = assistant_chat_session

Each message stored in assistant_chat_messages

Older chats auto-summarized into assistant_archive

5️⃣ User Preferences

Live table assistant_preferences tracks user tone, context, interaction notes

Used for contextual response shaping

6️⃣ Local Buckets (Supabase Mirror)
Bucket	Purpose
/inbox/	Raw file uploads
/converted/	Markdown + YAML conversions
/processed/	Chunks, embeddings, JSON summaries
/archive/	Compressed chat & journal entries
/outputs/	Final exports
/media/	Images, audio, video
7️⃣ Multi-Model Reasoning Chain
User → GPT-4o-mini → recall search → context summary → GPT-5 → response


GPT-4o-mini: context selection & summarization

GPT-5: final reasoning + synthesis

Context memory stored in assistant_embeddings and assistant_relations

🚀 Developer Scripts
# Install dependencies
npm install

# Run backend server (Express)
npm run server

# Run frontend (Vite)
npm run dev -- --host 0.0.0.0

# Watch Python converter for new files
python3 converter/main.py --watch ./buckets/inbox


Then open your app in browser:

http://localhost:3000


Accessible to all devices on your LAN:

http://<your-local-IP>:3000

🧮 Core Data Flow
[User Uploads File]
      ↓
[buckets/inbox]
      ↓
[converter/main.py]
      ↓
[buckets/converted + assistant_files table]
      ↓
[assistant_chunks + embeddings]
      ↓
[recallEngine.js + GPT-4o-mini]
      ↓
[GPT-5 response + chat history stored]

🧭 Migration Path to Supabase
Local	Supabase	Migration
SQLite DB	Postgres	pgloader or direct import
/buckets	Supabase Storage	mirror structure
JSON embeddings	pgvector columns	direct conversion
Express routes	Edge Functions	identical logic
Local UI	Vercel	deploy /frontend
🧱 Key Copilot Instructions

To GitHub Copilot or VS Code:
Scaffold the project according to this specification.

Use backend/models/schema_local.sql for database setup.

Implement an Express server with routes listed under /backend/routes.

Connect SQLite via Drizzle ORM.

Implement React + Tailwind chat interface under /frontend.

Include sidebar, file upload, chat history, and preferences pane.

Integrate OpenAI API for embeddings (text-embedding-3-small) and chat models (gpt-4o-mini, gpt-5).

Ensure all file uploads are stored in /buckets and indexed in the assistant_files table.

Wire recallEngine to search embeddings locally and return context for GPT-5 generation.

Maintain preferences and summaries in DB tables.

Result: a fully local, persistent AI assistant mirroring ScottBot’s Supabase backend.

🧩 Next Steps

Initialize a new repo in VS Code.

Copy this README and the schema file.

Run Copilot “Generate project from README.md”.

Build backend and frontend scaffolds.

Integrate your existing Python converter.

Test local persistence, retrieval, and embeddings.

Once complete, you’ll have:
✅ A self-contained ScottBot Local environment
✅ A working semantic recall system
✅ Full data persistence across chats, journals, and uploads
✅ One-step migration path to Supabase Cloud

## History Explorer & Topic Cloud

- Enable the new history pane with `History` in the UI to access:
      - Smart Topic Cloud (session-mode scoring by recency × frequency)
      - Virtual thread previews per topic
      - Keyword search (`/api/history/search`)
      - Full unified timeline dropdown (existing experience preserved)
- Feature flags (Vite env):

```bash
VITE_UI_TOPIC_CLOUD=1
VITE_UI_TOPIC_SEARCH=1
VITE_TOPIC_CLOUD_LIMIT=15
```

- Seed demo data for the topic cloud:

```bash
npm run test:data:seed-topic-cloud
```

## Further reading

- Unified Timeline Guide: docs/UNIFIED_TIMELINE_GUIDE.md
- Topic Cloud Spec: docs/TOPIC_CLOUD_AND_HISTORY_GUIDE.md