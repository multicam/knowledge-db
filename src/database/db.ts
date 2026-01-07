// Database implementation - Phase 2
import Database from 'bun:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import type { Document, NamedVector } from '../types';

export class KnowledgeDB {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string = './data/knowledge.db') {
    this.dbPath = dbPath;

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    try {
      this.db = new Database(dbPath, { create: true });
      this.initialize();
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  private initialize() {
    try {
      // Enable WAL mode for better concurrency
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');
      this.db.exec('PRAGMA foreign_keys = ON');

      // Load and execute schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (!existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const schema = readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    } catch (error) {
      throw new Error(`Failed to initialize database schema: ${error}`);
    }
  }

  // Insert document
  insertDocument(doc: Document): number {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO documents (content, metadata, source)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(
        doc.content,
        JSON.stringify(doc.metadata || {}),
        doc.source || 'unknown'
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      throw new Error(`Failed to insert document: ${error}`);
    }
  }

  // Insert embedding
  insertEmbedding(docId: number, vector: Float32Array): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO embeddings (doc_id, vector, dimension)
        VALUES (?, ?, ?)
      `);

      stmt.run(docId, Buffer.from(vector.buffer), vector.length);
    } catch (error) {
      throw new Error(`Failed to insert embedding for doc ${docId}: ${error}`);
    }
  }

  // Get embedding for a document
  getEmbedding(docId: number): Float32Array | null {
    try {
      const stmt = this.db.prepare(`
        SELECT vector, dimension FROM embeddings WHERE doc_id = ?
      `);

      const row = stmt.get(docId) as any;
      if (!row) return null;

      return new Float32Array(row.vector.buffer);
    } catch (error) {
      throw new Error(`Failed to get embedding for doc ${docId}: ${error}`);
    }
  }

  // Get document by ID
  getDocument(id: number): Document | null {
    try {
      const stmt = this.db.prepare(`
        SELECT id, content, metadata, source, created_at, updated_at
        FROM documents WHERE id = ?
      `);

      const row = stmt.get(id) as any;
      if (!row) return null;

      return {
        id: row.id,
        content: row.content,
        metadata: JSON.parse(row.metadata || '{}'),
        source: row.source,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      };
    } catch (error) {
      throw new Error(`Failed to get document ${id}: ${error}`);
    }
  }

  // Get all documents
  getAllDocuments(limit?: number): Document[] {
    try {
      const query = limit
        ? `SELECT id, content, metadata, source, created_at, updated_at FROM documents ORDER BY created_at DESC LIMIT ?`
        : `SELECT id, content, metadata, source, created_at, updated_at FROM documents ORDER BY created_at DESC`;

      const stmt = this.db.prepare(query);
      const rows = (limit ? stmt.all(limit) : stmt.all()) as any[];

      return rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: JSON.parse(row.metadata || '{}'),
        source: row.source,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      }));
    } catch (error) {
      throw new Error(`Failed to get all documents: ${error}`);
    }
  }

  // Delete document
  deleteDocument(id: number): boolean {
    try {
      const stmt = this.db.prepare(`DELETE FROM documents WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete document ${id}: ${error}`);
    }
  }

  // Count documents
  countDocuments(): number {
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM documents`);
      const row = stmt.get() as any;
      return row.count;
    } catch (error) {
      throw new Error(`Failed to count documents: ${error}`);
    }
  }

  // Full-text search
  fulltextSearch(query: string, limit: number = 10): Document[] {
    try {
      const stmt = this.db.prepare(`
        SELECT d.id, d.content, d.metadata, d.source, d.created_at
        FROM documents_fts fts
        JOIN documents d ON fts.rowid = d.id
        WHERE documents_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);

      const rows = stmt.all(query, limit) as any[];
      return rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: JSON.parse(row.metadata || '{}'),
        source: row.source,
        created_at: new Date(row.created_at)
      }));
    } catch (error) {
      throw new Error(`Failed to perform full-text search: ${error}`);
    }
  }

  // Named vectors
  saveNamedVector(handle: string, vector: Float32Array, description?: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO named_vectors (handle, vector, description)
        VALUES (?, ?, ?)
      `);

      stmt.run(handle, Buffer.from(vector.buffer), description || null);
    } catch (error) {
      throw new Error(`Failed to save named vector '${handle}': ${error}`);
    }
  }

  getNamedVector(handle: string): NamedVector | null {
    try {
      const stmt = this.db.prepare(`
        SELECT handle, vector, description
        FROM named_vectors WHERE handle = ?
      `);

      const row = stmt.get(handle) as any;
      if (!row) return null;

      return {
        handle: row.handle,
        vector: new Float32Array(row.vector.buffer),
        description: row.description
      };
    } catch (error) {
      throw new Error(`Failed to get named vector '${handle}': ${error}`);
    }
  }

  getAllNamedVectors(): NamedVector[] {
    try {
      const stmt = this.db.prepare(`
        SELECT handle, vector, description FROM named_vectors
      `);

      const rows = stmt.all() as any[];
      return rows.map(row => ({
        handle: row.handle,
        vector: new Float32Array(row.vector.buffer),
        description: row.description
      }));
    } catch (error) {
      throw new Error(`Failed to get all named vectors: ${error}`);
    }
  }

  deleteNamedVector(handle: string): boolean {
    try {
      const stmt = this.db.prepare(`DELETE FROM named_vectors WHERE handle = ?`);
      const result = stmt.run(handle);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete named vector '${handle}': ${error}`);
    }
  }

  // Utility methods
  getStats(): { documents: number; embeddings: number; namedVectors: number } {
    try {
      const docs = this.db.prepare(`SELECT COUNT(*) as count FROM documents`).get() as any;
      const embs = this.db.prepare(`SELECT COUNT(*) as count FROM embeddings`).get() as any;
      const vecs = this.db.prepare(`SELECT COUNT(*) as count FROM named_vectors`).get() as any;

      return {
        documents: docs.count,
        embeddings: embs.count,
        namedVectors: vecs.count
      };
    } catch (error) {
      throw new Error(`Failed to get database stats: ${error}`);
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      console.error(`Error closing database: ${error}`);
    }
  }
}
