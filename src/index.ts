// Main KnowledgeBase API - Phase 5
import { KnowledgeDB } from './database/db';
import { VectorStore } from './vector/hnswlib';
import { OpenAIEmbeddings } from './embeddings/openai';
import type {
  Document,
  SearchResult,
  SearchOptions,
  VectorOperation,
  KnowledgeBaseConfig
} from './types';

export class KnowledgeBase {
  private db: KnowledgeDB;
  private vectorStore: VectorStore;
  private embeddings: OpenAIEmbeddings;
  private initialized: boolean = false;

  constructor(config: KnowledgeBaseConfig) {
    try {
      this.db = new KnowledgeDB(config.dbPath);
      this.embeddings = new OpenAIEmbeddings(config.openaiKey);
      this.vectorStore = new VectorStore(
        config.dimension || this.embeddings.getEmbeddingDimension(),
        config.indexPath
      );
    } catch (error) {
      throw new Error(`Failed to initialize KnowledgeBase: ${error}`);
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.vectorStore.initialize();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize vector store: ${error}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('KnowledgeBase not initialized. Call initialize() first.');
    }
  }

  // Add document with automatic embedding
  async addDocument(content: string, metadata?: Record<string, any>, source?: string): Promise<number> {
    this.ensureInitialized();

    try {
      // Get embedding
      const embedding = await this.embeddings.embed(content);

      // Insert document
      const docId = this.db.insertDocument({ content, metadata, source });

      // Store embedding
      this.db.insertEmbedding(docId, embedding);
      this.vectorStore.addVector(docId, embedding);

      // Save vector index
      await this.vectorStore.save();

      return docId;
    } catch (error) {
      throw new Error(`Failed to add document: ${error}`);
    }
  }

  // Add multiple documents in batch
  async addDocuments(
    documents: Array<{ content: string; metadata?: Record<string, any>; source?: string }>
  ): Promise<number[]> {
    this.ensureInitialized();

    try {
      const ids: number[] = [];

      // Extract content for batch embedding
      const contents = documents.map(d => d.content);

      // Get embeddings in batch
      const embeddings = await this.embeddings.embedBatch(contents);

      // Insert documents and embeddings
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]!;
        const embedding = embeddings[i]!;

        const docId = this.db.insertDocument({
          content: doc.content,
          metadata: doc.metadata,
          source: doc.source
        });

        this.db.insertEmbedding(docId, embedding);
        this.vectorStore.addVector(docId, embedding);

        ids.push(docId);
      }

      // Save vector index once at the end
      await this.vectorStore.save();

      return ids;
    } catch (error) {
      throw new Error(`Failed to add documents: ${error}`);
    }
  }

  // Get document by ID
  getDocument(id: number): Document | null {
    try {
      return this.db.getDocument(id);
    } catch (error) {
      throw new Error(`Failed to get document: ${error}`);
    }
  }

  // Get all documents
  getAllDocuments(limit?: number): Document[] {
    try {
      return this.db.getAllDocuments(limit);
    } catch (error) {
      throw new Error(`Failed to get all documents: ${error}`);
    }
  }

  // Delete document
  async deleteDocument(id: number): Promise<boolean> {
    try {
      const deleted = this.db.deleteDocument(id);
      if (deleted) {
        // Note: Vector remains in index but becomes stale
        // In production, consider rebuilding index periodically
        await this.vectorStore.save();
      }
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete document: ${error}`);
    }
  }

  // Semantic search
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const { limit = 10, threshold = 0.0 } = options;

      const queryEmbedding = await this.embeddings.embed(query);
      const vectorResults = this.vectorStore.search(queryEmbedding, limit * 2);

      const results: SearchResult[] = [];
      for (const { id, distance } of vectorResults) {
        const doc = this.db.getDocument(id);
        if (!doc) continue;

        const similarity = 1 - distance;
        if (similarity < threshold) continue;

        results.push({
          document: doc,
          similarity,
          distance
        });

        if (results.length >= limit) break;
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to search: ${error}`);
    }
  }

  // Search by vector directly
  async searchByVector(vector: Float32Array, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const { limit = 10, threshold = 0.0 } = options;
      const vectorResults = this.vectorStore.search(vector, limit * 2);

      const results: SearchResult[] = [];
      for (const { id, distance } of vectorResults) {
        const doc = this.db.getDocument(id);
        if (!doc) continue;

        const similarity = 1 - distance;
        if (similarity < threshold) continue;

        results.push({
          document: doc,
          similarity,
          distance
        });

        if (results.length >= limit) break;
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to search by vector: ${error}`);
    }
  }

  // Full-text search
  fulltextSearch(query: string, limit: number = 10): Document[] {
    try {
      return this.db.fulltextSearch(query, limit);
    } catch (error) {
      throw new Error(`Failed to perform full-text search: ${error}`);
    }
  }

  // Named vector operations (Scry-style)
  async saveNamedVector(handle: string, text: string, description?: string): Promise<void> {
    try {
      const vector = await this.embeddings.embed(text);
      this.db.saveNamedVector(handle, vector, description);
    } catch (error) {
      throw new Error(`Failed to save named vector: ${error}`);
    }
  }

  getNamedVector(handle: string) {
    try {
      return this.db.getNamedVector(handle);
    } catch (error) {
      throw new Error(`Failed to get named vector: ${error}`);
    }
  }

  getAllNamedVectors() {
    try {
      return this.db.getAllNamedVectors();
    } catch (error) {
      throw new Error(`Failed to get all named vectors: ${error}`);
    }
  }

  deleteNamedVector(handle: string): boolean {
    try {
      return this.db.deleteNamedVector(handle);
    } catch (error) {
      throw new Error(`Failed to delete named vector: ${error}`);
    }
  }

  async vectorAlgebra(operations: VectorOperation[]): Promise<Float32Array> {
    try {
      let result: Float32Array | null = null;

      for (const op of operations) {
        const namedVec = this.db.getNamedVector(op.handle);
        if (!namedVec) throw new Error(`Vector handle not found: ${op.handle}`);

        if (!result) {
          result = namedVec.vector;
          continue;
        }

        switch (op.type) {
          case 'add':
            result = VectorStore.add(result, namedVec.vector, op.weight || 1.0);
            break;
          case 'subtract':
            result = VectorStore.subtract(result, namedVec.vector, op.weight || 1.0);
            break;
        }
      }

      return result!;
    } catch (error) {
      throw new Error(`Failed to perform vector algebra: ${error}`);
    }
  }

  // Search using vector algebra
  async searchWithVectorAlgebra(operations: VectorOperation[], options: SearchOptions = {}): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const combinedVector = await this.vectorAlgebra(operations);
      return await this.searchByVector(combinedVector, options);
    } catch (error) {
      throw new Error(`Failed to search with vector algebra: ${error}`);
    }
  }

  // Hybrid search (SQL + Vector)
  async hybridSearch(sqlQuery: string, semanticQuery: string, limit: number = 10) {
    this.ensureInitialized();

    try {
      // Get SQL results
      const sqlResults = this.db.fulltextSearch(sqlQuery, limit * 2);

      // Get semantic results
      const semanticResults = await this.search(semanticQuery, { limit: limit * 2 });

      // Merge and deduplicate
      const merged = new Map<number, { doc: Document; score: number }>();

      sqlResults.forEach(doc => {
        if (doc.id) merged.set(doc.id, { doc, score: 0.5 });
      });

      semanticResults.forEach(({ document, similarity }) => {
        if (!document.id) return;
        const existing = merged.get(document.id);
        if (existing) {
          existing.score += similarity * 0.5;
        } else {
          merged.set(document.id, { doc: document, score: similarity * 0.5 });
        }
      });

      return Array.from(merged.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ doc, score }) => ({ document: doc, score }));
    } catch (error) {
      throw new Error(`Failed to perform hybrid search: ${error}`);
    }
  }

  // Utility methods
  getStats() {
    try {
      const dbStats = this.db.getStats();
      return {
        ...dbStats,
        vectorCount: this.vectorStore.getCount(),
        dimension: this.vectorStore.getDimension(),
        tokensUsed: this.embeddings.getTotalTokens()
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    try {
      if (this.initialized) {
        await this.vectorStore.save();
      }
      this.db.close();
    } catch (error) {
      console.error(`Error closing KnowledgeBase: ${error}`);
    }
  }
}

// Re-export types
export * from './types';
