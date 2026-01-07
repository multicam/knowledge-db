import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { VectorStore } from '../src/vector/hnswlib';
import { unlinkSync, existsSync } from 'fs';

const TEST_INDEX_PATH = './data/test-vectors.index';

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(async () => {
    // Clean up test index if it exists
    if (existsSync(TEST_INDEX_PATH)) {
      unlinkSync(TEST_INDEX_PATH);
    }

    store = new VectorStore(3, TEST_INDEX_PATH); // Use dimension 3 for testing
    await store.initialize(1000);
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(TEST_INDEX_PATH)) {
      unlinkSync(TEST_INDEX_PATH);
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      expect(store.isInitialized()).toBe(true);
      expect(store.getDimension()).toBe(3);
      expect(store.getCount()).toBe(0);
    });

    test('should throw error when not initialized', () => {
      const uninitStore = new VectorStore(3, TEST_INDEX_PATH);
      expect(() => {
        uninitStore.addVector(1, new Float32Array([1, 2, 3]));
      }).toThrow('not initialized');
    });
  });

  describe('Adding Vectors', () => {
    test('should add a vector', () => {
      const vector = new Float32Array([1.0, 2.0, 3.0]);
      store.addVector(1, vector);
      expect(store.getCount()).toBe(1);
    });

    test('should add multiple vectors', () => {
      store.addVector(1, new Float32Array([1.0, 2.0, 3.0]));
      store.addVector(2, new Float32Array([4.0, 5.0, 6.0]));
      store.addVector(3, new Float32Array([7.0, 8.0, 9.0]));
      expect(store.getCount()).toBe(3);
    });

    test('should throw error for wrong dimension', () => {
      expect(() => {
        store.addVector(1, new Float32Array([1.0, 2.0])); // Wrong dimension
      }).toThrow('dimension mismatch');
    });
  });

  describe('Vector Search', () => {
    beforeEach(() => {
      // Add some test vectors
      store.addVector(1, new Float32Array([1.0, 0.0, 0.0]));
      store.addVector(2, new Float32Array([0.0, 1.0, 0.0]));
      store.addVector(3, new Float32Array([0.0, 0.0, 1.0]));
      store.addVector(4, new Float32Array([1.0, 1.0, 0.0]));
      store.addVector(5, new Float32Array([0.5, 0.5, 0.0]));
    });

    test('should find nearest neighbors', () => {
      const query = new Float32Array([1.0, 0.1, 0.0]);
      const results = store.search(query, 3);

      expect(results.length).toBe(3);
      expect(results[0]!.id).toBe(1); // Should be closest to [1,0,0]
    });

    test('should respect k limit', () => {
      const query = new Float32Array([1.0, 0.0, 0.0]);
      const results = store.search(query, 2);
      expect(results.length).toBe(2);
    });

    test('should return empty array for empty index', async () => {
      const emptyStore = new VectorStore(3, './data/empty-test.index');
      await emptyStore.initialize();

      const results = emptyStore.search(new Float32Array([1, 2, 3]), 5);
      expect(results.length).toBe(0);

      if (existsSync('./data/empty-test.index')) {
        unlinkSync('./data/empty-test.index');
      }
    });

    test('should throw error for wrong dimension in search', () => {
      expect(() => {
        store.search(new Float32Array([1.0, 2.0]), 5);
      }).toThrow('dimension mismatch');
    });

    test('should limit k to number of elements', () => {
      const query = new Float32Array([1.0, 0.0, 0.0]);
      const results = store.search(query, 100); // Ask for more than we have
      expect(results.length).toBeLessThanOrEqual(store.getCount());
    });
  });

  describe('Index Persistence', () => {
    test('should save and load index', async () => {
      // Add vectors and save
      store.addVector(1, new Float32Array([1.0, 2.0, 3.0]));
      store.addVector(2, new Float32Array([4.0, 5.0, 6.0]));
      await store.save();

      // Create new store and load
      const newStore = new VectorStore(3, TEST_INDEX_PATH);
      await newStore.initialize();

      expect(newStore.getCount()).toBe(2);

      // Search should work
      const results = newStore.search(new Float32Array([1.0, 2.0, 3.0]), 1);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should throw error when saving uninitialized store', async () => {
      const uninitStore = new VectorStore(3, TEST_INDEX_PATH);
      await expect(uninitStore.save()).rejects.toThrow('not initialized');
    });
  });

  describe('Vector Algebra', () => {
    describe('Addition', () => {
      test('should add two vectors', () => {
        const v1 = new Float32Array([1.0, 2.0, 3.0]);
        const v2 = new Float32Array([4.0, 5.0, 6.0]);
        const result = VectorStore.add(v1, v2);

        expect(result.length).toBe(3);
        // Result should be normalized
        const magnitude = VectorStore.magnitude(result);
        expect(magnitude).toBeCloseTo(1.0, 5);
      });

      test('should add with weight', () => {
        const v1 = new Float32Array([1.0, 0.0, 0.0]);
        const v2 = new Float32Array([0.0, 1.0, 0.0]);
        const result = VectorStore.add(v1, v2, 2.0);

        expect(result.length).toBe(3);
      });

      test('should throw error for dimension mismatch', () => {
        const v1 = new Float32Array([1.0, 2.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        expect(() => VectorStore.add(v1, v2)).toThrow('dimension mismatch');
      });
    });

    describe('Subtraction', () => {
      test('should subtract two vectors', () => {
        const v1 = new Float32Array([4.0, 5.0, 6.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        const result = VectorStore.subtract(v1, v2);

        expect(result.length).toBe(3);
        const magnitude = VectorStore.magnitude(result);
        expect(magnitude).toBeCloseTo(1.0, 5);
      });

      test('should throw error for dimension mismatch', () => {
        const v1 = new Float32Array([1.0, 2.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        expect(() => VectorStore.subtract(v1, v2)).toThrow('dimension mismatch');
      });
    });

    describe('Multiplication', () => {
      test('should multiply vector by scalar', () => {
        const v = new Float32Array([1.0, 2.0, 3.0]);
        const result = VectorStore.multiply(v, 2.0);

        expect(result[0]).toBeCloseTo(2.0);
        expect(result[1]).toBeCloseTo(4.0);
        expect(result[2]).toBeCloseTo(6.0);
      });

      test('should multiply by zero', () => {
        const v = new Float32Array([1.0, 2.0, 3.0]);
        const result = VectorStore.multiply(v, 0);

        expect(result[0]).toBe(0);
        expect(result[1]).toBe(0);
        expect(result[2]).toBe(0);
      });
    });

    describe('Normalization', () => {
      test('should normalize a vector', () => {
        const v = new Float32Array([3.0, 4.0, 0.0]);
        const result = VectorStore.normalize(v);

        const magnitude = VectorStore.magnitude(result);
        expect(magnitude).toBeCloseTo(1.0, 5);
      });

      test('should handle zero vector', () => {
        const v = new Float32Array([0.0, 0.0, 0.0]);
        const result = VectorStore.normalize(v);

        expect(result[0]).toBe(0);
        expect(result[1]).toBe(0);
        expect(result[2]).toBe(0);
      });
    });

    describe('Magnitude', () => {
      test('should calculate vector magnitude', () => {
        const v = new Float32Array([3.0, 4.0, 0.0]);
        const mag = VectorStore.magnitude(v);
        expect(mag).toBeCloseTo(5.0);
      });

      test('should return zero for zero vector', () => {
        const v = new Float32Array([0.0, 0.0, 0.0]);
        const mag = VectorStore.magnitude(v);
        expect(mag).toBe(0);
      });
    });

    describe('Dot Product', () => {
      test('should calculate dot product', () => {
        const v1 = new Float32Array([1.0, 2.0, 3.0]);
        const v2 = new Float32Array([4.0, 5.0, 6.0]);
        const result = VectorStore.dotProduct(v1, v2);

        expect(result).toBe(32.0); // 1*4 + 2*5 + 3*6
      });

      test('should return zero for orthogonal vectors', () => {
        const v1 = new Float32Array([1.0, 0.0, 0.0]);
        const v2 = new Float32Array([0.0, 1.0, 0.0]);
        const result = VectorStore.dotProduct(v1, v2);

        expect(result).toBe(0);
      });

      test('should throw error for dimension mismatch', () => {
        const v1 = new Float32Array([1.0, 2.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        expect(() => VectorStore.dotProduct(v1, v2)).toThrow('dimension mismatch');
      });
    });

    describe('Cosine Similarity', () => {
      test('should calculate cosine similarity for identical vectors', () => {
        const v1 = new Float32Array([1.0, 2.0, 3.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        const sim = VectorStore.cosineSimilarity(v1, v2);

        expect(sim).toBeCloseTo(1.0, 5);
      });

      test('should calculate cosine similarity for opposite vectors', () => {
        const v1 = new Float32Array([1.0, 2.0, 3.0]);
        const v2 = new Float32Array([-1.0, -2.0, -3.0]);
        const sim = VectorStore.cosineSimilarity(v1, v2);

        expect(sim).toBeCloseTo(-1.0, 5);
      });

      test('should calculate cosine similarity for orthogonal vectors', () => {
        const v1 = new Float32Array([1.0, 0.0, 0.0]);
        const v2 = new Float32Array([0.0, 1.0, 0.0]);
        const sim = VectorStore.cosineSimilarity(v1, v2);

        expect(sim).toBeCloseTo(0.0, 5);
      });

      test('should handle zero vectors', () => {
        const v1 = new Float32Array([0.0, 0.0, 0.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        const sim = VectorStore.cosineSimilarity(v1, v2);

        expect(sim).toBe(0);
      });

      test('should throw error for dimension mismatch', () => {
        const v1 = new Float32Array([1.0, 2.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        expect(() => VectorStore.cosineSimilarity(v1, v2)).toThrow('dimension mismatch');
      });
    });

    describe('Euclidean Distance', () => {
      test('should calculate Euclidean distance', () => {
        const v1 = new Float32Array([0.0, 0.0, 0.0]);
        const v2 = new Float32Array([3.0, 4.0, 0.0]);
        const dist = VectorStore.euclideanDistance(v1, v2);

        expect(dist).toBeCloseTo(5.0);
      });

      test('should return zero for identical vectors', () => {
        const v1 = new Float32Array([1.0, 2.0, 3.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        const dist = VectorStore.euclideanDistance(v1, v2);

        expect(dist).toBeCloseTo(0.0, 5);
      });

      test('should throw error for dimension mismatch', () => {
        const v1 = new Float32Array([1.0, 2.0]);
        const v2 = new Float32Array([1.0, 2.0, 3.0]);
        expect(() => VectorStore.euclideanDistance(v1, v2)).toThrow('dimension mismatch');
      });
    });
  });
});
