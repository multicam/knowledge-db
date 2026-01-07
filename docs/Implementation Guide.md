## Overview

This guide outlines the implementation of a local knowledge database system inspired by [ExoPriors Scry](https://exopriors.com/scry), using **Bun** and **TypeScript** for maximum performance and ease of use. The system combines SQL querying with vector embeddings for semantic search.

## Architecture

```
┌─────────────────────────────────────────┐
│        Claude Code Interface            │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────────┐
    │                         │
┌───▼─────────────┐  ┌────────▼──────────┐
│  Better-SQLite3 │  │   FAISS/hnswlib   │
│  (Metadata/SQL) │  │  (Vector Search)  │
└─────────────────┘  └───────────────────┘
         │                    │
         └────────┬───────────┘
                  │
         ┌────────▼─────────┐
         │  TypeScript API  │
         │   (Bun Runtime)  │
         └──────────────────┘
```

## Tech Stack

- **Runtime**: Bun (fast, built-in TypeScript support)
- **SQL Database**: better-sqlite3 (embedded, synchronous, fast)
- **Vector Search**: hnswlib-node or FAISS (high-performance ANN)
- **Embeddings**: OpenAI API or local models (e.g., all-MiniLM-L6-v2)
- **Language**: TypeScript

## Core Components

### 1. Database Schema

```sql
-- Main documents table
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    metadata JSON,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vector storage (parallel to documents)
CREATE TABLE embeddings (
    doc_id INTEGER PRIMARY KEY,
    vector BLOB NOT NULL,
    dimension INTEGER NOT NULL,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Named vectors (like Scry's @handles)
CREATE TABLE named_vectors (
    handle TEXT PRIMARY KEY,
    vector BLOB NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search index
CREATE VIRTUAL TABLE documents_fts USING fts5(
    content, 
    source,
    content=documents,
    content_rowid=id
);

-- Triggers for FTS sync
CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, content, source)
    VALUES (new.id, new.content, new.source);
END;

CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
    DELETE FROM documents_fts WHERE rowid = old.id;
END;

CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
    UPDATE documents_fts 
    SET content = new.content, source = new.source
    WHERE rowid = new.id;
END;
```

### 2. Project Structure

```
knowledge-db/
├── src/
│   ├── index.ts              # Main entry point
│   ├── database/
│   │   ├── schema.sql        # Database schema
│   │   ├── db.ts             # Database initialization
│   │   └── migrations.ts     # Schema migrations
│   ├── embeddings/
│   │   ├── provider.ts       # Embedding interface
│   │   ├── openai.ts         # OpenAI embeddings
│   │   └── local.ts          # Local model embeddings
│   ├── vector/
│   │   ├── index.ts          # Vector store interface
│   │   ├── hnswlib.ts        # HNSW implementation
│   │   └── utils.ts          # Vector operations
│   ├── api/
│   │   ├── search.ts         # Search operations
│   │   ├── insert.ts         # Document insertion
│   │   └── vectors.ts        # Named vector operations
│   └── types/
│       └── index.ts          # TypeScript types
├── tests/
├── data/
│   ├── knowledge.db          # SQLite database
│   └── vectors.index         # Vector index file
├── package.json
├── tsconfig.json
└── README.md
```

### 3. Core TypeScript Types

```typescript
// src/types/index.ts

export interface Document {
  id?: number;
  content: string;
  metadata?: Record<string, any>;
  source?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface DocumentWithEmbedding extends Document {
  embedding: Float32Array;
}

export interface SearchResult {
  document: Document;
  similarity: number;
  distance: number;
}

export interface NamedVector {
  handle: string;
  vector: Float32Array;
  description?: string;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: Record<string, any>;
  includeEmbedding?: boolean;
}

export interface VectorOperation {
  type: 'add' | 'subtract' | 'multiply';
  handle: string;
  weight?: number;
}
```

### 4. Database Implementation

```typescript
// src/database/db.ts

import Database from 'bun:sqlite';
import { readFileSync } from 'fs';
import path from 'path';

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
```

### 5. Vector Search Implementation

```typescript
// src/vector/hnswlib.ts

import { HierarchicalNSW } from 'hnswlib-node';
import { promises as fs } from 'fs';

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
```

### 6. Embeddings Provider

```typescript
// src/embeddings/openai.ts

export class OpenAIEmbeddings {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(text: string): Promise<Float32Array> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    });

    const data = await response.json();
    return new Float32Array(data.data[0].embedding);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        input: texts
      })
    });

    const data = await response.json();
    return data.data.map((item: any) => new Float32Array(item.embedding));
  }
}
```

### 7. Main API

```typescript
// src/index.ts

import { KnowledgeDB } from './database/db';
import { VectorStore } from './vector/hnswlib';
import { OpenAIEmbeddings } from './embeddings/openai';

export class KnowledgeBase {
  private db: KnowledgeDB;
  private vectorStore: VectorStore;
  private embeddings: OpenAIEmbeddings;

  constructor(config: {
    dbPath?: string;
    indexPath?: string;
    openaiKey: string;
    dimension?: number;
  }) {
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
```

## Installation & Setup

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Initialize Project

```bash
mkdir knowledge-db && cd knowledge-db
bun init -y
```

### 3. Install Dependencies

```bash
bun add bun:sqlite hnswlib-node
bun add -d @types/node
```

### 4. Configuration

Create `.env`:

```bash
OPENAI_API_KEY=sk-...
DB_PATH=./data/knowledge.db
INDEX_PATH=./data/vectors.index
EMBEDDING_DIMENSION=1536
```

### 5. Usage Example

```typescript
// example.ts
import { KnowledgeBase } from './src';

const kb = new KnowledgeBase({
  openaiKey: process.env.OPENAI_API_KEY!,
  dbPath: './data/knowledge.db',
  indexPath: './data/vectors.index'
});

await kb.initialize();

// Add documents
await kb.addDocument(
  'Vector databases enable semantic search',
  { category: 'technology' },
  'tutorial'
);

// Search
const results = await kb.search('how to do semantic search?');
console.log(results);

// Named vectors (Scry-style)
await kb.saveNamedVector(
  'ai_safety',
  'AI alignment and safety research',
  'Research on making AI systems safe and beneficial'
);

await kb.saveNamedVector(
  'hype',
  'marketing buzzwords and exaggerated claims',
  'Commercial hype and overselling'
);

// Vector algebra: "AI safety" - "hype"
const combinedVector = await kb.vectorAlgebra([
  { type: 'add', handle: 'ai_safety' },
  { type: 'subtract', handle: 'hype' }
]);

await kb.close();
```

## Claude Code Integration

Claude Code can interact with this system via:

1. **Direct TypeScript execution** (Bun makes this seamless)
2. **REST API** (add Express/Hono server)
3. **CLI commands** (create command-line interface)

### CLI Example

```typescript
// cli.ts
#!/usr/bin/env bun

import { parseArgs } from 'util';
import { KnowledgeBase } from './src';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    query: { type: 'string', short: 'q' },
    add: { type: 'string', short: 'a' },
    limit: { type: 'string', short: 'l', default: '10' }
  }
});

const kb = new KnowledgeBase({
  openaiKey: process.env.OPENAI_API_KEY!
});

await kb.initialize();

if (values.add) {
  const id = await kb.addDocument(values.add);
  console.log(`Added document ${id}`);
} else if (values.query) {
  const results = await kb.search(values.query, {
    limit: parseInt(values.limit!)
  });
  console.log(JSON.stringify(results, null, 2));
}

await kb.close();
```

Usage:

```bash
chmod +x cli.ts
./cli.ts --add "Some document content"
./cli.ts --query "semantic search" --limit 5
```

## Performance Optimizations

1. **Batch embeddings** - Embed multiple documents in one API call
2. **Index tuning** - Adjust HNSW parameters (M, efConstruction)
3. **Lazy loading** - Load vector index only when needed
4. **Caching** - Cache frequently used embeddings
5. **Parallel processing** - Use Bun's native parallelism

## Advanced Features to Implement

- [ ] Multi-modal embeddings (text + images)
- [ ] Incremental indexing
- [ ] Query caching
- [ ] Vector compression
- [ ] Distributed search
- [ ] Real-time updates
- [ ] Access control
- [ ] Backup/restore
- [ ] Monitoring/metrics
- [ ] Web UI

## References

- [ExoPriors Scry](https://exopriors.com/scry)
- [Bun Documentation](https://bun.sh/docs)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [hnswlib](https://github.com/nmslib/hnswlib)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

## Notes for Claude Code

When Claude Code works with this system:

1. **Always close connections** - Call `kb.close()` after operations
2. **Handle errors gracefully** - Wrap in try/catch blocks
3. **Validate inputs** - Check for null/undefined before processing
4. **Use transactions** - For bulk operations
5. **Monitor performance** - Log timing for slow queries
6. **Test incrementally** - Start with small datasets

## Next Steps

1. Clone this structure into your project
2. Run `bun install`
3. Set up `.env` with your OpenAI key
4. Start with the example.ts file
5. Integrate with Claude Code workflows