// Database implementation - to be implemented in Phase 2
import Database from 'bun:sqlite';
import { readFileSync } from 'fs';
import path from 'path';
import type { Document, NamedVector } from '../types';

export class KnowledgeDB {
  private db: Database;

  constructor(dbPath: string = './data/knowledge.db') {
    this.db = new Database(dbPath, { create: true });
    this.initialize();
  }

  private initialize() {
    // Enable WAL mode for better concurrency
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA foreign_keys = ON');

    // Load and execute schema
    const schema = readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf-8'
    );
    this.db.exec(schema);
  }

  // Insert document
  insertDocument(doc: Document): number {
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
  }

  // Insert embedding
  insertEmbedding(docId: number, vector: Float32Array) {
    const stmt = this.db.prepare(`
      INSERT INTO embeddings (doc_id, vector, dimension)
      VALUES (?, ?, ?)
    `);

    stmt.run(docId, Buffer.from(vector.buffer), vector.length);
  }

  // Get document by ID
  getDocument(id: number): Document | null {
    const stmt = this.db.prepare(`
      SELECT id, content, metadata, source, created_at, updated_at
      FROM documents WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      source: row.source,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  // Full-text search
  fulltextSearch(query: string, limit: number = 10): Document[] {
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
      metadata: JSON.parse(row.metadata),
      source: row.source,
      created_at: new Date(row.created_at)
    }));
  }

  // Named vectors
  saveNamedVector(handle: string, vector: Float32Array, description?: string) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO named_vectors (handle, vector, description)
      VALUES (?, ?, ?)
    `);

    stmt.run(handle, Buffer.from(vector.buffer), description || null);
  }

  getNamedVector(handle: string): NamedVector | null {
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
  }

  close() {
    this.db.close();
  }
}
