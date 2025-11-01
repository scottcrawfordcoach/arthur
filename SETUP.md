# ScottBot Local - Complete Setup Guide

## 📋 Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Node.js 18 or higher installed
- [ ] Python 3.8 or higher installed
- [ ] npm package manager
- [ ] OpenAI API key (required)
- [ ] Tavily or Serper API key (optional, for web search)
- [ ] Git (optional, for version control)

## 🚀 Step-by-Step Setup

### Step 1: Install Node.js Dependencies

```bash
# From the project root
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

This will install:
- **Backend:** Express, SQLite, OpenAI SDK, Multer, Winston, etc.
- **Frontend:** React, Vite, Tailwind CSS, React Markdown, Lucide icons

### Step 2: Install Python Dependencies

```bash
cd "DOCUMENT _TO_MD_CONVERTER V1"
pip install -r requirements.txt
cd ..
```

This installs converters for:
- PDF (PyPDF2, pdfminer.six)
- DOCX (python-docx)
- EPUB (ebooklib)
- ODT (odfpy)
- Audio/Video (via OpenAI Whisper)

### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Now edit `.env` with your favorite text editor:

```bash
# Required - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Models
MODEL_FAST=gpt-4o-mini
MODEL_MAIN=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small

# Optional - Get from https://tavily.com
TAVILY_API_KEY=tvly-...

# OR use Serper - Get from https://serper.dev
# SERPER_API_KEY=...

# Server config (usually no changes needed)
PORT=3001
FRONTEND_URL=http://localhost:3000

# Paths (usually no changes needed)
DATABASE_URL=./data/db/ai_local.db
BUCKET_PATH=./buckets
CONVERTER_PATH=./DOCUMENT _TO_MD_CONVERTER V1
```

### Step 4: Initialize Database and Folders

```bash
npm run db:init
```

This will:
- Create the SQLite database with full schema
- Create bucket folders (inbox, converted, processed, archive, outputs, media)
- Create logs folder
- Display next steps

### Step 5: Start the Application

**Option A: Run everything together (recommended)**
```bash
npm run dev
```

**Option B: Run backend and frontend separately**

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run client
```

### Step 6: Access the Application

Open your browser to:
- **Local machine:** http://localhost:3000
- **Other devices on LAN:** http://<your-ip>:3000

Find your IP:
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

## 🎯 First Steps After Setup

### 1. Set Your Preferences

Click the "Preferences" button in the sidebar and fill in:
- Your name
- Context about yourself (goals, interests, work)
- Preferred response style
- Enable/disable web search

### 2. Start a Conversation

Click "New Chat" and try:
- "Hello! Tell me about your capabilities."
- "What files can you process?"
- "Search the web for latest AI news"

### 3. Upload a File

Click the upload icon (📎) and try:
- Upload a PDF, DOCX, or text file
- Choose "Convert & Index" to make it searchable
- Ask questions about the file content

### 4. Test the STOP Button

- Start a long query like "Write a 5000 word essay on quantum mechanics"
- Click the STOP button (⏹️) to abort generation
- The response will stop immediately

## 🔧 Advanced Configuration

### Custom Models

Edit `.env` to use different models:

```bash
# Use GPT-4 Turbo for faster responses
MODEL_MAIN=gpt-4-turbo-preview

# Use GPT-3.5 for cheaper operation
MODEL_FAST=gpt-3.5-turbo
MODEL_MAIN=gpt-3.5-turbo
```

### Custom Port

```bash
# Backend port
PORT=8080

# Then update frontend proxy in frontend/vite.config.js:
# target: 'http://localhost:8080'
```

### Database Location

```bash
# Use a different database location
DATABASE_URL=/path/to/custom/location/ai_local.db
```

## 📁 Understanding the File System

### Buckets Folder

```
buckets/
├── inbox/          # Raw uploaded files before processing
├── converted/      # Markdown conversions of documents
├── processed/      # Fully processed with metadata and chunks
├── archive/        # Old/archived content
├── outputs/        # Generated outputs (reports, summaries)
└── media/          # Images, audio, video files
```

### Data Folder

```
data/
└── db/
    └── ai_local.db     # SQLite database with all data
```

### Logs Folder

```
logs/
├── combined.log    # All logs
└── error.log       # Error logs only
```

## 🐛 Troubleshooting

### Database Errors

**Problem:** "Database not initialized"

**Solution:**
```bash
npm run db:init
```

**Problem:** "Database locked"

**Solution:**
```bash
# Close any SQLite browsers/tools
# Or delete and recreate:
rm data/db/ai_local.db
npm run db:init
```

### File Conversion Errors

**Problem:** "Python converter not found"

**Solution:**
```bash
# Check CONVERTER_PATH in .env
# Should be: ./DOCUMENT _TO_MD_CONVERTER V1
```

**Problem:** "ModuleNotFoundError: No module named 'PyPDF2'"

**Solution:**
```bash
cd "DOCUMENT _TO_MD_CONVERTER V1"
pip install -r requirements.txt
cd ..
```

### Frontend Not Loading

**Problem:** Frontend shows blank page

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
cd ..
```

### API Connection Errors

**Problem:** "Failed to fetch" or CORS errors

**Solution:**
- Check backend is running (`npm run server`)
- Verify `FRONTEND_URL` in `.env` matches your frontend URL
- Check browser console for specific errors

### Web Search Not Working

**Problem:** "No web search API configured"

**Solution:**
- Add `TAVILY_API_KEY` or `SERPER_API_KEY` to `.env`
- System will work fine without web search (uses local knowledge only)

### STOP Button Not Working

**Problem:** STOP button doesn't abort generation

**Solution:**
- Ensure you're using the latest version
- Check browser console for errors
- Verify backend and frontend are communicating

## 🔄 Maintenance

### Clear Old Data

```bash
# Delete old database
rm data/db/ai_local.db

# Delete processed files
rm -rf buckets/converted/*
rm -rf buckets/processed/*

# Recreate database
npm run db:init
```

### Update Dependencies

```bash
# Update Node.js packages
npm update
cd frontend && npm update && cd ..

# Update Python packages
cd "DOCUMENT _TO_MD_CONVERTER V1"
pip install --upgrade -r requirements.txt
cd ..
```

### Backup Your Data

```bash
# Backup database
cp data/db/ai_local.db data/db/ai_local_backup_$(date +%Y%m%d).db

# Backup processed files
tar -czf buckets_backup_$(date +%Y%m%d).tar.gz buckets/
```

## 📊 Performance Tips

### For Faster Responses

1. Use GPT-3.5-Turbo instead of GPT-4
2. Reduce context recall (lower `maxResults` in embeddings)
3. Disable web search if not needed

### For Better Accuracy

1. Use GPT-4 or GPT-4-Turbo
2. Increase context recall (`maxResults: 20`)
3. Enable web search for current information

### For Lower Costs

1. Use GPT-3.5-Turbo
2. Use `text-embedding-ada-002` instead of `text-embedding-3-small`
3. Limit file uploads
4. Disable automatic web search

## 🔒 Security Notes

- **Never commit `.env` file** - Contains API keys
- **Keep database local** - Contains all your data
- **Use strong API keys** - Rotate periodically
- **Don't expose publicly** - Use localhost or LAN only
- **Backup regularly** - Database and files

## 🚀 Next Steps

After successful setup:

1. ✅ Customize preferences to match your style
2. ✅ Upload reference documents for context
3. ✅ Have conversations and build memory
4. ✅ Try file conversions with different formats
5. ✅ Test web search capabilities
6. ✅ Export important conversations

## 📞 Support

For issues or questions:
- Check this guide first
- Review the main README.md
- Check the logs folder for errors
- Review the code comments for implementation details

## 🎉 You're All Set!

Your ScottBot Local is now ready to use. Enjoy your personal AI assistant!

Remember:
- All data stays local on your machine
- Everything is searchable and recallable
- The system learns from your interactions
- You have full control over all data

Happy chatting! 🤖💬
