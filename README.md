# Knowledge Database

A local knowledge database system for semantic search across markdown files and research materials. Inspired by [ExoPriors Scry](https://exopriors.com/scry), this system combines SQL querying with vector embeddings for powerful hybrid search.

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

```bash
# Add a document
bun run cli.ts --add "Your document content"

# Search
bun run cli.ts --query "search term" --limit 10

# Run example
bun run example.ts
```

## Implementation Status

- ✅ **Phase 1**: Project setup and structure (COMPLETE)
- ⏳ **Phase 2**: Database implementation
- ⏳ **Phase 3**: Vector search
- ⏳ **Phase 4**: Embeddings provider
- ⏳ **Phase 5**: Main API layer
- ⏳ **Phase 6**: CLI interface
- ⏳ **Phase 7**: Data import
- ⏳ **Phase 8**: Testing & validation

See `../Knowledge Database Implementation Plan.md` for details.

## Development

```bash
# Run the example
bun run example.ts

# Run tests (when implemented)
bun test

# Type check
bun run tsc --noEmit
```

## Documentation

- Implementation Guide: `../Local Knowledge Database Implementation Guide.md`
- Implementation Plan: `../Knowledge Database Implementation Plan.md`

## License

Private research project.
