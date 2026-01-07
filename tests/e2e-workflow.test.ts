import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { KnowledgeBase } from '../src';
import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = './data/test-e2e-knowledge.db';
const TEST_INDEX_PATH = './data/test-e2e-vectors.index';
const TEST_DIR = './data/test-e2e-markdown';

// Only run if API key is available
const apiKey = process.env.OPENAI_API_KEY;
const shouldRunTests = apiKey && !apiKey.includes('your-api-key-here');

describe('End-to-End Workflow', () => {
  if (!shouldRunTests) {
    test.skip('E2E tests require valid OPENAI_API_KEY', () => {});
    return;
  }

  let kb: KnowledgeBase;

  beforeAll(async () => {
    // Clean up test files
    [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm', TEST_INDEX_PATH].forEach(file => {
      if (existsSync(file)) unlinkSync(file);
    });

    // Create test markdown directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Create test markdown files
    writeFileSync(join(TEST_DIR, 'ai-basics.md'), `---
title: AI Fundamentals
category: artificial-intelligence
tags: [ai, ml, basics]
---

# Artificial Intelligence Fundamentals

Artificial intelligence (AI) is the simulation of human intelligence by machines. AI systems can learn from data, recognize patterns, and make decisions with minimal human intervention.

## Machine Learning

Machine learning is a subset of AI that enables systems to learn and improve from experience without explicit programming.
`);

    writeFileSync(join(TEST_DIR, 'python-guide.md'), `---
title: Python Programming Guide
category: programming
tags: [python, programming]
---

# Python Programming

Python is a high-level, interpreted programming language known for its simplicity and readability.

## Key Features

- Easy to learn and read
- Extensive standard library
- Strong community support
- Excellent for data science and AI
`);

    writeFileSync(join(TEST_DIR, 'vector-search.md'), `---
title: Vector Search Technology
category: databases
tags: [vectors, search, embeddings]
---

# Vector Search

Vector search uses embeddings to find semantically similar content. Unlike traditional keyword search, vector search understands meaning and context.

## Applications

- Semantic search engines
- Recommendation systems
- Question answering systems
- Similar document detection
`);

    kb = new KnowledgeBase({
      openaiKey: apiKey!,
      dbPath: TEST_DB_PATH,
      indexPath: TEST_INDEX_PATH
    });

    await kb.initialize();
  }, 30000);

  afterAll(async () => {
    await kb.close();

    // Clean up
    [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm', TEST_INDEX_PATH].forEach(file => {
      if (existsSync(file)) unlinkSync(file);
    });

    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      const files = require('fs').readdirSync(TEST_DIR);
      files.forEach((file: string) => {
        unlinkSync(join(TEST_DIR, file));
      });
      require('fs').rmdirSync(TEST_DIR);
    }
  });

  test('Workflow 1: Manual document addition and search', async () => {
    // Add documents manually
    const id1 = await kb.addDocument(
      'Deep learning uses neural networks with multiple layers',
      { topic: 'deep-learning' }
    );

    const id2 = await kb.addDocument(
      'Natural language processing enables machines to understand human language',
      { topic: 'nlp' }
    );

    expect(id1).toBeGreaterThan(0);
    expect(id2).toBeGreaterThan(0);

    // Search for related content
    const results = await kb.search('neural networks and AI', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.similarity).toBeGreaterThan(0.3);

    // Verify document retrieval
    const doc1 = kb.getDocument(id1);
    expect(doc1).not.toBeNull();
    expect(doc1!.content).toContain('Deep learning');
  }, 20000);

  test('Workflow 2: Batch import and full-text search', async () => {
    const docs = [
      { content: 'JavaScript is a dynamic programming language for web development' },
      { content: 'TypeScript adds static typing to JavaScript' },
      { content: 'React is a popular JavaScript library for building UIs' }
    ];

    const ids = await kb.addDocuments(docs);
    expect(ids.length).toBe(3);

    // Full-text search
    const ftsResults = kb.fulltextSearch('JavaScript');
    expect(ftsResults.length).toBeGreaterThanOrEqual(2);
  }, 20000);

  test('Workflow 3: Named vectors and algebra search', async () => {
    // Create named vectors for concepts
    await kb.saveNamedVector('programming', 'software development and coding');
    await kb.saveNamedVector('theory', 'theoretical concepts and abstract ideas');

    // Verify named vectors exist
    const progVec = kb.getNamedVector('programming');
    expect(progVec).not.toBeNull();
    expect(progVec!.vector.length).toBe(1536);

    // Vector algebra search: programming - theory
    const results = await kb.searchWithVectorAlgebra([
      { type: 'add', handle: 'programming' },
      { type: 'subtract', handle: 'theory', weight: 0.3 }
    ], { limit: 5 });

    expect(results.length).toBeGreaterThan(0);

    // Clean up named vectors
    kb.deleteNamedVector('programming');
    kb.deleteNamedVector('theory');
  }, 25000);

  test('Workflow 4: Hybrid search combining SQL and semantic', async () => {
    await kb.addDocument(
      'Python machine learning libraries include scikit-learn and TensorFlow',
      { language: 'python' }
    );

    await kb.addDocument(
      'JavaScript machine learning with TensorFlow.js',
      { language: 'javascript' }
    );

    // Hybrid search: SQL filter + semantic query
    const results = await kb.hybridSearch(
      'Python',  // SQL query
      'machine learning libraries',  // Semantic query
      5
    );

    expect(results.length).toBeGreaterThan(0);

    // Document matching both should score higher
    const topResult = results[0]!;
    expect(topResult.document.content).toContain('Python');
    expect(topResult.score).toBeGreaterThan(0.3);
  }, 20000);

  test('Workflow 5: Import markdown files and search', async () => {
    // Import using the markdown processor
    const { processMarkdownFile } = await import('../src/import/markdown');
    const file = Bun.file(join(TEST_DIR, 'ai-basics.md'));
    const content = await file.text();

    const documents = processMarkdownFile(
      join(TEST_DIR, 'ai-basics.md'),
      content,
      { chunkSize: 500, extractFrontmatter: true }
    );

    expect(documents.length).toBeGreaterThan(0);

    // Add imported documents
    const docsToAdd = documents.map(d => ({
      content: d.content,
      metadata: d.metadata,
      source: d.source
    }));

    const ids = await kb.addDocuments(docsToAdd);
    expect(ids.length).toBe(documents.length);

    // Search imported content
    const results = await kb.search('artificial intelligence', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);

    // Verify metadata from frontmatter
    const aiDoc = results.find(r => r.document.source && r.document.source.includes('ai-basics.md'));
    expect(aiDoc).toBeDefined();
    if (aiDoc) {
      expect(aiDoc.document.metadata.title).toBe('AI Fundamentals');
      expect(aiDoc.document.metadata.category).toBe('artificial-intelligence');
    }
  }, 25000);

  test('Workflow 6: Statistics and monitoring', async () => {
    const stats = kb.getStats();

    // Verify stats accuracy
    expect(stats.documents).toBeGreaterThan(0);
    expect(stats.embeddings).toBe(stats.documents);
    expect(stats.vectorCount).toBe(stats.documents);
    expect(stats.dimension).toBe(1536);
    expect(stats.tokensUsed).toBeGreaterThan(0);

    // All documents should have embeddings
    const allDocs = kb.getAllDocuments();
    expect(allDocs.length).toBe(stats.documents);
  }, 5000);

  test('Workflow 7: Document lifecycle management', async () => {
    // Add document
    const id = await kb.addDocument('Temporary test document');
    expect(id).toBeGreaterThan(0);

    // Retrieve document
    const doc = kb.getDocument(id);
    expect(doc).not.toBeNull();
    expect(doc!.content).toBe('Temporary test document');

    // Delete document
    const deleted = await kb.deleteDocument(id);
    expect(deleted).toBe(true);

    // Verify deletion
    const deletedDoc = kb.getDocument(id);
    expect(deletedDoc).toBeNull();
  }, 15000);

  test('Workflow 8: Search with thresholds', async () => {
    await kb.addDocument('Quantum computing uses quantum mechanics principles');

    // High threshold - should filter out low-similarity results
    const strictResults = await kb.search('quantum physics', {
      limit: 10,
      threshold: 0.6
    });

    // All results should meet threshold
    strictResults.forEach(result => {
      expect(result.similarity).toBeGreaterThanOrEqual(0.6);
    });

    // Low threshold - should include more results
    const lenientResults = await kb.search('quantum physics', {
      limit: 10,
      threshold: 0.2
    });

    expect(lenientResults.length).toBeGreaterThanOrEqual(strictResults.length);
  }, 15000);

  test('Workflow 9: Multiple file import simulation', async () => {
    const { processMarkdownFile } = await import('../src/import/markdown');

    const files = [
      'ai-basics.md',
      'python-guide.md',
      'vector-search.md'
    ];

    let totalDocs = 0;

    for (const fileName of files) {
      const file = Bun.file(join(TEST_DIR, fileName));
      const content = await file.text();

      const documents = processMarkdownFile(
        join(TEST_DIR, fileName),
        content,
        { extractFrontmatter: true, chunkSize: 1000 }
      );

      const docsToAdd = documents.map(d => ({
        content: d.content,
        metadata: d.metadata,
        source: d.source
      }));

      await kb.addDocuments(docsToAdd);
      totalDocs += documents.length;
    }

    expect(totalDocs).toBeGreaterThanOrEqual(3);

    // Search across all imported files
    const results = await kb.search('machine learning and programming', { limit: 10 });
    expect(results.length).toBeGreaterThan(0);

    // Verify different sources are present
    const sources = new Set(results.map(r => r.document.source));
    expect(sources.size).toBeGreaterThan(1);
  }, 30000);

  test('Workflow 10: Complete system health check', async () => {
    // Verify knowledge base is initialized
    expect(kb.isInitialized()).toBe(true);

    // Verify database has data
    const stats = kb.getStats();
    expect(stats.documents).toBeGreaterThan(0);

    // Verify search functionality
    const searchResults = await kb.search('test query', { limit: 1 });
    expect(Array.isArray(searchResults)).toBe(true);

    // Verify full-text search
    const ftsResults = kb.fulltextSearch('test', 1);
    expect(Array.isArray(ftsResults)).toBe(true);

    // Verify vector operations
    const allDocs = kb.getAllDocuments(10);
    expect(allDocs.length).toBeGreaterThan(0);
    expect(allDocs[0]).toHaveProperty('content');
    expect(allDocs[0]).toHaveProperty('id');

    // System is healthy
    console.log('✅ System health check passed');
    console.log(`   Documents: ${stats.documents}`);
    console.log(`   Vectors: ${stats.vectorCount}`);
    console.log(`   Tokens: ${stats.tokensUsed.toLocaleString()}`);
  }, 15000);
});
