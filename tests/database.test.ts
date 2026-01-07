import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { KnowledgeDB } from '../src/database/db';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB_PATH = './data/test-knowledge.db';

describe('KnowledgeDB', () => {
  let db: KnowledgeDB;

  beforeEach(() => {
    // Clean up test database if it exists
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(TEST_DB_PATH + '-wal')) {
      unlinkSync(TEST_DB_PATH + '-wal');
    }
    if (existsSync(TEST_DB_PATH + '-shm')) {
      unlinkSync(TEST_DB_PATH + '-shm');
    }

    db = new KnowledgeDB(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();

    // Clean up after tests
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(TEST_DB_PATH + '-wal')) {
      unlinkSync(TEST_DB_PATH + '-wal');
    }
    if (existsSync(TEST_DB_PATH + '-shm')) {
      unlinkSync(TEST_DB_PATH + '-shm');
    }
  });

  describe('Document Operations', () => {
    test('should insert and retrieve a document', () => {
      const docId = db.insertDocument({
        content: 'Test document content',
        metadata: { category: 'test' },
        source: 'test'
      });

      expect(docId).toBeGreaterThan(0);

      const doc = db.getDocument(docId);
      expect(doc).not.toBeNull();
      expect(doc?.content).toBe('Test document content');
      expect(doc?.metadata?.category).toBe('test');
      expect(doc?.source).toBe('test');
    });

    test('should return null for non-existent document', () => {
      const doc = db.getDocument(999);
      expect(doc).toBeNull();
    });

    test('should insert multiple documents', () => {
      const doc1Id = db.insertDocument({
        content: 'First document',
        source: 'test'
      });

      const doc2Id = db.insertDocument({
        content: 'Second document',
        source: 'test'
      });

      expect(doc1Id).toBeLessThan(doc2Id);

      const count = db.countDocuments();
      expect(count).toBe(2);
    });

    test('should get all documents', () => {
      db.insertDocument({ content: 'Doc 1', source: 'test' });
      db.insertDocument({ content: 'Doc 2', source: 'test' });
      db.insertDocument({ content: 'Doc 3', source: 'test' });

      const allDocs = db.getAllDocuments();
      expect(allDocs.length).toBe(3);
    });

    test('should get documents with limit', () => {
      db.insertDocument({ content: 'Doc 1', source: 'test' });
      db.insertDocument({ content: 'Doc 2', source: 'test' });
      db.insertDocument({ content: 'Doc 3', source: 'test' });

      const limitedDocs = db.getAllDocuments(2);
      expect(limitedDocs.length).toBe(2);
    });

    test('should delete a document', () => {
      const docId = db.insertDocument({
        content: 'To be deleted',
        source: 'test'
      });

      const deleted = db.deleteDocument(docId);
      expect(deleted).toBe(true);

      const doc = db.getDocument(docId);
      expect(doc).toBeNull();

      const count = db.countDocuments();
      expect(count).toBe(0);
    });

    test('should return false when deleting non-existent document', () => {
      const deleted = db.deleteDocument(999);
      expect(deleted).toBe(false);
    });
  });

  describe('Embedding Operations', () => {
    test('should insert and retrieve an embedding', () => {
      const docId = db.insertDocument({
        content: 'Document with embedding',
        source: 'test'
      });

      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      db.insertEmbedding(docId, embedding);

      const retrieved = db.getEmbedding(docId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.length).toBe(4);
      expect(retrieved?.[0]).toBeCloseTo(0.1);
      expect(retrieved?.[1]).toBeCloseTo(0.2);
    });

    test('should replace embedding on duplicate insert', () => {
      const docId = db.insertDocument({
        content: 'Document',
        source: 'test'
      });

      const embedding1 = new Float32Array([0.1, 0.2]);
      db.insertEmbedding(docId, embedding1);

      const embedding2 = new Float32Array([0.3, 0.4]);
      db.insertEmbedding(docId, embedding2);

      const retrieved = db.getEmbedding(docId);
      expect(retrieved?.[0]).toBeCloseTo(0.3);
      expect(retrieved?.[1]).toBeCloseTo(0.4);
    });

    test('should return null for non-existent embedding', () => {
      const embedding = db.getEmbedding(999);
      expect(embedding).toBeNull();
    });

    test('should cascade delete embedding when document is deleted', () => {
      const docId = db.insertDocument({
        content: 'Document',
        source: 'test'
      });

      const embedding = new Float32Array([0.1, 0.2]);
      db.insertEmbedding(docId, embedding);

      db.deleteDocument(docId);

      const retrieved = db.getEmbedding(docId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Full-Text Search', () => {
    test('should find documents using full-text search', () => {
      db.insertDocument({
        content: 'Machine learning is a subset of artificial intelligence',
        source: 'test'
      });

      db.insertDocument({
        content: 'Deep learning uses neural networks',
        source: 'test'
      });

      db.insertDocument({
        content: 'Natural language processing helps computers understand text',
        source: 'test'
      });

      const results = db.fulltextSearch('learning');
      expect(results.length).toBeGreaterThan(0);

      const contents = results.map(r => r.content);
      expect(contents.some(c => c.includes('Machine learning'))).toBe(true);
      expect(contents.some(c => c.includes('Deep learning'))).toBe(true);
    });

    test('should respect search limit', () => {
      for (let i = 0; i < 10; i++) {
        db.insertDocument({
          content: `Document ${i} about testing search functionality`,
          source: 'test'
        });
      }

      const results = db.fulltextSearch('search', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    test('should return empty array when no matches', () => {
      db.insertDocument({
        content: 'This is a test document',
        source: 'test'
      });

      const results = db.fulltextSearch('nonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('Named Vectors', () => {
    test('should save and retrieve a named vector', () => {
      const vector = new Float32Array([0.1, 0.2, 0.3]);
      db.saveNamedVector('test_handle', vector, 'Test description');

      const retrieved = db.getNamedVector('test_handle');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.handle).toBe('test_handle');
      expect(retrieved?.description).toBe('Test description');
      expect(retrieved?.vector.length).toBe(3);
      expect(retrieved?.vector[0]).toBeCloseTo(0.1);
    });

    test('should update existing named vector', () => {
      const vector1 = new Float32Array([0.1, 0.2]);
      db.saveNamedVector('handle', vector1, 'First description');

      const vector2 = new Float32Array([0.3, 0.4]);
      db.saveNamedVector('handle', vector2, 'Updated description');

      const retrieved = db.getNamedVector('handle');
      expect(retrieved?.vector[0]).toBeCloseTo(0.3);
      expect(retrieved?.description).toBe('Updated description');
    });

    test('should return null for non-existent named vector', () => {
      const vector = db.getNamedVector('nonexistent');
      expect(vector).toBeNull();
    });

    test('should get all named vectors', () => {
      db.saveNamedVector('vec1', new Float32Array([0.1, 0.2]));
      db.saveNamedVector('vec2', new Float32Array([0.3, 0.4]));
      db.saveNamedVector('vec3', new Float32Array([0.5, 0.6]));

      const allVectors = db.getAllNamedVectors();
      expect(allVectors.length).toBe(3);

      const handles = allVectors.map(v => v.handle);
      expect(handles).toContain('vec1');
      expect(handles).toContain('vec2');
      expect(handles).toContain('vec3');
    });

    test('should delete a named vector', () => {
      db.saveNamedVector('to_delete', new Float32Array([0.1, 0.2]));

      const deleted = db.deleteNamedVector('to_delete');
      expect(deleted).toBe(true);

      const retrieved = db.getNamedVector('to_delete');
      expect(retrieved).toBeNull();
    });

    test('should return false when deleting non-existent named vector', () => {
      const deleted = db.deleteNamedVector('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('should return accurate statistics', () => {
      // Add documents
      const doc1Id = db.insertDocument({ content: 'Doc 1', source: 'test' });
      const doc2Id = db.insertDocument({ content: 'Doc 2', source: 'test' });

      // Add embeddings
      db.insertEmbedding(doc1Id, new Float32Array([0.1, 0.2]));
      db.insertEmbedding(doc2Id, new Float32Array([0.3, 0.4]));

      // Add named vectors
      db.saveNamedVector('vec1', new Float32Array([0.5, 0.6]));

      const stats = db.getStats();
      expect(stats.documents).toBe(2);
      expect(stats.embeddings).toBe(2);
      expect(stats.namedVectors).toBe(1);
    });

    test('should return zero stats for empty database', () => {
      const stats = db.getStats();
      expect(stats.documents).toBe(0);
      expect(stats.embeddings).toBe(0);
      expect(stats.namedVectors).toBe(0);
    });
  });
});
