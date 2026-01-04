#!/usr/bin/env bun
// CLI interface - to be implemented in Phase 6

import { parseArgs } from 'util';
import { KnowledgeBase } from './src/index';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    query: { type: 'string', short: 'q' },
    add: { type: 'string', short: 'a' },
    limit: { type: 'string', short: 'l', default: '10' },
    help: { type: 'boolean', short: 'h' }
  }
});

if (values.help) {
  console.log(`
Knowledge Database CLI

Usage:
  bun run cli.ts --query "search term" [--limit 10]
  bun run cli.ts --add "document content"

Options:
  -q, --query    Search for documents
  -a, --add      Add a new document
  -l, --limit    Number of results (default: 10)
  -h, --help     Show this help message
  `);
  process.exit(0);
}

const kb = new KnowledgeBase({
  openaiKey: process.env.OPENAI_API_KEY || '',
  dbPath: process.env.DB_PATH,
  indexPath: process.env.INDEX_PATH
});

try {
  await kb.initialize();

  if (values.add) {
    const id = await kb.addDocument(values.add);
    console.log(`Added document ${id}`);
  } else if (values.query) {
    const results = await kb.search(values.query, {
      limit: parseInt(values.limit!)
    });
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('Please specify --query or --add. Use --help for more info.');
  }

  await kb.close();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
