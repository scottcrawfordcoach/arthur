# API Reference - ScottBot Local

## Base URL
```
http://localhost:3001/api
```

## Authentication
No authentication required (local only)

---

## Chat Endpoints

### Send Message (Streaming)
```http
POST /chat
Content-Type: application/json

{
  "message": "Your message here",
  "sessionId": "uuid-optional",
  "userId": "uuid-optional",
  "useWebSearch": true|false|null  // null = auto-detect
}
```

**Response:** Server-Sent Events (SSE) stream

```
data: {"type":"metadata","sessionId":"...","streamId":"...","userMessageId":"..."}

data: {"type":"content","content":"Hello"}

data: {"type":"content","content":" there!"}

data: {"type":"done","messageId":"...","fullContent":"Hello there!"}
```

### Abort Stream
```http
POST /chat/abort
Content-Type: application/json

{
  "streamId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stream aborted"
}
```

### Get Chat History
```http
GET /chat/:sessionId/history
```

**Response:**
```json
{
  "history": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Hello",
      "created_at": "2025-01-01T12:00:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Hi there!",
      "created_at": "2025-01-01T12:00:01Z"
    }
  ]
}
```

---

## File Endpoints

### Upload File
```http
POST /files/upload
Content-Type: multipart/form-data

FormData:
  - file: <binary>
  - action: "store" | "convert" | "process"
  - userId: "uuid-optional"
  - tags: "[\"tag1\",\"tag2\"]"  // JSON string
```

**Response:**
```json
{
  "success": true,
  "file": {
    "fileId": "uuid",
    "originalName": "document.pdf",
    "fileType": "document",
    "status": "pending|completed|failed"
  }
}
```

### List Files
```http
GET /files?userId=uuid&fileType=document&status=completed
```

**Response:**
```json
{
  "files": [
    {
      "id": "uuid",
      "original_name": "document.pdf",
      "file_type": "document",
      "conversion_status": "completed",
      "processed_at": "2025-01-01T12:00:00Z",
      "metadata": "{...}"
    }
  ]
}
```

### Get File Details
```http
GET /files/:fileId
```

**Response:**
```json
{
  "file": {
    "id": "uuid",
    "original_name": "document.pdf",
    "file_path": "/path/to/file",
    "metadata": "..."
  },
  "chunks": [
    {
      "id": "uuid",
      "chunk_index": 0,
      "content": "...",
      "summary": "..."
    }
  ]
}
```

### Delete File
```http
DELETE /files/:fileId
```

**Response:**
```json
{
  "success": true
}
```

---

## Session Endpoints

### List Sessions
```http
GET /sessions
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "Chat about AI",
      "created_at": "2025-01-01T12:00:00Z",
      "updated_at": "2025-01-01T13:00:00Z",
      "message_count": 10
    }
  ]
}
```

### Update Session Title
```http
PATCH /sessions/:sessionId
Content-Type: application/json

{
  "title": "New title"
}
```

**Response:**
```json
{
  "success": true
}
```

### Delete Session
```http
DELETE /sessions/:sessionId
```

**Response:**
```json
{
  "success": true
}
```

---

## Search Endpoints

### Web Search
```http
POST /search
Content-Type: application/json

{
  "query": "latest AI news",
  "maxResults": 5
}
```

**Response:**
```json
{
  "answer": "Quick answer if available",
  "results": [
    {
      "title": "Article Title",
      "url": "https://...",
      "content": "Snippet...",
      "score": 0.95
    }
  ]
}
```

### Semantic Search
```http
POST /embeddings/search
Content-Type: application/json

{
  "query": "machine learning concepts",
  "userId": "uuid-optional",
  "maxResults": 10,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "messages": [...],
  "files": [...],
  "memory": [...],
  "documents": [...]
}
```

---

## Preference Endpoints

### Get All Preferences
```http
GET /preferences
```

**Response:**
```json
{
  "preferences": {
    "userName": "John",
    "responseStyle": "balanced",
    "enableMemory": true
  }
}
```

### Update Preference
```http
PUT /preferences/:key
Content-Type: application/json

{
  "value": "newValue"
}
```

**Response:**
```json
{
  "success": true
}
```

### Delete Preference
```http
DELETE /preferences/:key
```

**Response:**
```json
{
  "success": true
}
```

---

## Archive Endpoints

### Get Archive
```http
GET /archive
```

**Response:**
```json
{
  "archives": [
    {
      "id": "uuid",
      "source_id": "uuid",
      "summary": "...",
      "archived_at": "2025-01-01T12:00:00Z"
    }
  ]
}
```

---

## Health Check

### Server Health
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here",
  "stack": "Stack trace (dev only)"
}
```

Common HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (missing parameters)
- `404` - Not Found
- `500` - Internal Server Error

---

## Server-Sent Events (SSE) Format

The chat endpoint uses SSE for streaming:

```
data: <JSON>\n\n
```

Event Types:
- `metadata` - Session info, stream ID
- `content` - Partial response content
- `done` - Complete response with message ID
- `aborted` - Stream was stopped by user
- `error` - Error occurred

---

## Examples

### cURL Examples

**Send a message:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, how are you?"}'
```

**Upload a file:**
```bash
curl -X POST http://localhost:3001/api/files/upload \
  -F "file=@document.pdf" \
  -F "action=process" \
  -F "tags=[\"work\",\"important\"]"
```

**Web search:**
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"latest AI developments","maxResults":5}'
```

### JavaScript Examples

**Send a message with streaming:**
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello!' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

**Upload file:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('action', 'process');
formData.append('tags', JSON.stringify(['work']));

const response = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

---

## Rate Limits

No rate limits currently implemented (local only).

When deploying to production, consider:
- Rate limiting per IP
- Request size limits (currently 50MB)
- Concurrent connection limits

---

## Best Practices

1. **Always handle errors** - Check response status
2. **Use AbortController** - For cancellable requests
3. **Stream processing** - Handle SSE events incrementally
4. **File size limits** - Stay under 100MB per file
5. **Session management** - Reuse sessions when possible
6. **Cleanup** - Delete old sessions and files periodically

---

## WebSocket Alternative

For real-time bidirectional communication, consider implementing WebSocket support:

```javascript
// Future enhancement
const ws = new WebSocket('ws://localhost:3001');
ws.send(JSON.stringify({ type: 'chat', message: '...' }));
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle response
};
```

---

## Database Direct Access

For advanced users, direct SQLite access:

```bash
sqlite3 data/db/ai_local.db

# Example queries
SELECT * FROM assistant_chat_sessions ORDER BY updated_at DESC LIMIT 10;
SELECT * FROM assistant_files WHERE conversion_status = 'completed';
SELECT COUNT(*) FROM assistant_embeddings;
```

---

## Monitoring

Check server logs:
```bash
# All logs
tail -f logs/combined.log

# Errors only
tail -f logs/error.log
```

Monitor database size:
```bash
ls -lh data/db/ai_local.db
```

---

This API is designed for local use. For production deployment, add:
- Authentication/authorization
- Rate limiting
- Input validation
- HTTPS/TLS
- CORS configuration
- Error tracking
- Performance monitoring

Copyright (c) 2025 Scott Crawford. All rights reserved.
