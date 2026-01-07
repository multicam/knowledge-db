// Vector store implementation - Phase 3
import { HierarchicalNSW } from 'hnswlib-node';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

export class VectorStore {
  private index: HierarchicalNSW;
  private dimension: number;
  private indexPath: string;
  private maxElements: number;
  private numElements: number = 0;
  private initialized: boolean = false;

  constructor(dimension: number = 1536, indexPath: string = './data/vectors.index') {
    this.dimension = dimension;
    this.indexPath = indexPath;
    this.maxElements = 100000;
    this.index = new HierarchicalNSW('cosine', dimension);
  }

  async initialize(maxElements: number = 100000): Promise<void> {
    try {
      this.maxElements = maxElements;

      // Ensure directory exists
      const dir = path.dirname(this.indexPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Try to load existing index
      if (existsSync(this.indexPath)) {
        try {
          await this.index.readIndex(this.indexPath);
          this.numElements = this.index.getCurrentCount();
          console.log(`Loaded existing vector index with ${this.numElements} vectors`);
        } catch (error) {
          console.warn(`Failed to load index, creating new one: ${error}`);
          this.index.initIndex(maxElements);
        }
      } else {
        // Create new index
        this.index.initIndex(maxElements);
        console.log('Created new vector index');
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize vector store: ${error}`);
    }
  }

  addVector(id: number, vector: Float32Array): void {
    if (!this.initialized) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }

    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`);
    }

    try {
      // Convert Float32Array to regular array for hnswlib compatibility
      const vectorArray = Array.from(vector);
      this.index.addPoint(vectorArray, id);
      this.numElements++;
    } catch (error) {
      throw new Error(`Failed to add vector for id ${id}: ${error}`);
    }
  }

  search(vector: Float32Array, k: number = 10): { id: number; distance: number }[] {
    if (!this.initialized) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }

    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`);
    }

    if (this.numElements === 0) {
      return [];
    }

    try {
      // Convert Float32Array to regular array for hnswlib compatibility
      const vectorArray = Array.from(vector);
      const actualK = Math.min(k, this.numElements);
      const result = this.index.searchKnn(vectorArray, actualK);

      return result.neighbors.map((id, idx) => ({
        id,
        distance: result.distances[idx] ?? 0
      }));
    } catch (error) {
      throw new Error(`Failed to search vectors: ${error}`);
    }
  }

  async save(): Promise<void> {
    if (!this.initialized) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }

    try {
      await this.index.writeIndex(this.indexPath);
    } catch (error) {
      throw new Error(`Failed to save vector index: ${error}`);
    }
  }

  getCount(): number {
    return this.numElements;
  }

  getDimension(): number {
    return this.dimension;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Vector algebra operations
  static add(v1: Float32Array, v2: Float32Array, weight: number = 1.0): Float32Array {
    if (v1.length !== v2.length) {
      throw new Error(`Vector dimension mismatch: ${v1.length} vs ${v2.length}`);
    }

    const result = new Float32Array(v1.length);
    for (let i = 0; i < v1.length; i++) {
      result[i] = (v1[i] ?? 0) + weight * (v2[i] ?? 0);
    }
    return VectorStore.normalize(result);
  }

  static subtract(v1: Float32Array, v2: Float32Array, weight: number = 1.0): Float32Array {
    if (v1.length !== v2.length) {
      throw new Error(`Vector dimension mismatch: ${v1.length} vs ${v2.length}`);
    }

    const result = new Float32Array(v1.length);
    for (let i = 0; i < v1.length; i++) {
      result[i] = (v1[i] ?? 0) - weight * (v2[i] ?? 0);
    }
    return VectorStore.normalize(result);
  }

  static multiply(v: Float32Array, scalar: number): Float32Array {
    const result = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) {
      result[i] = (v[i] ?? 0) * scalar;
    }
    return result;
  }

  static normalize(v: Float32Array): Float32Array {
    const magnitude = Math.sqrt(v.reduce((sum, val) => sum + (val ?? 0) * (val ?? 0), 0));

    if (magnitude === 0) {
      return v; // Return zero vector as-is
    }

    const result = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) {
      result[i] = (v[i] ?? 0) / magnitude;
    }
    return result;
  }

  static magnitude(v: Float32Array): number {
    return Math.sqrt(v.reduce((sum, val) => sum + (val ?? 0) * (val ?? 0), 0));
  }

  static dotProduct(v1: Float32Array, v2: Float32Array): number {
    if (v1.length !== v2.length) {
      throw new Error(`Vector dimension mismatch: ${v1.length} vs ${v2.length}`);
    }

    let result = 0;
    for (let i = 0; i < v1.length; i++) {
      result += (v1[i] ?? 0) * (v2[i] ?? 0);
    }
    return result;
  }

  static cosineSimilarity(v1: Float32Array, v2: Float32Array): number {
    if (v1.length !== v2.length) {
      throw new Error(`Vector dimension mismatch: ${v1.length} vs ${v2.length}`);
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < v1.length; i++) {
      const val1 = v1[i] ?? 0;
      const val2 = v2[i] ?? 0;
      dotProduct += val1 * val2;
      mag1 += val1 * val1;
      mag2 += val2 * val2;
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  static euclideanDistance(v1: Float32Array, v2: Float32Array): number {
    if (v1.length !== v2.length) {
      throw new Error(`Vector dimension mismatch: ${v1.length} vs ${v2.length}`);
    }

    let sumSquares = 0;
    for (let i = 0; i < v1.length; i++) {
      const diff = (v1[i] ?? 0) - (v2[i] ?? 0);
      sumSquares += diff * diff;
    }
    return Math.sqrt(sumSquares);
  }
}
