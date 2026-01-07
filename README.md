# Knowledge Database

A local knowledge database system for semantic search across markdown files and research materials. Inspired by [ExoPriors Scry](https://exopriors.com/scry

> **Summary:** Scry is an AI-powered research tool that lets users perform nuanced semantic and lexical searches across a 65M+ document corpus covering alignment research. It combines SQL queries with vector embeddings to enable 'vibes-based' research, giving researchers arbitrary SQL + vector algebra search power.
), this system combines SQL querying with vector embeddings for powerful hybrid search.
> **Summary:** Scry is an AI-powered research tool that lets users perform nuanced semantic and lexical searches across a 65M+ document corpus covering alignment research. It combines SQL queries with vector embeddings to enable 'vibes-based' research, giving researchers arbitrary SQL + vector algebra search power.

## Features

- **Semantic Search**: Find documents by meaning, not just keywords
- **Vector Algebra**: Combine concepts (e.g., "AI agents" + "practical" - "theoretical")
- **Named Vectors**: Save concept embeddings with @handle syntax
- **Hybrid Search**: Combine SQL filtering with semantic similarity
- **Full-Text Search**: Traditional keyword search with SQLite FTS5

## Tech Stack

- **Runtime**: Bun (fast TypeScript execution)
- **Database**: bun:sqlite (embedded SQLite)
- **Vector Search**: hnswlib-node (HNSW algorithm)
- **Embeddings**: OpenAI API (text-embedding-3-small)
- **Language**: TypeScript

## Installation

```bash
bun install
```

## Configuration

1. Copy `.env.example` to `.env`
2. Add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

## Project Structure

```
knowledge-db/
├── src/
│   ├── types/index.ts       # TypeScript type definitions
│   ├── database/
│   │   ├── schema.sql       # Database schema
│   │   └── db.ts            # Database operations
│   ├── vector/
│   │   └── hnswlib.ts       # Vector store implementation
│   ├── embeddings/
│   │   └── openai.ts        # OpenAI embeddings
│   └── index.ts             # Main KnowledgeBase API
├── data/                    # Database and index files
├── tests/                   # Test files
├── cli.ts                   # CLI interface
└── example.ts               # Usage example
```

## Usage

### Basic Example

```typescript
import { KnowledgeBase } from './src/index';

const kb = new KnowledgeBase({
  openaiKey: process.env.OPENAI_API_KEY!
});

await kb.initialize();

// Add documents
await kb.addDocument(
  'Vector databases enable semantic search',
  { category: 'technology' }
);

// Search
const results = await kb.search('how to do semantic search?');

await kb.close();
```

### CLI Usage

The CLI supports both **command-line mode** and **interactive mode**:

**Interactive Mode:**
```bash
# Start interactive REPL
bun run cli.ts

kb> help                          # Show available commands
kb> search machine learning       # Semantic search
kb> add Your document content     # Add document
kb> stats                         # Show statistics
kb> exit                          # Exit
```

**Command-Line Mode:**
```bash
# Show help
bun run cli.ts --help

# Add documents
bun run cli.ts --add "Your document content"
bun run cli.ts --add-batch documents.json

# Search
bun run cli.ts --search "machine learning" --limit 5
bun run cli.ts --fts "Python OR JavaScript"
bun run cli.ts --hybrid "Python|machine learning" --limit 10

# Named vectors
bun run cli.ts --save-vector "ai_ml machine learning concepts"
bun run cli.ts --list-vectors

# Statistics
bun run cli.ts --stats

# Run example
bun run example.ts
```

### Importing Markdown Files

Import markdown files from directories with automatic frontmatter extraction and intelligent chunking:

**Basic Import:**
```bash
# Import all markdown files from a directory
bun run import.ts ./my-notes

# Preview without importing (dry run)
bun run import.ts ./my-notes --dry-run

# Show file statistics only
bun run import.ts ./my-notes --stats-only
```

**Advanced Options:**
```bash
# Custom chunk size (default: 1000 characters)
bun run import.ts ./notes --chunk-size 2000 --chunk-overlap 300

# Disable chunking (import as single documents)
bun run import.ts ./notes --no-chunk

# Exclude specific directories
bun run import.ts ./vault --exclude "templates,drafts,.obsidian"

# Custom file extensions
bun run import.ts ./docs --extensions ".md,.markdown,.txt"
```

**Features:**
- YAML frontmatter extraction
- Intelligent document chunking at paragraph/sentence boundaries
- Recursive directory traversal
- Progress tracking
- Source file tracking
- Metadata enrichment

## Implementation Status

- ✅ **Phase 1**: Project setup and structure (COMPLETE)
- ✅ **Phase 2**: Database implementation (COMPLETE - 22/22 tests passing)
- ✅ **Phase 3**: Vector search (COMPLETE - 34/34 tests passing)
- ✅ **Phase 4**: Embeddings provider (COMPLETE - 31/31 tests passing)
- ✅ **Phase 5**: Main API layer (COMPLETE - 22/22 integration tests passing)
- ✅ **Phase 6**: CLI interface (COMPLETE - Command-line + Interactive modes)
- ✅ **Phase 7**: Data import (COMPLETE - Markdown files with frontmatter & chunking)
- ✅ **Phase 8**: Testing & validation (COMPLETE - E2E tests, benchmarks, docs)

**Total Tests:** 119/119 passing ✅ (87 unit + 22 integration + 10 E2E)

See `../Knowledge Database Implementation Plan.md` for details.

## Development

```bash
# Run tests
bun test

# Run specific test file
bun test tests/database.test.ts

# Run the example (requires Phase 3-5)
bun run example.ts

# Type check
bun run tsc --noEmit
```

## Documentation

- **User Guide**: [`USER-GUIDE.md`](USER-GUIDE.md) - Comprehensive usage guide
- **Production Readiness**: [`PRODUCTION-READINESS.md`](docs/initial-implementation/PRODUCTION-READINESS.md) - Deployment checklist
- **Implementation Guide**: `../Local Knowledge Database Implementation Guide.md`
- **Implementation Plan**: `../Knowledge Database Implementation Plan.md`
- **Phase Completion Docs**: `PHASE-{1-8}-COMPLETE.md` - Detailed phase documentation

### Examples

- **Quick Example**: [`example.ts`](example.ts) - Basic usage demonstration
- **Workflow Example**: [`workflow-example.ts`](workflow-example.ts) - Comprehensive feature demo
- **Benchmark**: [`benchmark.ts`](benchmark.ts) - Performance benchmarks

## License

Private research project.
