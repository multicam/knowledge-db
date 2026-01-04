// Vector store implementation - to be implemented in Phase 3
import { HierarchicalNSW } from 'hnswlib-node';

export class VectorStore {
  private index: HierarchicalNSW;
  private dimension: number;
  private indexPath: string;

  constructor(dimension: number = 1536, indexPath: string = './data/vectors.index') {
    this.dimension = dimension;
    this.indexPath = indexPath;
    this.index = new HierarchicalNSW('cosine', dimension);
  }

  async initialize(maxElements: number = 100000) {
    try {
      // Try to load existing index
      await this.index.readIndex(this.indexPath);
      console.log('Loaded existing vector index');
    } catch {
      // Create new index
      this.index.initIndex(maxElements);
      console.log('Created new vector index');
    }
  }

  addVector(id: number, vector: Float32Array) {
    this.index.addPoint(vector, id);
  }

  search(vector: Float32Array, k: number = 10): { id: number; distance: number }[] {
    const result = this.index.searchKnn(vector, k);
    return result.neighbors.map((id, idx) => ({
      id,
      distance: result.distances[idx]
    }));
  }

  async save() {
    await this.index.writeIndex(this.indexPath);
  }

  // Vector algebra operations
  static add(v1: Float32Array, v2: Float32Array, weight: number = 1.0): Float32Array {
    const result = new Float32Array(v1.length);
    for (let i = 0; i < v1.length; i++) {
      result[i] = v1[i] + weight * v2[i];
    }
    return VectorStore.normalize(result);
  }

  static subtract(v1: Float32Array, v2: Float32Array, weight: number = 1.0): Float32Array {
    const result = new Float32Array(v1.length);
    for (let i = 0; i < v1.length; i++) {
      result[i] = v1[i] - weight * v2[i];
    }
    return VectorStore.normalize(result);
  }

  static normalize(v: Float32Array): Float32Array {
    const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    return v.map(val => val / magnitude) as any as Float32Array;
  }

  static cosineSimilarity(v1: Float32Array, v2: Float32Array): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }

    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }
}
