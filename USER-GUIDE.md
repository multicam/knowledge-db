# Knowledge Database User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Core Concepts](#core-concepts)
5. [Using the CLI](#using-the-cli)
6. [Importing Documents](#importing-documents)
7. [Searching](#searching)
8. [Named Vectors](#named-vectors)
9. [Programmatic Usage](#programmatic-usage)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

## Introduction

The Knowledge Database is a local semantic search system that allows you to store, search, and retrieve documents based on meaning rather than just keywords. It combines traditional full-text search with modern vector embeddings to enable powerful "vibes-based" research.

### Key Features

- **Semantic Search**: Find documents by meaning, not just keywords
- **Hybrid Search**: Combine SQL queries with semantic similarity
- **Named Vectors**: Save and reuse concept embeddings
- **Vector Algebra**: Combine concepts mathematically
- **Markdown Import**: Automatic extraction of frontmatter and intelligent chunking
- **CLI Interface**: Both command-line and interactive modes

### System Requirements

- Bun v1.0+ (JavaScript runtime)
- OpenAI API key
- ~100MB disk space (plus space for your documents)

## Installation

### 1. Clone or Download

```bash
cd knowledge-db
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure API Key

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-actual-key-here
```

### 4. Verify Installation

```bash
bun run cli.ts --help
```

## Quick Start

### Initialize and Add Documents

```bash
# Start interactive mode
bun run cli.ts

kb> add Vector databases enable semantic search using embeddings
kb> add Machine learning models learn patterns from data
kb> add Python is a popular programming language

# Search semantically
kb> search artificial intelligence

# View statistics
kb> stats

# Exit
kb> exit
```

### Import Markdown Files

```bash
# Import all markdown files from a directory
bun run import.ts ./my-notes

# Preview what will be imported
bun run import.ts ./my-notes --dry-run
```

## Core Concepts

### Documents

A document is the basic unit of storage. Each document has:
- **Content**: The text to be searchable
- **Metadata**: Optional JSON data (tags, categories, etc.)
- **Source**: Where the document came from
- **Embedding**: A 1536-dimensional vector representation

### Embeddings

Embeddings are numerical representations of text that capture semantic meaning. Similar text has similar embeddings, enabling semantic search.

### Chunking

Long documents are split into smaller chunks for better search precision. Chunks overlap to maintain context.

**Default Settings:**
- Chunk size: 1000 characters
- Overlap: 200 characters
- Boundary detection: Paragraphs > Sentences > Words

### Named Vectors

Named vectors are saved embeddings that represent concepts. You can save, retrieve, and combine them using vector algebra.

## Using the CLI

### Interactive Mode

Start the REPL:

```bash
bun run cli.ts
```

**Available Commands:**

```
search <query>              # Semantic search
fts <query>                 # Full-text search
hybrid <sql> | <semantic>   # Hybrid search
add <text>                  # Add document
get <id>                    # Get document by ID
list [limit]                # List documents
delete <id>                 # Delete document
save-vec <handle> <text>    # Save named vector
get-vec <handle>            # Get named vector
list-vecs                   # List named vectors
delete-vec <handle>         # Delete named vector
stats                       # Show statistics
help                        # Show help
exit                        # Exit
```

**Examples:**

```bash
kb> search machine learning tutorials
kb> fts Python OR JavaScript
kb> hybrid Python | machine learning
kb> add This is my new document
kb> save-vec ai_concepts artificial intelligence and machine learning
kb> stats
```

### Command-Line Mode

Execute single commands:

```bash
# Add a document
bun run cli.ts --add "Your document content"

# Semantic search
bun run cli.ts --search "machine learning" --limit 5

# Full-text search
bun run cli.ts --fts "Python OR JavaScript"

# Hybrid search (use | as separator)
bun run cli.ts --hybrid "Python|machine learning"

# Get statistics
bun run cli.ts --stats
```

## Importing Documents

### Basic Import

Import all markdown files from a directory:

```bash
bun run import.ts ./my-notes
```

### Import Options

```bash
# Custom chunk size
bun run import.ts ./notes --chunk-size 2000 --chunk-overlap 300

# Disable chunking
bun run import.ts ./notes --no-chunk

# Exclude directories
bun run import.ts ./vault --exclude "templates,drafts,.obsidian"

# Custom file extensions
bun run import.ts ./docs --extensions ".md,.txt"

# Preview without importing
bun run import.ts ./notes --dry-run

# Show file count only
bun run import.ts ./notes --stats-only
```

### Frontmatter Support

The importer extracts YAML frontmatter as metadata:

```markdown
---
title: My Document
category: research
tags: [ai, ml]
date: 2024-01-15
---

# Content starts here
```

This metadata becomes searchable and filterable.

### Chunking Strategy

**When to Use Chunking:**
- Long documents (>1000 characters)
- Want precise search results
- Documents cover multiple topics

**When to Disable Chunking:**
- Short documents
- Need complete context
- Single-topic documents

**Custom Chunk Sizes:**
- Small (500-800): More precise, more API calls
- Medium (1000-1500): Balanced (default)
- Large (2000+): More context, fewer API calls

## Searching

### Semantic Search

Finds documents by meaning:

```bash
# CLI
bun run cli.ts --search "how do neural networks work" --limit 10

# Interactive
kb> search how do neural networks work
```

**Options:**
- `--limit <n>`: Maximum results (default: 10)
- `--threshold <n>`: Minimum similarity 0-1 (default: 0)

### Full-Text Search

Traditional keyword search using SQLite FTS5:

```bash
# CLI
bun run cli.ts --fts "Python AND (machine OR deep) learning"

# Interactive
kb> fts Python AND machine learning
```

**FTS5 Operators:**
- `AND`: Both terms must appear
- `OR`: Either term
- `NOT`: Exclude term
- `*`: Wildcard
- `"phrase"`: Exact phrase

### Hybrid Search

Combines SQL filtering with semantic search:

```bash
# CLI (use | as separator)
bun run cli.ts --hybrid "Python|machine learning tutorials"

# Interactive (use | as separator)
kb> hybrid Python | machine learning tutorials
```

Documents matching both queries score highest.

### Search Results

Results include:
- **Similarity/Score**: Relevance percentage
- **Document ID**: For retrieval
- **Metadata**: Tags, categories, etc.
- **Source**: Original file path
- **Content Preview**: First 200 characters

## Named Vectors

Named vectors let you save and reuse concept embeddings.

### Saving Named Vectors

```bash
# CLI
bun run cli.ts --save-vector "ai_practical hands-on machine learning tutorials"

# Interactive
kb> save-vec ai_practical hands-on machine learning tutorials
```

### Using Named Vectors

```bash
# List all named vectors
bun run cli.ts --list-vectors
kb> list-vecs

# Get specific vector
bun run cli.ts --get-vector ai_practical
kb> get-vec ai_practical

# Delete vector
bun run cli.ts --delete-vector ai_practical
kb> delete-vec ai_practical
```

### Vector Algebra

Combine concepts mathematically:

```bash
# Search for practical AI (subtract theory)
bun run cli.ts --algebra "ai_practical,+,1.0;ai_theory,-,0.5" --limit 5
```

**Format:** `handle,operation,weight`
- **Operations**: `+` (add), `-` (subtract)
- **Weight**: Strength (default: 1.0)
- **Separator**: `;` between operations

**Example Use Cases:**
- "King - Man + Woman = Queen"
- "Practical tutorials - Theoretical papers"
- "Python + Machine Learning - Statistics"

## Programmatic Usage

### Basic Example

```typescript
import { KnowledgeBase } from './src/index';

const kb = new KnowledgeBase({
  openaiKey: process.env.OPENAI_API_KEY!,
  dbPath: './data/knowledge.db',
  indexPath: './data/vectors.index'
});

await kb.initialize();

// Add documents
const id = await kb.addDocument(
  'Vector databases enable semantic search',
  { category: 'technology' }
);

// Search
const results = await kb.search('semantic search', { limit: 5 });

results.forEach(r => {
  console.log(`[${(r.similarity * 100).toFixed(1)}%] ${r.document.content}`);
});

await kb.close();
```

### API Reference

**Document Management:**
```typescript
addDocument(content, metadata?, source?): Promise<number>
addDocuments(documents): Promise<number[]>
getDocument(id): Document | null
getAllDocuments(limit?): Document[]
deleteDocument(id): Promise<boolean>
```

**Search:**
```typescript
search(query, options?): Promise<SearchResult[]>
searchByVector(vector, options?): Promise<SearchResult[]>
fulltextSearch(query, limit?): Document[]
hybridSearch(sqlQuery, semanticQuery, limit?): Promise<Result[]>
```

**Named Vectors:**
```typescript
saveNamedVector(handle, text, description?): Promise<void>
getNamedVector(handle): NamedVector | null
getAllNamedVectors(): NamedVector[]
deleteNamedVector(handle): boolean
vectorAlgebra(operations): Promise<Float32Array>
searchWithVectorAlgebra(operations, options?): Promise<SearchResult[]>
```

**Utilities:**
```typescript
getStats(): Stats
isInitialized(): boolean
close(): Promise<void>
```

## Best Practices

### Document Organization

**Use Frontmatter:**
```markdown
---
title: Clear Document Title
category: main-category
tags: [specific, tags]
date: 2024-01-15
author: Your Name
---
```

**Directory Structure:**
```
my-notes/
├── topics/
│   ├── ai/
│   ├── programming/
│   └── research/
├── .obsidian/      # Exclude
└── templates/       # Exclude
```

### Chunk Size Selection

- **Precise search (500-800 chars)**: Code snippets, Q&A, definitions
- **Balanced (1000-1500 chars)**: General articles, blog posts
- **Context-heavy (2000+ chars)**: Academic papers, long-form content

### Search Strategies

**When to Use Each Search Type:**

1. **Semantic Search**
   - Finding similar concepts
   - When you don't know exact keywords
   - Cross-domain discovery

2. **Full-Text Search**
   - Exact terms or phrases
   - Technical terminology
   - Fast keyword lookup

3. **Hybrid Search**
   - Best of both worlds
   - Filter by keyword + semantic ranking
   - Most versatile option

### Named Vector Workflow

1. **Create Concept Vectors:**
   ```bash
   kb> save-vec programming software development and coding
   kb> save-vec theory theoretical concepts and research
   kb> save-vec practical hands-on tutorials and examples
   ```

2. **Search with Algebra:**
   ```bash
   # Find practical programming content
   --algebra "programming,+,1.0;practical,+,0.5;theory,-,0.3"
   ```

3. **Manage Vectors:**
   ```bash
   kb> list-vecs           # See what you have
   kb> delete-vec old_one  # Clean up unused
   ```

### Cost Management

**Minimize API Costs:**
- Use batch imports instead of single documents
- Disable chunking for short documents
- Cache frequently used named vectors
- Use full-text search when possible

**Estimate Costs:**
```typescript
const tokens = OpenAIEmbeddings.estimateTokens(text);
const cost = OpenAIEmbeddings.estimateCost(tokens);
console.log(`Estimated: $${cost.toFixed(6)}`);
```

**Current Pricing (text-embedding-3-small):**
- $0.02 per 1M tokens
- ~1000 chars ≈ 250 tokens
- $0.000005 per document (average)

## Troubleshooting

### Common Issues

**1. "OPENAI_API_KEY not set"**

```bash
# Check .env file
cat .env

# Verify it's loaded
echo $OPENAI_API_KEY

# Reload if needed
source .env
```

**2. "KnowledgeBase not initialized"**

```typescript
// Always call initialize() before use
await kb.initialize();
```

**3. "No results found"**

- Try lowering the similarity threshold
- Use full-text search to verify content exists
- Check if documents were actually added (stats)
- Try broader search terms

**4. Import finds no files**

```bash
# Check directory exists
ls -la ./my-notes

# Verify file extensions
bun run import.ts ./notes --stats-only

# Check exclusions aren't too broad
bun run import.ts ./notes --exclude ""
```

**5. Slow performance**

- Reduce batch size
- Use smaller chunk sizes
- Check network latency to OpenAI API
- Ensure database isn't on slow storage

### Getting Help

1. **Check documentation:**
   - README.md
   - PRODUCTION-READINESS.md
   - Phase completion docs (PHASE-*-COMPLETE.md)

2. **Run diagnostics:**
   ```bash
   bun run cli.ts --stats
   bun test
   bun run benchmark.ts
   ```

3. **Enable verbose logging:**
   ```typescript
   console.log('Debug info:', kb.getStats());
   ```

### Performance Tips

**For Large Datasets:**
- Import in smaller batches
- Use --no-chunk for short documents
- Increase chunk size to reduce embeddings
- Consider multiple databases for different topics

**For Fast Searches:**
- Use full-text search when possible
- Cache named vectors
- Limit result count
- Use appropriate similarity thresholds

## Example Workflows

### Research Workflow

```bash
# 1. Import your research papers
bun run import.ts ~/Research --exclude "drafts"

# 2. Create concept vectors
kb> save-vec methodology research methodologies and approaches
kb> save-vec findings empirical results and discoveries

# 3. Search for methodologies used
kb> search research methodologies

# 4. Find papers with both theory and practical results
kb> hybrid methodology | empirical results
```

### Note-Taking Workflow

```bash
# 1. Import your notes
bun run import.ts ~/Notes/Obsidian --exclude ".obsidian,templates"

# 2. Search across all notes
kb> search project ideas for machine learning

# 3. Find related notes
kb> hybrid python | deep learning

# 4. Add quick notes
kb> add New idea: combine transformers with graph neural networks
```

### Documentation Search

```bash
# 1. Import docs
bun run import.ts ./docs --extensions ".md,.txt"

# 2. Quick lookups
kb> fts authentication

# 3. Conceptual search
kb> search how to handle user sessions

# 4. Related concepts
kb> hybrid security | authentication methods
```

---

## Next Steps

- Review [PRODUCTION-READINESS.md](docs/initial-implementation/PRODUCTION-READINESS.md) for deployment
- Check [example.ts](example.ts) for more code examples
- Run [benchmark.ts](benchmark.ts) to test performance
- Explore the test files in `tests/` for advanced usage

**Happy searching!** 🔍
