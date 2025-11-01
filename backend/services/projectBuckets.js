import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, rmSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from './db.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

const BUCKET_PATH = process.env.BUCKET_PATH
  ? (process.env.BUCKET_PATH.startsWith('.')
      ? join(PROJECT_ROOT, process.env.BUCKET_PATH)
      : process.env.BUCKET_PATH)
  : join(PROJECT_ROOT, 'buckets');

const MAX_FILES_PER_BUCKET = 20;

function ensureBucketRow(slot) {
  const existing = queryOne(
    'SELECT id, name, description FROM assistant_project_buckets WHERE slot = ?',
    [slot]
  );

  if (existing) {
    return existing;
  }

  const id = uuidv4();
  const defaultName = `Project ${slot}`;

  execute(
    `INSERT INTO assistant_project_buckets (id, slot, name, description)
     VALUES (?, ?, ?, ?)` ,
    [id, slot, defaultName, `Workspace for ${defaultName}`]
  );

  logger.info(`Created project bucket slot ${slot}`);

  return { id, name: defaultName, description: `Workspace for ${defaultName}` };
}

export function ensureProjectBuckets() {
  for (let slot = 1; slot <= 4; slot++) {
    ensureBucketRow(slot);
  }
}

export function getProjectBuckets(options = {}) {
  const { includeFiles = false } = options;
  const rows = query(
    `SELECT id, slot, name, description, active_file_count, created_at, updated_at
     FROM assistant_project_buckets
     ORDER BY slot`
  );

  if (!includeFiles) {
    return rows;
  }

  return rows.map((bucket) => ({
    ...bucket,
    files: listBucketFiles(bucket.id)
  }));
}

export function updateProjectBucket(slot, { name, description }) {
  const bucket = ensureBucketRow(slot);
  const updates = [];
  const params = [];

  if (typeof name === 'string') {
    updates.push('name = ?');
    params.push(name.trim());
  }

  if (typeof description === 'string') {
    updates.push('description = ?');
    params.push(description.trim());
  }

  if (updates.length === 0) {
    return bucket;
  }

  params.push(slot);

  execute(
    `UPDATE assistant_project_buckets
     SET ${updates.join(', ')}, updated_at = datetime('now')
     WHERE slot = ?`,
    params
  );

  return queryOne(
    `SELECT id, slot, name, description, active_file_count
     FROM assistant_project_buckets WHERE slot = ?`,
    [slot]
  );
}

export function listBucketFiles(bucketId) {
  return query(
    `SELECT f.id AS association_id,
            f.file_id,
            f.original_name,
            f.mime_type,
            f.file_size,
            f.stored_path,
            f.converted_path,
            f.uploaded_at,
            af.conversion_status,
            af.metadata
     FROM assistant_project_bucket_files f
     JOIN assistant_project_buckets b ON b.id = f.bucket_id
     JOIN assistant_files af ON af.id = f.file_id
     WHERE f.bucket_id = ?
     ORDER BY f.uploaded_at DESC`,
    [bucketId]
  ).map((row) => ({
    ...row,
    metadata: parseMetadata(row.metadata)
  }));
}

export function attachFileToBucket(bucketId, fileId) {
  const bucket = queryOne(
    'SELECT id, slot, active_file_count FROM assistant_project_buckets WHERE id = ?',
    [bucketId]
  );

  if (!bucket) {
    throw new Error('Bucket not found');
  }

  const file = queryOne(
    `SELECT id, original_name, metadata, file_path
     FROM assistant_files WHERE id = ?`,
    [fileId]
  );

  if (!file) {
    throw new Error('File not found');
  }

  const existingAssociation = queryOne(
    `SELECT id FROM assistant_project_bucket_files
     WHERE bucket_id = ? AND file_id = ?`,
    [bucketId, fileId]
  );

  if (existingAssociation) {
    return {
      id: existingAssociation.id,
      bucketId,
      fileId,
      originalName: file.original_name
    };
  }

  const fileCount = queryOne(
    'SELECT COUNT(*) AS count FROM assistant_project_bucket_files WHERE bucket_id = ?',
    [bucketId]
  );

  if (fileCount.count >= MAX_FILES_PER_BUCKET) {
    throw new Error('Bucket file limit reached (20 files)');
  }

  const metadata = parseMetadata(file.metadata);
  const associationId = uuidv4();
  const convertedPath = join(BUCKET_PATH, 'converted', `${fileId}.md`);

  execute(
    `INSERT INTO assistant_project_bucket_files
      (id, bucket_id, file_id, original_name, mime_type, file_size, stored_path, converted_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      associationId,
      bucketId,
      fileId,
      file.original_name,
      metadata?.mimetype || null,
      metadata?.size || null,
      file.file_path,
      convertedPath
    ]
  );

  refreshBucketFileCount(bucketId);

  return {
    id: associationId,
    bucketId,
    fileId,
    originalName: file.original_name,
    mimeType: metadata?.mimetype || null,
    fileSize: metadata?.size || null,
    storedPath: file.file_path,
    convertedPath
  };
}

export function removeBucketFile(bucketId, associationId, { deleteFileRecord = false } = {}) {
  const association = queryOne(
    `SELECT file_id FROM assistant_project_bucket_files
     WHERE id = ? AND bucket_id = ?`,
    [associationId, bucketId]
  );

  if (!association) {
    throw new Error('Bucket file not found');
  }

  execute(
    'DELETE FROM assistant_project_bucket_files WHERE id = ?',
    [associationId]
  );

  if (deleteFileRecord) {
    deleteAssistantFile(association.file_id);
  }

  refreshBucketFileCount(bucketId);
}

export function findProjectBucketByName(name) {
  if (!name) {
    return null;
  }

  const normalized = name.trim().toLowerCase();

  const bucket = queryOne(
    `SELECT id, slot, name, description FROM assistant_project_buckets
     WHERE lower(name) = ?`,
    [normalized]
  );

  return bucket || null;
}

export function getProjectBucketById(bucketId) {
  if (!bucketId) {
    return null;
  }
  return queryOne(
    `SELECT id, slot, name, description, active_file_count
     FROM assistant_project_buckets WHERE id = ?`,
    [bucketId]
  );
}

export function getProjectBucketBySlot(slot) {
  return queryOne(
    `SELECT id, slot, name, description, active_file_count
     FROM assistant_project_buckets WHERE slot = ?`,
    [slot]
  );
}

export function buildBucketContext(bucketId, options = {}) {
  const { snippetLength = 1200 } = options;
  const bucket = getProjectBucketById(bucketId);
  if (!bucket) {
    return null;
  }

  const files = listBucketFiles(bucketId).map((file) => ({
    associationId: file.association_id,
    fileId: file.file_id,
    originalName: file.original_name,
    snippet: readFileSnippet(file.converted_path, snippetLength),
    uploadedAt: file.uploaded_at,
    mimeType: file.mime_type,
    conversionStatus: file.conversion_status
  }));

  return {
    ...bucket,
    files
  };
}

export function setActiveBucketForSession(sessionId, bucketId) {
  if (!sessionId) {
    return;
  }

  execute(
    `INSERT INTO assistant_session_context (session_id, active_bucket_id, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(session_id) DO UPDATE SET
       active_bucket_id = excluded.active_bucket_id,
       updated_at = datetime('now')`,
    [sessionId, bucketId || null]
  );
}

export function getActiveBucketForSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  const row = queryOne(
    `SELECT c.active_bucket_id, b.name, b.slot, b.description
     FROM assistant_session_context c
     LEFT JOIN assistant_project_buckets b ON b.id = c.active_bucket_id
     WHERE c.session_id = ?`,
    [sessionId]
  );

  if (!row || !row.active_bucket_id) {
    return null;
  }

  return {
    id: row.active_bucket_id,
    slot: row.slot,
    name: row.name,
    description: row.description
  };
}

export function clearActiveBucketForSession(sessionId) {
  if (!sessionId) {
    return;
  }

  execute(
    'DELETE FROM assistant_session_context WHERE session_id = ?',
    [sessionId]
  );
}

function refreshBucketFileCount(bucketId) {
  const countRow = queryOne(
    'SELECT COUNT(*) AS count FROM assistant_project_bucket_files WHERE bucket_id = ?',
    [bucketId]
  );

  execute(
    `UPDATE assistant_project_buckets
     SET active_file_count = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [countRow.count, bucketId]
  );
}

function parseMetadata(metadata) {
  if (!metadata) {
    return null;
  }

  if (typeof metadata === 'object') {
    return metadata;
  }

  try {
    return JSON.parse(metadata);
  } catch (err) {
    logger.warn(`Failed to parse metadata: ${err.message}`);
    return null;
  }
}

function readFileSnippet(path, maxChars) {
  if (!path || !existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    if (content.length <= maxChars) {
      return content;
    }
    return `${content.slice(0, maxChars)}...`;
  } catch (err) {
    logger.warn(`Failed to read bucket file snippet: ${err.message}`);
    return null;
  }
}

function deleteAssistantFile(fileId) {
  const file = queryOne(
    'SELECT file_path FROM assistant_files WHERE id = ?',
    [fileId]
  );

  execute('DELETE FROM assistant_chunks WHERE file_id = ?', [fileId]);
  execute('DELETE FROM assistant_embeddings WHERE source_id LIKE ?', [`${fileId}%`]);
  execute('DELETE FROM assistant_files WHERE id = ?', [fileId]);

  if (file && file.file_path && existsSync(file.file_path)) {
    try {
      rmSync(file.file_path, { force: true });
    } catch (err) {
      logger.debug?.(`Failed to remove file ${file.file_path}: ${err.message}`);
    }
  }

  const convertedPath = join(BUCKET_PATH, 'converted', `${fileId}.md`);
  if (existsSync(convertedPath)) {
    try {
      rmSync(convertedPath, { force: true });
    } catch (err) {
      logger.debug?.(`Failed to remove converted file ${convertedPath}: ${err.message}`);
    }
  }
}
