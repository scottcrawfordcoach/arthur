/**
 * Batch upload ICF resource files
 * Usage: node backend/scripts/batch-upload-icf.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_DIR = path.join(__dirname, '../../Resources');
const API_URL = 'http://localhost:3001/api/files/upload';

async function uploadFile(filePath) {
  const fileName = path.basename(filePath);
  
  console.log(`Uploading: ${fileName}...`);
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('action', 'convert');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Success: ${fileName}`);
      return result;
    } else {
      const error = await response.text();
      console.error(`❌ Failed: ${fileName} - ${error}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    return null;
  }
}

async function batchUpload() {
  console.log('🚀 Starting batch upload of ICF resources...\n');
  
  // Get all PDF files in Resources directory
  const files = fs.readdirSync(RESOURCES_DIR)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(RESOURCES_DIR, f));
  
  console.log(`Found ${files.length} PDF files\n`);
  
  let uploaded = 0;
  let failed = 0;
  
  // Upload one at a time to avoid overwhelming the system
  for (const file of files) {
    const result = await uploadFile(file);
    if (result) {
      uploaded++;
      // Wait 2 seconds between uploads to allow processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      failed++;
    }
  }
  
  console.log('\n📊 Upload Summary:');
  console.log(`✅ Uploaded: ${uploaded}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Total: ${files.length}`);
}

batchUpload().catch(console.error);
