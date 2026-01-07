import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { KnowledgeBase } from '../src';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB_PATH = './data/test-integration-knowledge.db';
const TEST_INDEX_PATH = './data/test-integration-vectors.index';

// Only run integration tests if API key is available
const apiKey = process.env.OPENAI_API_KEY;
const shouldRunTests = apiKey && !apiKey.includes('your-api-key-here');

describe('KnowledgeBase Integration', () => {
  if (!shouldRunTests) {
    test.skip('Integration tests require valid OPENAI_API_KEY', () => {});
    return;
  }

  let kb: KnowledgeBase;

  beforeEach(async () => {
    // Clean up test files
    [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm', TEST_INDEX_PATH].forEach(file => {
      if (existsSync(file)) unlinkSync(file);
    });

    kb = new KnowledgeBase({
      openaiKey: apiKey!,
      dbPath: TEST_DB_PATH,
      indexPath: TEST_INDEX_PATH
    });

    await kb.initialize();
  });

  afterEach(async () => {
    await kb.close();

    // Clean up
    [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm', TEST_INDEX_PATH].forEach(file => {
      if (existsSync(file)) unlinkSync(file);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      expect(kb.isInitialized()).toBe(true);
    }, 5000);

    test('should get initial stats', () => {
      const stats = kb.getStats();
      expect(stats.documents).toBe(0);
      expect(stats.embeddings).toBe(0);
      expect(stats.vectorCount).toBe(0);
      expect(stats.dimension).toBe(1536);
    }, 5000);
  });

  describe('Document Management', () => {
    test('should add a document', async () => {
      const docId = await kb.addDocument(
        'Vector databases enable semantic search using embeddings',
        { category: 'technology' },
        'test'
      );

      expect(docId).toBeGreaterThan(0);

      const doc = kb.getDocument(docId);
      expect(doc).not.toBeNull();
      expect(doc?.content).toContain('Vector databases');
      expect(doc?.metadata?.category).toBe('technology');
    }, 15000);

    test('should add multiple documents in batch', async () => {
      const docs = [
        { content: 'Machine learning enables AI systems', metadata: { tag: 'ml' } },
        { content: 'Deep learning uses neural networks', metadata: { tag: 'dl' } },
        { content: 'Natural language processing understands text', metadata: { tag: 'nlp' } }
      ];

      const ids = await kb.addDocuments(docs);

      expect(ids.length).toBe(3);
      ids.forEach(id => {
        const doc = kb.getDocument(id);
        expect(doc).not.toBeNull();
      });
    }, 20000);

    test('should get all documents', async () => {
      await kb.addDocument('First doc', {}, 'test');
      await kb.addDocument('Second doc', {}, 'test');

      const allDocs = kb.getAllDocuments();
      expect(allDocs.length).toBe(2);
    }, 15000);

    test('should delete a document', async () => {
      const docId = await kb.addDocument('To be deleted', {}, 'test');
      expect(kb.getDocument(docId)).not.toBeNull();

      const deleted = await kb.deleteDocument(docId);
      expect(deleted).toBe(true);
      expect(kb.getDocument(docId)).toBeNull();
    }, 15000);
  });

  describe('Semantic Search', () => {
    beforeEach(async () => {
      // Add sample documents
      await kb.addDocuments([
        { content: 'Vector databases store embeddings for semantic search', metadata: { topic: 'vectors' } },
        { content: 'Machine learning models can understand natural language', metadata: { topic: 'ml' } },
        { content: 'Neural networks process data through layers', metadata: { topic: 'dl' } },
        { content: 'Python is a popular programming language', metadata: { topic: 'programming' } },
        { content: 'JavaScript runs in web browsers', metadata: { topic: 'programming' } }
      ]);
    }, 30000);

    test('should find semantically similar documents', async () => {
      const results = await kb.search('semantic similarity search');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.document.content).toContain('Vector databases');
      expect(results[0]!.similarity).toBeGreaterThan(0.4);
    }, 15000);

    test('should respect limit parameter', async () => {
      const results = await kb.search('programming', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    }, 15000);

    test('should respect threshold parameter', async () => {
      const results = await kb.search('programming', { threshold: 0.9 });
      // High threshold should filter out most results
      results.forEach(r => {
        expect(r.similarity).toBeGreaterThanOrEqual(0.9);
      });
    }, 15000);

    test('should return empty array for unrelated query', async () => {
      const results = await kb.search('quantum physics superconductors', { threshold: 0.8 });
      expect(results.length).toBe(0);
    }, 15000);
  });

  describe('Full-Text Search', () => {
    beforeEach(async () => {
      await kb.addDocuments([
        { content: 'TypeScript is a typed superset of JavaScript' },
        { content: 'Python is dynamically typed' },
        { content: 'Rust provides memory safety without garbage collection' }
      ]);
    }, 20000);

    test('should find documents with FTS', () => {
      const results = kb.fulltextSearch('TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.content).toContain('TypeScript');
    });

    test('should handle OR queries', () => {
      const results = kb.fulltextSearch('Python OR Rust');
      expect(results.length).toBe(2);
    });
  });

  describe('Named Vectors', () => {
    test('should save and retrieve named vector', async () => {
      await kb.saveNamedVector(
        'ai_research',
        'artificial intelligence and machine learning research',
        'AI research concepts'
      );

      const vector = kb.getNamedVector('ai_research');
      expect(vector).not.toBeNull();
      expect(vector?.handle).toBe('ai_research');
      expect(vector?.description).toBe('AI research concepts');
      expect(vector?.vector.length).toBe(1536);
    }, 10000);

    test('should get all named vectors', async () => {
      await kb.saveNamedVector('vec1', 'first concept');
      await kb.saveNamedVector('vec2', 'second concept');

      const vectors = kb.getAllNamedVectors();
      expect(vectors.length).toBe(2);
    }, 15000);

    test('should delete named vector', async () => {
      await kb.saveNamedVector('to_delete', 'temporary vector');
      expect(kb.getNamedVector('to_delete')).not.toBeNull();

      const deleted = kb.deleteNamedVector('to_delete');
      expect(deleted).toBe(true);
      expect(kb.getNamedVector('to_delete')).toBeNull();
    }, 10000);
  });

  describe('Vector Algebra', () => {
    beforeEach(async () => {
      // Create named vectors for testing
      await kb.saveNamedVector('ai_practical', 'hands-on machine learning tutorials and code examples');
      await kb.saveNamedVector('ai_theory', 'theoretical research papers and mathematical proofs');
      await kb.saveNamedVector('programming', 'software development and coding');
    }, 20000);

    test('should perform vector addition', async () => {
      const result = await kb.vectorAlgebra([
        { type: 'add', handle: 'ai_practical' },
        { type: 'add', handle: 'programming', weight: 0.5 }
      ]);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(1536);
    }, 5000);

    test('should perform vector subtraction', async () => {
      const result = await kb.vectorAlgebra([
        { type: 'add', handle: 'ai_practical' },
        { type: 'subtract', handle: 'ai_theory' }
      ]);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(1536);
    }, 5000);

    test('should search with vector algebra', async () => {
      // Add some documents first
      await kb.addDocuments([
        { content: 'Practical guide to building neural networks with code examples' },
        { content: 'Theoretical foundations of deep learning mathematics' },
        { content: 'Tutorial: Implementing machine learning algorithms step-by-step' }
      ]);

      // Search for practical AI (practical + subtract theory)
      const results = await kb.searchWithVectorAlgebra([
        { type: 'add', handle: 'ai_practical' },
        { type: 'subtract', handle: 'ai_theory' }
      ], { limit: 3 });

      expect(results.length).toBeGreaterThan(0);
      // Practical content should rank higher
      const topContent = results[0]!.document.content.toLowerCase();
      expect(
        topContent.includes('practical') ||
        topContent.includes('tutorial') ||
        topContent.includes('guide')
      ).toBe(true);
    }, 25000);
  });

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      await kb.addDocuments([
        { content: 'Machine learning with Python programming language' },
        { content: 'Deep learning neural networks in PyTorch' },
        { content: 'JavaScript web development tutorial' },
        { content: 'Rust systems programming guide' },
        { content: 'Python data science and machine learning' }
      ]);
    }, 30000);

    test('should combine SQL and semantic search', async () => {
      const results = await kb.hybridSearch(
        'Python',           // SQL query
        'machine learning', // Semantic query
        5
      );

      expect(results.length).toBeGreaterThan(0);

      // Documents matching both should score highest
      const topDoc = results[0]!.document.content;
      expect(topDoc.toLowerCase()).toContain('python');
      expect(
        topDoc.toLowerCase().includes('machine') ||
        topDoc.toLowerCase().includes('learning')
      ).toBe(true);
    }, 20000);

    test('should handle queries with no overlap', async () => {
      const results = await kb.hybridSearch(
        'JavaScript',
        'data structures',
        5
      );

      expect(results.length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('Statistics', () => {
    test('should track statistics accurately', async () => {
      const initialStats = kb.getStats();
      expect(initialStats.documents).toBe(0);

      await kb.addDocument('Test document');

      const finalStats = kb.getStats();
      expect(finalStats.documents).toBe(1);
      expect(finalStats.embeddings).toBe(1);
      expect(finalStats.vectorCount).toBe(1);
      expect(finalStats.tokensUsed).toBeGreaterThan(0);
    }, 15000);

    test('should track named vectors in stats', async () => {
      await kb.saveNamedVector('test_vec', 'test content');

      const stats = kb.getStats();
      expect(stats.namedVectors).toBe(1);
    }, 10000);
  });
});
