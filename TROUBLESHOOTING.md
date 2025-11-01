# 🔧 Troubleshooting Checklist

Use this checklist to diagnose and fix common issues.

## ✅ Pre-Flight Checklist

Before starting, verify:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Python 3.8+ installed (`python --version`)
- [ ] `.env` file exists and has `OPENAI_API_KEY`
- [ ] Database initialized (`npm run db:init` completed)
- [ ] Dependencies installed (`npm install` in root and frontend)

## 🚨 Common Issues

### Issue: "Database not initialized"

**Symptoms:**
- Backend crashes on startup
- Error: "Database not initialized"

**Fix:**
```bash
npm run db:init
```

**Verify:**
- File exists: `data/db/ai_local.db`
- File is not empty (> 0 bytes)

---

### Issue: "Cannot find module 'express'"

**Symptoms:**
- Backend won't start
- Missing dependency errors

**Fix:**
```bash
# Root directory
npm install

# Frontend
cd frontend
npm install
cd ..
```

**Verify:**
```bash
ls node_modules/express
ls frontend/node_modules/react
```

---

### Issue: Frontend shows blank page

**Symptoms:**
- Browser shows white screen
- No errors in terminal

**Diagnostics:**
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify backend is running

**Fix:**
```bash
# Kill all Node processes
# Windows:
taskkill /F /IM node.exe

# Mac/Linux:
killall node

# Restart
npm run dev
```

**Alternative:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

### Issue: "CORS policy" error

**Symptoms:**
- Frontend can't connect to backend
- Error mentioning "CORS" in console

**Fix:**

1. Check `FRONTEND_URL` in `.env`:
```bash
FRONTEND_URL=http://localhost:3000
```

2. Verify backend server.js has CORS enabled (should be default)

3. Try accessing from same origin:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

---

### Issue: File upload fails

**Symptoms:**
- Upload button doesn't work
- Error on file selection

**Diagnostics:**
```bash
# Check tmp directory exists
ls /tmp  # Mac/Linux
dir %TEMP%  # Windows
```

**Fix:**

1. Check file size (< 100MB)
2. Verify Python dependencies:
```bash
cd "DOCUMENT _TO_MD_CONVERTER V1"
pip install -r requirements.txt
cd ..
```

3. Check logs:
```bash
tail -f logs/error.log
```

---

### Issue: "Python converter not found"

**Symptoms:**
- File conversion fails
- Error mentions Python script missing

**Fix:**

1. Verify converter exists:
```bash
ls "DOCUMENT _TO_MD_CONVERTER V1/batch_doc_to_md.py"
```

2. Check `.env` path:
```bash
CONVERTER_PATH=./DOCUMENT _TO_MD_CONVERTER V1
```

3. Make sure path doesn't have typos (note the space in folder name)

---

### Issue: Web search not working

**Symptoms:**
- Error: "No web search API configured"
- Assistant says can't search web

**Fix:**

1. Add API key to `.env`:
```bash
# Get key from https://tavily.com
TAVILY_API_KEY=tvly-...

# OR from https://serper.dev
SERPER_API_KEY=...
```

2. Restart backend

**Note:** System works fine without web search (uses local knowledge only)

---

### Issue: STOP button doesn't work

**Symptoms:**
- Clicking STOP doesn't abort generation
- Response continues after clicking

**Diagnostics:**
1. Check browser console for errors
2. Verify backend version is latest

**Fix:**

1. Ensure you're clicking the correct button (red stop icon)
2. Check network tab - abort request should be sent
3. Restart both backend and frontend

**Workaround:**
- Refresh the browser page to force stop

---

### Issue: "OpenAI API error"

**Symptoms:**
- Chat fails immediately
- Error mentions API key or rate limit

**Diagnostics:**
```bash
# Check API key in .env
cat .env | grep OPENAI_API_KEY
```

**Fix:**

1. **Invalid API key:**
   - Get new key from https://platform.openai.com/api-keys
   - Update `.env`
   - Restart backend

2. **Rate limit:**
   - Wait a few minutes
   - Use slower model: `MODEL_MAIN=gpt-3.5-turbo`

3. **Insufficient credits:**
   - Add credits to OpenAI account
   - Check usage at https://platform.openai.com/usage

---

### Issue: Slow responses

**Symptoms:**
- Long wait times
- Messages take forever to stream

**Optimizations:**

1. **Use faster model:**
```bash
# In .env
MODEL_MAIN=gpt-3.5-turbo
```

2. **Reduce context:**
- Lower `maxResults` in recall settings
- Disable web search if not needed

3. **Check internet:**
- Verify OpenAI API is reachable
- Test: `ping api.openai.com`

---

### Issue: Database locked

**Symptoms:**
- Error: "database is locked"
- Can't write to database

**Fix:**

1. Close any SQLite browser tools
2. Restart backend
3. If persists:
```bash
# Backup and recreate
cp data/db/ai_local.db data/db/ai_local_backup.db
rm data/db/ai_local.db
npm run db:init
```

---

### Issue: Port already in use

**Symptoms:**
- Error: "EADDRINUSE" or "port 3000/3001 already in use"

**Fix:**

**Find and kill process:**

Windows:
```bash
# Find process
netstat -ano | findstr :3001
# Kill it (replace PID)
taskkill /F /PID <PID>
```

Mac/Linux:
```bash
# Find process
lsof -i :3001
# Kill it (replace PID)
kill -9 <PID>
```

**Or use different ports:**
```bash
# .env
PORT=8080

# frontend/vite.config.js
server: { port: 8000 }
```

---

### Issue: Embeddings not working

**Symptoms:**
- Semantic search returns nothing
- Recall doesn't find context

**Diagnostics:**
```bash
# Check embeddings exist
sqlite3 data/db/ai_local.db "SELECT COUNT(*) FROM assistant_embeddings;"
```

**Fix:**

1. Wait for processing (check logs)
2. Re-process files:
```bash
# Upload files again with "Convert & Index" option
```

3. Verify embedding model:
```bash
# .env
EMBEDDING_MODEL=text-embedding-3-small
```

---

### Issue: High memory usage

**Symptoms:**
- System becomes slow
- Out of memory errors

**Fix:**

1. **Reduce concurrent operations:**
   - Process files one at a time
   - Don't upload multiple large files together

2. **Clear old data:**
```bash
# Delete old chunks
sqlite3 data/db/ai_local.db "DELETE FROM assistant_chunks WHERE created_at < date('now', '-30 days');"
```

3. **Restart application regularly:**
```bash
# Kill and restart
npm run dev
```

---

## 🔍 Diagnostic Commands

### Check System Status

```bash
# Backend running?
curl http://localhost:3001/health

# Frontend accessible?
curl http://localhost:3000

# Database exists?
ls -lh data/db/ai_local.db

# Logs show errors?
tail -20 logs/error.log
```

### Check Dependencies

```bash
# Node.js
node --version  # Should be 18+

# npm
npm --version

# Python
python --version  # Should be 3.8+

# Python packages
pip list | grep -i "pypdf2\|openai\|docx"
```

### Database Inspection

```bash
sqlite3 data/db/ai_local.db

# Check tables exist
.tables

# Check record counts
SELECT COUNT(*) FROM assistant_chat_sessions;
SELECT COUNT(*) FROM assistant_files;
SELECT COUNT(*) FROM assistant_embeddings;

# Check recent activity
SELECT * FROM assistant_chat_sessions ORDER BY updated_at DESC LIMIT 5;

# Exit
.quit
```

### Clean Slate Reset

If all else fails, start fresh:

```bash
# 1. Backup important data
cp -r data data_backup
cp -r buckets buckets_backup

# 2. Clean everything
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf data/db/ai_local.db
rm -rf buckets/*/!(*.gitkeep)

# 3. Reinstall
npm install
cd frontend && npm install && cd ..

# 4. Reinitialize
npm run db:init

# 5. Restart
npm run dev
```

---

## 📞 Getting Help

If issues persist:

1. **Check logs:**
   - `logs/error.log` - Backend errors
   - Browser console (F12) - Frontend errors

2. **Enable verbose logging:**
   ```bash
   # .env
   LOG_LEVEL=debug
   ```

3. **Test individual components:**
   - Backend only: `npm run server`
   - Frontend only: `cd frontend && npm run dev`

4. **Verify setup:**
   - Follow SETUP.md step-by-step
   - Don't skip steps

5. **Check versions:**
   - Node.js 18+
   - Python 3.8+
   - Latest npm packages

---

## ✅ Health Check Script

Run this to verify everything:

```bash
#!/bin/bash

echo "🔍 ScottBot Local Health Check"
echo "=============================="
echo ""

# Node.js
echo -n "Node.js: "
node --version

# npm
echo -n "npm: "
npm --version

# Python
echo -n "Python: "
python --version

# Database
echo -n "Database: "
if [ -f "data/db/ai_local.db" ]; then
    echo "✅ EXISTS ($(du -h data/db/ai_local.db | cut -f1))"
else
    echo "❌ MISSING"
fi

# .env
echo -n ".env file: "
if [ -f ".env" ]; then
    echo "✅ EXISTS"
else
    echo "❌ MISSING"
fi

# API Key
echo -n "OpenAI Key: "
if grep -q "OPENAI_API_KEY=sk-" .env; then
    echo "✅ CONFIGURED"
else
    echo "❌ NOT SET"
fi

# Backend dependencies
echo -n "Backend deps: "
if [ -d "node_modules" ]; then
    echo "✅ INSTALLED"
else
    echo "❌ MISSING"
fi

# Frontend dependencies
echo -n "Frontend deps: "
if [ -d "frontend/node_modules" ]; then
    echo "✅ INSTALLED"
else
    echo "❌ MISSING"
fi

# Backend running?
echo -n "Backend: "
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ RUNNING"
else
    echo "❌ NOT RUNNING"
fi

# Frontend running?
echo -n "Frontend: "
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ RUNNING"
else
    echo "❌ NOT RUNNING"
fi

echo ""
echo "=============================="
```

Save as `health-check.sh` and run: `bash health-check.sh`

---

**Remember:** Most issues are solved by:
1. Checking `.env` configuration
2. Reinstalling dependencies
3. Restarting the application
4. Reading the error logs

Good luck! 🍀

Copyright (c) 2025 Scott Crawford. All rights reserved.
