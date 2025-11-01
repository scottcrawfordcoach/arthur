// Copyright (c) 2025 Scott Crawford. All rights reserved.

import 'dotenv/config';
import OpenAI from 'openai';

console.log('Testing OpenAI API key in Node.js...\n');

const apiKey = process.env.OPENAI_API_KEY;

if (apiKey) {
  console.log(`✓ API key found: ${apiKey.substring(0, 20)}...${apiKey.slice(-4)}`);
  console.log(`  Length: ${apiKey.length} characters\n`);
  
  try {
    const openai = new OpenAI({ apiKey });
    
    console.log('Making test API call...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: "Say 'API key works!'" }],
      max_tokens: 10
    });
    
    console.log('✓ SUCCESS: API test worked!');
    console.log(`  Response: ${response.choices[0].message.content}`);
  } catch (error) {
    console.log('✗ FAILED: API test failed');
    console.log(`  Error: ${error.message}`);
  }
} else {
  console.log('✗ ERROR: No API key found in process.env');
  console.log(`  OPENAI_API_KEY value: ${process.env.OPENAI_API_KEY}`);
  console.log(`  All env keys starting with OPENAI:`, Object.keys(process.env).filter(k => k.startsWith('OPENAI')));
}
