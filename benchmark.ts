#!/usr/bin/env bun
// Performance benchmark script - Phase 8

import { KnowledgeBase } from './src';
import { unlinkSync, existsSync } from 'fs';

const BENCHMARK_DB_PATH = './data/benchmark-knowledge.db';
const BENCHMARK_INDEX_PATH = './data/benchmark-vectors.index';

// Color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printResult(name: string, time: number, unit: string = 'ms') {
  const formattedTime = unit === 'ms' ? formatTime(time) : `${time.toFixed(2)} ${unit}`;
  console.log(`  ${colorize('•', 'dim')} ${name}: ${colorize(formattedTime, 'cyan')}`);
}

async function benchmark() {
  if (!process.env.OPENAI_API_KEY) {
    console.error(colorize('Error: OPENAI_API_KEY not set', 'yellow'));
    process.exit(1);
  }

  console.log(colorize('\n⚡ Knowledge Database Performance Benchmark', 'bold'));
  console.log(colorize('─'.repeat(60), 'dim'));

  // Clean up
  [BENCHMARK_DB_PATH, BENCHMARK_DB_PATH + '-wal', BENCHMARK_DB_PATH + '-shm', BENCHMARK_INDEX_PATH].forEach(file => {
    if (existsSync(file)) unlinkSync(file);
  });

  const kb = new KnowledgeBase({
    openaiKey: process.env.OPENAI_API_KEY,
    dbPath: BENCHMARK_DB_PATH,
    indexPath: BENCHMARK_INDEX_PATH
  });

  // Benchmark initialization
  console.log(colorize('\n📊 Initialization', 'bold'));
  let start = performance.now();
  await kb.initialize();
  printResult('Initialize (new database)', performance.now() - start);

  // Add a few documents to test with
  await kb.addDocument('Initial test document for benchmarking');

  await kb.close();

  // Benchmark re-initialization with existing database
  const kb2 = new KnowledgeBase({
    openaiKey: process.env.OPENAI_API_KEY,
    dbPath: BENCHMARK_DB_PATH,
    indexPath: BENCHMARK_INDEX_PATH
  });

  start = performance.now();
  await kb2.initialize();
  printResult('Initialize (existing database)', performance.now() - start);

  // Benchmark single document addition
  console.log(colorize('\n📝 Document Operations', 'bold'));

  start = performance.now();
  const id1 = await kb2.addDocument('Vector databases enable semantic search using embeddings');
  const singleAddTime = performance.now() - start;
  printResult('Add single document', singleAddTime);

  // Benchmark batch document addition
  const batchDocs = Array(5).fill(null).map((_, i) => ({
    content: `Document ${i + 1} about machine learning and artificial intelligence with neural networks`,
    metadata: { index: i }
  }));

  start = performance.now();
  await kb2.addDocuments(batchDocs);
  const batchAddTime = performance.now() - start;
  printResult('Add 5 documents (batch)', batchAddTime);
  printResult('Average per document', batchAddTime / 5);

  // Add more documents for search benchmarks
  const moreDocs = Array(10).fill(null).map((_, i) => ({
    content: `Additional document ${i} covering topics like data science, Python programming, deep learning frameworks`
  }));
  await kb2.addDocuments(moreDocs);

  // Benchmark search operations
  console.log(colorize('\n🔍 Search Operations', 'bold'));

  start = performance.now();
  const searchResults = await kb2.search('machine learning', { limit: 10 });
  printResult('Semantic search (10 results)', performance.now() - start);

  start = performance.now();
  const ftsResults = kb2.fulltextSearch('machine learning', 10);
  printResult('Full-text search (10 results)', performance.now() - start);

  start = performance.now();
  const hybridResults = await kb2.hybridSearch('machine', 'artificial intelligence', 10);
  printResult('Hybrid search (10 results)', performance.now() - start);

  // Benchmark document retrieval
  console.log(colorize('\n📖 Document Retrieval', 'bold'));

  start = performance.now();
  const doc = kb2.getDocument(id1);
  printResult('Get single document by ID', performance.now() - start);

  start = performance.now();
  const allDocs = kb2.getAllDocuments(20);
  printResult('Get all documents (limit 20)', performance.now() - start);

  // Benchmark named vectors
  console.log(colorize('\n🏷️  Named Vector Operations', 'bold'));

  start = performance.now();
  await kb2.saveNamedVector('test_vec', 'artificial intelligence concepts');
  printResult('Save named vector', performance.now() - start);

  start = performance.now();
  const vec = kb2.getNamedVector('test_vec');
  printResult('Get named vector', performance.now() - start);

  start = performance.now();
  const algebraResults = await kb2.searchWithVectorAlgebra([
    { type: 'add', handle: 'test_vec' }
  ], { limit: 10 });
  printResult('Vector algebra search', performance.now() - start);

  // Benchmark stats
  console.log(colorize('\n📊 Statistics', 'bold'));

  start = performance.now();
  const stats = kb2.getStats();
  printResult('Get statistics', performance.now() - start);

  // Display final stats
  console.log(colorize('\n💾 Database Statistics', 'bold'));
  console.log(`  ${colorize('•', 'dim')} Documents: ${colorize(stats.documents.toString(), 'cyan')}`);
  console.log(`  ${colorize('•', 'dim')} Vectors: ${colorize(stats.vectorCount.toString(), 'cyan')}`);
  console.log(`  ${colorize('•', 'dim')} Named Vectors: ${colorize(stats.namedVectors.toString(), 'cyan')}`);
  console.log(`  ${colorize('•', 'dim')} Dimension: ${colorize(stats.dimension.toString(), 'cyan')}`);
  console.log(`  ${colorize('•', 'dim')} Tokens Used: ${colorize(stats.tokensUsed.toLocaleString(), 'cyan')}`);

  const cost = stats.tokensUsed * 0.00002 / 1000;
  console.log(`  ${colorize('•', 'dim')} Estimated Cost: ${colorize(`$${cost.toFixed(6)}`, 'cyan')}`);

  // Throughput estimates
  console.log(colorize('\n⚡ Throughput Estimates', 'bold'));

  const docsPerSec = 1000 / (batchAddTime / 5);
  printResult('Document ingestion', docsPerSec, 'docs/sec');

  const searchesPerSec = 1000 / singleAddTime;
  printResult('Semantic search', searchesPerSec, 'queries/sec (with API latency)');

  // Memory usage
  console.log(colorize('\n💾 Memory Usage', 'bold'));
  const memUsage = process.memoryUsage();
  console.log(`  ${colorize('•', 'dim')} Heap Used: ${colorize((memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB', 'cyan')}`);
  console.log(`  ${colorize('•', 'dim')} RSS: ${colorize((memUsage.rss / 1024 / 1024).toFixed(2) + ' MB', 'cyan')}`);

  await kb2.close();

  // Clean up
  [BENCHMARK_DB_PATH, BENCHMARK_DB_PATH + '-wal', BENCHMARK_DB_PATH + '-shm', BENCHMARK_INDEX_PATH].forEach(file => {
    if (existsSync(file)) unlinkSync(file);
  });

  console.log(colorize('\n✅ Benchmark complete!\n', 'green'));
}

try {
  await benchmark();
} catch (error) {
  console.error(colorize(`\nError: ${error}`, 'yellow'));
  process.exit(1);
}
