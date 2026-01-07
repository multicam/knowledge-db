#!/usr/bin/env bun
// Comprehensive workflow example demonstrating all features

import { KnowledgeBase } from './src';
import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const EXAMPLE_DB_PATH = './data/example-knowledge.db';
const EXAMPLE_INDEX_PATH = './data/example-vectors.index';
const EXAMPLE_MARKDOWN_DIR = './data/example-markdown';

// Colors for output
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
};

function log(msg: string, color: keyof typeof c = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

function section(title: string) {
  console.log();
  log(`${'='.repeat(60)}`, 'dim');
  log(title, 'bold');
  log(`${'='.repeat(60)}`, 'dim');
}

async function main() {
  log('\n🚀 Knowledge Database Workflow Example\n', 'bold');

  // Clean up
  [EXAMPLE_DB_PATH, EXAMPLE_DB_PATH + '-wal', EXAMPLE_DB_PATH + '-shm', EXAMPLE_INDEX_PATH].forEach(file => {
    if (existsSync(file)) unlinkSync(file);
  });

  // Initialize
  section('1. Initialize Knowledge Base');
  const kb = new KnowledgeBase({
    openaiKey: process.env.OPENAI_API_KEY!,
    dbPath: EXAMPLE_DB_PATH,
    indexPath: EXAMPLE_INDEX_PATH
  });

  await kb.initialize();
  log('✓ Knowledge base initialized', 'green');

  // Document Management
  section('2. Document Management');

  log('\nAdding single document:', 'cyan');
  const id1 = await kb.addDocument(
    'Vector databases enable semantic search using embeddings',
    { category: 'technology', importance: 'high' },
    'manual-entry'
  );
  log(`✓ Added document ID: ${id1}`, 'green');

  log('\nAdding batch of documents:', 'cyan');
  const docs = [
    {
      content: 'Machine learning models learn patterns from data without explicit programming',
      metadata: { category: 'ai', topic: 'ml' }
    },
    {
      content: 'Natural language processing enables computers to understand human language',
      metadata: { category: 'ai', topic: 'nlp' }
    },
    {
      content: 'Deep learning uses neural networks with multiple layers',
      metadata: { category: 'ai', topic: 'deep-learning' }
    }
  ];

  const ids = await kb.addDocuments(docs);
  log(`✓ Added ${ids.length} documents: ${ids.join(', ')}`, 'green');

  // Search Operations
  section('3. Search Operations');

  log('\nSemantic Search:', 'cyan');
  const searchResults = await kb.search('understanding human language with AI', { limit: 3 });
  log(`Found ${searchResults.length} results:`, 'green');
  searchResults.forEach((r, i) => {
    log(`  ${i + 1}. [${(r.similarity * 100).toFixed(1)}%] ${r.document.content.substring(0, 60)}...`, 'dim');
  });

  log('\nFull-Text Search:', 'cyan');
  const ftsResults = kb.fulltextSearch('neural', 5);
  log(`Found ${ftsResults.length} results containing "neural"`, 'green');

  log('\nHybrid Search:', 'cyan');
  const hybridResults = await kb.hybridSearch('learning', 'artificial intelligence', 3);
  log(`Found ${hybridResults.length} results combining SQL + semantic:`, 'green');
  hybridResults.forEach((r, i) => {
    log(`  ${i + 1}. [Score: ${(r.score * 100).toFixed(1)}%] ${r.document.content.substring(0, 60)}...`, 'dim');
  });

  // Named Vectors
  section('4. Named Vector Operations');

  log('\nCreating named vectors:', 'cyan');
  await kb.saveNamedVector('practical_ai', 'hands-on machine learning tutorials and code examples');
  log('✓ Saved @practical_ai', 'green');

  await kb.saveNamedVector('academic_ai', 'theoretical research papers and mathematical proofs');
  log('✓ Saved @academic_ai', 'green');

  await kb.saveNamedVector('programming', 'software development and coding');
  log('✓ Saved @programming', 'green');

  log('\nListing named vectors:', 'cyan');
  const namedVectors = kb.getAllNamedVectors();
  log(`Total: ${namedVectors.length} named vectors`, 'green');
  namedVectors.forEach(v => {
    log(`  • @${v.handle} (dim: ${v.vector.length})`, 'dim');
  });

  // Vector Algebra
  section('5. Vector Algebra Search');

  log('\nSearching with algebra: @practical_ai + @programming - @academic_ai', 'cyan');
  const algebraResults = await kb.searchWithVectorAlgebra([
    { type: 'add', handle: 'practical_ai' },
    { type: 'add', handle: 'programming', weight: 0.5 },
    { type: 'subtract', handle: 'academic_ai', weight: 0.3 }
  ], { limit: 3 });

  log(`Found ${algebraResults.length} results:`, 'green');
  algebraResults.forEach((r, i) => {
    log(`  ${i + 1}. [${(r.similarity * 100).toFixed(1)}%] ${r.document.content.substring(0, 60)}...`, 'dim');
  });

  // Import Markdown
  section('6. Markdown Import');

  // Create sample markdown files
  if (!existsSync(EXAMPLE_MARKDOWN_DIR)) {
    mkdirSync(EXAMPLE_MARKDOWN_DIR, { recursive: true });
  }

  writeFileSync(join(EXAMPLE_MARKDOWN_DIR, 'ai-guide.md'), `---
title: AI Guide
author: Example
tags: [ai, tutorial]
---

# Artificial Intelligence Guide

AI systems can learn from data and make decisions. Machine learning is a subset of AI that focuses on statistical pattern recognition.

## Deep Learning

Deep learning uses neural networks with multiple layers to learn hierarchical representations.
`);

  writeFileSync(join(EXAMPLE_MARKDOWN_DIR, 'python-basics.md'), `---
title: Python Basics
category: programming
---

# Python Programming

Python is a high-level programming language known for its simplicity and extensive ecosystem.
`);

  log('\nImporting markdown files:', 'cyan');
  const { processMarkdownFile } = await import('./src/import/markdown');

  for (const fileName of ['ai-guide.md', 'python-basics.md']) {
    const filePath = join(EXAMPLE_MARKDOWN_DIR, fileName);
    const file = Bun.file(filePath);
    const content = await file.text();

    const documents = processMarkdownFile(filePath, content, {
      extractFrontmatter: true,
      chunkSize: 500
    });

    const docsToAdd = documents.map(d => ({
      content: d.content,
      metadata: d.metadata,
      source: d.source
    }));

    await kb.addDocuments(docsToAdd);
    log(`✓ Imported ${fileName} (${documents.length} chunks)`, 'green');
  }

  // Statistics
  section('7. Statistics and Monitoring');

  const stats = kb.getStats();
  log('\nDatabase Statistics:', 'cyan');
  log(`  Documents: ${stats.documents}`, 'dim');
  log(`  Embeddings: ${stats.embeddings}`, 'dim');
  log(`  Vectors: ${stats.vectorCount}`, 'dim');
  log(`  Dimension: ${stats.dimension}`, 'dim');
  log(`  Named Vectors: ${stats.namedVectors}`, 'dim');
  log(`  Tokens Used: ${stats.tokensUsed.toLocaleString()}`, 'dim');

  const cost = stats.tokensUsed * 0.00002 / 1000;
  log(`  Estimated Cost: $${cost.toFixed(6)}`, 'dim');

  // Document Lifecycle
  section('8. Document Lifecycle');

  log('\nRetrieving document:', 'cyan');
  const doc = kb.getDocument(id1);
  if (doc) {
    log(`✓ Retrieved document ${id1}:`, 'green');
    log(`  Content: ${doc.content.substring(0, 60)}...`, 'dim');
    log(`  Metadata: ${JSON.stringify(doc.metadata)}`, 'dim');
  }

  log('\nListing all documents:', 'cyan');
  const allDocs = kb.getAllDocuments(5);
  log(`✓ Retrieved ${allDocs.length} documents (showing first 5)`, 'green');

  log('\nDeleting a document:', 'cyan');
  const tempId = await kb.addDocument('Temporary document for deletion demo');
  const deleted = await kb.deleteDocument(tempId);
  log(`✓ Deleted document ${tempId}: ${deleted}`, 'green');

  // Advanced Search Techniques
  section('9. Advanced Search Techniques');

  log('\nSearch with threshold:', 'cyan');
  const strictResults = await kb.search('machine learning', {
    limit: 10,
    threshold: 0.5
  });
  log(`✓ Found ${strictResults.length} results with similarity > 50%`, 'green');

  log('\nSearch by vector directly:', 'cyan');
  const practicalVec = kb.getNamedVector('practical_ai');
  if (practicalVec) {
    const vectorResults = await kb.searchByVector(practicalVec.vector, { limit: 3 });
    log(`✓ Found ${vectorResults.length} results using @practical_ai vector`, 'green');
  }

  // Cleanup
  section('10. Cleanup');

  await kb.close();
  log('✓ Closed knowledge base', 'green');

  // Clean up example files
  if (existsSync(EXAMPLE_MARKDOWN_DIR)) {
    const files = require('fs').readdirSync(EXAMPLE_MARKDOWN_DIR);
    files.forEach((file: string) => {
      unlinkSync(join(EXAMPLE_MARKDOWN_DIR, file));
    });
    require('fs').rmdirSync(EXAMPLE_MARKDOWN_DIR);
  }

  [EXAMPLE_DB_PATH, EXAMPLE_DB_PATH + '-wal', EXAMPLE_DB_PATH + '-shm', EXAMPLE_INDEX_PATH].forEach(file => {
    if (existsSync(file)) unlinkSync(file);
  });

  log('✓ Cleaned up example files', 'green');

  // Summary
  section('Summary');

  log('\nWorkflow Complete! 🎉', 'bold');
  log('\nWhat we demonstrated:', 'cyan');
  log('  ✓ Document management (add, get, list, delete)', 'dim');
  log('  ✓ Semantic search with similarity scoring', 'dim');
  log('  ✓ Full-text search with SQLite FTS5', 'dim');
  log('  ✓ Hybrid search combining SQL + semantic', 'dim');
  log('  ✓ Named vector creation and management', 'dim');
  log('  ✓ Vector algebra operations', 'dim');
  log('  ✓ Markdown import with frontmatter', 'dim');
  log('  ✓ Statistics and monitoring', 'dim');
  log('  ✓ Advanced search techniques', 'dim');

  log('\nNext Steps:', 'cyan');
  log('  • Try the interactive CLI: bun run cli.ts', 'dim');
  log('  • Import your own notes: bun run import.ts ./your-notes', 'dim');
  log('  • Read the user guide: USER-GUIDE.md', 'dim');
  log('  • Check production readiness: PRODUCTION-READINESS.md', 'dim');

  log('', 'reset');
}

try {
  if (!process.env.OPENAI_API_KEY) {
    log('\n❌ Error: OPENAI_API_KEY not set', 'yellow');
    log('Please set your OpenAI API key in .env file\n', 'dim');
    process.exit(1);
  }

  await main();
} catch (error) {
  log(`\n❌ Error: ${error}`, 'yellow');
  process.exit(1);
}
