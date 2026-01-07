# Knowledge Database Implementation Plan

## Executive Summary

This plan outlines the implementation of a local knowledge database system for your research vault, inspired by ExoPriors Scry. The system will enable semantic search across your markdown files, support vector algebra operations, and provide both CLI and programmatic interfaces.

## System Overview

**Tech Stack:**
- Runtime: Bun (TypeScript with built-in SQLite)
- SQL Database: better-sqlite3 (structured data + full-text search)
- Vector Search: hnswlib-node (approximate nearest neighbor)
- Embeddings: OpenAI API (text-embedding-3-small)
- Language: TypeScript

**Key Capabilities:**
- Semantic search across all research documents
- SQL-based filtering and full-text search
- Named vectors for concept exploration (Scry-style @handles)
- Vector algebra (add/subtract concepts)
- Hybrid search combining SQL + semantic similarity

## Implementation Phases

### Phase 1: Project Setup (30-45 minutes)

**Objectives:**
- Install Bun runtime
- Create project structure
- Install dependencies
- Set up environment configuration

**Steps:**

1. **Install Bun**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   # Add to PATH if needed
   ```

2. **Create project directory**
   ```bash
   cd "/Users/jmbook/TGDS Dropbox/RESEARCH/[WIP]"
   mkdir knowledge-db
   cd knowledge-db
   bun init -y
   ```

3. **Install dependencies**
   ```bash
   bun add hnswlib-node
   bun add -d @types/node
   ```

4. **Create directory structure**
   ```
   knowledge-db/
   ├── src/
   │   ├── index.ts
   │   ├── database/
   │   │   ├── schema.sql
   │   │   ├── db.ts
   │   │   └── migrations.ts
   │   ├── embeddings/
   │   │   ├── provider.ts
   │   │   ├── openai.ts
   │   │   └── local.ts
   │   ├── vector/
   │   │   ├── index.ts
   │   │   ├── hnswlib.ts
   │   │   └── utils.ts
   │   ├── api/
   │   │   ├── search.ts
   │   │   ├── insert.ts
   │   │   └── vectors.ts
   │   └── types/
   │       └── index.ts
   ├── tests/
   ├── data/
   ├── cli.ts
   ├── example.ts
   ├── package.json
   ├── tsconfig.json
   ├── .env
   └── README.md
   ```

5. **Configure environment**
   ```bash
   # Create .env file
   cat > .env << EOF
   OPENAI_API_KEY=your-key-here
   DB_PATH=./data/knowledge.db
   INDEX_PATH=./data/vectors.index
   EMBEDDING_DIMENSION=1536
   EOF
   ```

### Phase 2: Core Database Implementation (1-2 hours)

**Objectives:**
- Create SQL schema with full-text search
- Implement database wrapper class
- Add document and embedding storage
- Support named vectors

**Implementation Files:**

1. **src/database/schema.sql** - Create tables, triggers, FTS5 index
2. **src/types/index.ts** - TypeScript interfaces
3. **src/database/db.ts** - KnowledgeDB class with CRUD operations

**Key Features:**
- Documents table with JSON metadata
- Embeddings table with BLOB storage
- Named vectors table for concept handles
- FTS5 virtual table for full-text search
- Automatic triggers to keep FTS in sync

### Phase 3: Vector Search Implementation (1-2 hours)

**Objectives:**
- Set up HNSW index for fast similarity search
- Implement vector algebra operations
- Add cosine similarity calculations
- Support persistent index storage

**Implementation Files:**

1. **src/vector/hnswlib.ts** - VectorStore class
2. **src/vector/utils.ts** - Vector math utilities

**Key Operations:**
- Add vectors to index
- K-nearest neighbor search
- Vector addition/subtraction with weights
- Normalization and similarity metrics
- Save/load index to disk

### Phase 4: Embeddings Provider (30-60 minutes)

**Objectives:**
- Integrate OpenAI embeddings API
- Support batch embedding requests
- Handle rate limiting and errors
- (Optional) Add local embedding model support

**Implementation Files:**

1. **src/embeddings/openai.ts** - OpenAI API integration
2. **src/embeddings/provider.ts** - Abstract interface
3. **src/embeddings/local.ts** - (Optional) Local model

**Best Practices:**
- Batch embed up to 2048 documents per request
- Handle API errors with retries
- Cache embeddings to avoid re-computation
- Log token usage for cost tracking

### Phase 5: Main API Layer (1-2 hours)

**Objectives:**
- Combine all components into unified API
- Implement search operations
- Add document management
- Support hybrid search (SQL + vector)

**Implementation Files:**

1. **src/index.ts** - KnowledgeBase class
2. **src/api/search.ts** - Search operations
3. **src/api/insert.ts** - Document insertion
4. **src/api/vectors.ts** - Named vector operations

**Core Methods:**
- `addDocument()` - Insert with auto-embedding
- `search()` - Semantic search
- `fulltextSearch()` - SQL-based search
- `hybridSearch()` - Combined search
- `saveNamedVector()` - Create concept handles
- `vectorAlgebra()` - Combine vectors

### Phase 6: CLI Interface (1 hour)

**Objectives:**
- Create command-line tool for easy access
- Support common operations (add, search, query)
- Enable batch imports
- Provide JSON output for scripting

**Implementation:**

**cli.ts** - Command-line interface with these commands:

```bash
# Add documents
./cli.ts add --content "Document text" --source "file.md"
./cli.ts import --directory "../Recup" --pattern "*.md"

# Search
./cli.ts search --query "AI agents" --limit 10
./cli.ts fulltext --query "vector embeddings"
./cli.ts hybrid --sql "AI" --semantic "machine learning"

# Named vectors
./cli.ts vector-save --handle "ai_safety" --text "AI alignment research"
./cli.ts vector-search --handle "ai_safety" --limit 5
./cli.ts vector-algebra --add "ai_safety" --subtract "hype"

# Utilities
./cli.ts stats
./cli.ts rebuild-index
```

### Phase 7: Populate Database (Variable time)

**Objectives:**
- Import existing markdown files from vault
- Extract metadata from frontmatter
- Preserve source paths and categories
- Handle images and non-text content

**Strategy:**

1. **Start with high-value content**
   - Recup/ directory (curated articles)
   - Cookbook/ (examples and guides)
   - Projects/8090/ (structured documentation)

2. **Batch processing script**
   ```typescript
   // import-vault.ts
   import { KnowledgeBase } from './src';
   import { readdir, readFile } from 'fs/promises';
   import path from 'path';

   const kb = new KnowledgeBase({
     openaiKey: process.env.OPENAI_API_KEY!
   });

   await kb.initialize();

   async function importDirectory(dirPath: string) {
     const files = await readdir(dirPath, {
       recursive: true,
       withFileTypes: true
     });

     for (const file of files) {
       if (!file.name.endsWith('.md')) continue;

       const fullPath = path.join(file.path, file.name);
       const content = await readFile(fullPath, 'utf-8');

       // Extract metadata from frontmatter if present
       const metadata = extractFrontmatter(content);

       await kb.addDocument(content, {
         ...metadata,
         path: fullPath,
         filename: file.name
       }, dirPath);

       console.log(`Imported: ${file.name}`);
     }
   }

   // Import directories
   await importDirectory('../Recup');
   await importDirectory('../Cookbook');
   await importDirectory('../Projects/8090/8090-learn-docs');

   await kb.close();
   ```

3. **Estimated costs (OpenAI embeddings)**
   - ~1000 markdown files
   - Average 2000 tokens per file
   - text-embedding-3-small: $0.02 / 1M tokens
   - Total: ~$0.04 (very cheap!)

### Phase 8: Testing & Validation (1-2 hours)

**Objectives:**
- Verify search quality
- Test vector operations
- Validate data integrity
- Performance benchmarking

**Test Scripts:**

1. **tests/basic.test.ts** - CRUD operations
2. **tests/search.test.ts** - Search quality
3. **tests/vectors.test.ts** - Vector algebra
4. **tests/performance.test.ts** - Speed benchmarks

**Validation Queries:**

```typescript
// Test semantic search
const results = await kb.search("how to build AI agents");
// Should find articles about agent development

// Test vector algebra
await kb.saveNamedVector("ai_engineering", "building AI systems");
await kb.saveNamedVector("academic_theory", "theoretical research");

const practical = await kb.vectorAlgebra([
  { type: 'add', handle: 'ai_engineering' },
  { type: 'subtract', handle: 'academic_theory' }
]);
// Should find practical, hands-on content

// Test hybrid search
const hybrid = await kb.hybridSearch(
  "Claude Code",  // SQL
  "AI coding assistants"  // Semantic
);
// Should find Tools/ directory content
```

## Integration with Current Vault

### Use Cases

**1. Research Discovery**
```bash
# Find articles about specific topics
./cli.ts search --query "prompt engineering best practices"

# Find practical examples
./cli.ts vector-algebra --add "examples" --subtract "theory"
```

**2. Content Curation**
```bash
# Find articles similar to a reference
./cli.ts search --query "$(cat Recup/Building\ effective\ agents.md)"

# Discover related content
./cli.ts hybrid --sql "LLM" --semantic "language models"
```

**3. Prompt Library Management**
```bash
# Search prompt templates
./cli.ts search --query "essay writing style" --filter "source:__prompts"

# Find prompts by purpose
./cli.ts fulltext --query "rewrite OR curriculum"
```

**4. Project Documentation**
```bash
# Search 8090 docs
./cli.ts search --query "foundry module" --filter "source:Projects/8090"

# Find setup instructions
./cli.ts fulltext --query "installation AND setup"
```

### Claude Code Integration

**Method 1: Direct CLI Usage**
```typescript
// Claude can execute CLI commands
const results = await Bun.$`./cli.ts search --query "AI agents" --limit 5`.json();
```

**Method 2: Library Import**
```typescript
// Claude can write scripts that import the library
import { KnowledgeBase } from './knowledge-db/src';

const kb = new KnowledgeBase({
  openaiKey: process.env.OPENAI_API_KEY!
});

await kb.initialize();
const results = await kb.search("vector databases");
await kb.close();
```

**Method 3: REST API** (Future enhancement)
```typescript
// Add web server for remote access
import { Hono } from 'hono';

const app = new Hono();

app.post('/search', async (c) => {
  const { query } = await c.req.json();
  const results = await kb.search(query);
  return c.json(results);
});

export default app;
```

## Advanced Features Roadmap

**Phase 9: Enhanced Capabilities** (Future)

1. **Multi-modal embeddings**
   - Image embedding support
   - Diagram/chart analysis
   - PDF processing

2. **Query optimization**
   - Embedding cache
   - Query result cache
   - Index compression

3. **Advanced search**
   - Temporal filtering (date ranges)
   - Source-based weighting
   - Multi-step reasoning chains

4. **Web interface**
   - Search UI
   - Document browser
   - Vector visualization

5. **Backup & sync**
   - Export/import database
   - Version control for embeddings
   - Incremental updates

## Success Metrics

**Performance Targets:**
- Search latency: < 100ms for top-10 results
- Import speed: > 100 docs/minute
- Index size: < 2x document size
- Query accuracy: > 80% relevant in top-5

**Functional Goals:**
- Successfully index 1000+ markdown files
- Support named vector library (50+ concept handles)
- Enable hybrid search across entire vault
- CLI commands for all core operations

## Cost Estimates

**One-time setup:**
- Initial embedding: ~$0.04 (1000 docs × 2000 tokens)
- Index storage: ~100MB disk space

**Ongoing costs:**
- New document embeddings: $0.00002 per doc
- Re-indexing (if needed): $0.04

**Total monthly cost:** < $1 for typical usage

## Next Steps

1. **Review this plan** - Validate approach and priorities
2. **Set up Bun runtime** - Install and configure
3. **Create project structure** - Follow Phase 1
4. **Implement core components** - Phases 2-5
5. **Build CLI interface** - Phase 6
6. **Test with sample data** - Small subset first
7. **Import full vault** - Phase 7
8. **Integrate with workflows** - Daily usage patterns

## Questions to Clarify

1. **OpenAI API access** - Do you have an API key ready?
2. **Priority directories** - Which vault sections are most important?
3. **Search frequency** - How often will you query the database?
4. **Named vectors** - What concepts should we pre-define?
5. **Integration preference** - CLI, library, or API?

## Resources

- Implementation guide: `Local Knowledge Database Implementation Guide.md`
- Bun docs: https://bun.sh/docs
> **Summary:** Bun is an all-in-one toolkit for developing modern JavaScript/TypeScript applications, designed as a fast drop-in replacement for Node.js. It includes four core components: Runtime, Package Manager, Test Runner, and Bundler, with key design goals including speed, TypeScript support, and Node.js compatibility.
- hnswlib: https://github.com/nmslib/hnswlib
- OpenAI embeddings: https://platform.openai.com/docs/guides/embeddings
- ExoPriors Scry: https://exopriors.com/scry

---

**Ready to implement?** Start with Phase 1 and work through systematically. Each phase builds on the previous one, creating a robust knowledge system for your research vault.
