// Main KnowledgeBase API - to be implemented in Phase 5
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

  constructor(config: KnowledgeBaseConfig) {
    this.db = new KnowledgeDB(config.dbPath);
    this.vectorStore = new VectorStore(config.dimension, config.indexPath);
    this.embeddings = new OpenAIEmbeddings(config.openaiKey);
  }

  async initialize() {
    await this.vectorStore.initialize();
  }

  // Add document with automatic embedding
  async addDocument(content: string, metadata?: Record<string, any>, source?: string) {
    const embedding = await this.embeddings.embed(content);
    const docId = this.db.insertDocument({ content, metadata, source });
    this.db.insertEmbedding(docId, embedding);
    this.vectorStore.addVector(docId, embedding);
    await this.vectorStore.save();
    return docId;
  }

  // Semantic search
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { limit = 10, threshold = 0.0 } = options;

    const queryEmbedding = await this.embeddings.embed(query);
    const vectorResults = this.vectorStore.search(queryEmbedding, limit);

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
    }

    return results;
  }

  // Named vector operations (Scry-style)
  async saveNamedVector(handle: string, text: string, description?: string) {
    const vector = await this.embeddings.embed(text);
    this.db.saveNamedVector(handle, vector, description);
  }

  async vectorAlgebra(operations: VectorOperation[]): Promise<Float32Array> {
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
  }

  // Hybrid search (SQL + Vector)
  async hybridSearch(sqlQuery: string, semanticQuery: string, limit: number = 10) {
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
  }

  async close() {
    await this.vectorStore.save();
    this.db.close();
  }
}

// Re-export types
export * from './types';
