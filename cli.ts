#!/usr/bin/env bun
// CLI interface - Phase 6

import { parseArgs } from 'util';
import { KnowledgeBase } from './src';
import type { SearchResult, VectorOperation } from './src/types';

const DEFAULT_DB_PATH = './data/knowledge.db';
const DEFAULT_INDEX_PATH = './data/vectors.index';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(text: string) {
  console.log(`\n${colorize(text, 'bold')}${colorize('', 'reset')}`);
  console.log(colorize('─'.repeat(60), 'dim'));
}

function printResult(result: SearchResult, index: number) {
  const similarity = (result.similarity * 100).toFixed(1);
  console.log(`\n${colorize(`[${index + 1}]`, 'bold')} ${colorize(`Similarity: ${similarity}%`, 'cyan')}`);
  console.log(colorize(`ID: ${result.document.id}`, 'dim'));

  if (result.document.metadata && Object.keys(result.document.metadata).length > 0) {
    console.log(colorize(`Metadata: ${JSON.stringify(result.document.metadata)}`, 'dim'));
  }

  if (result.document.source) {
    console.log(colorize(`Source: ${result.document.source}`, 'dim'));
  }

  const content = result.document.content.substring(0, 200);
  const truncated = result.document.content.length > 200 ? '...' : '';
  console.log(`${content}${truncated}`);
}

function printDocument(doc: any, index?: number) {
  const prefix = index !== undefined ? `${colorize(`[${index + 1}]`, 'bold')} ` : '';
  console.log(`\n${prefix}${colorize(`ID: ${doc.id}`, 'cyan')}`);

  if (doc.metadata && Object.keys(doc.metadata).length > 0) {
    console.log(colorize(`Metadata: ${JSON.stringify(doc.metadata)}`, 'dim'));
  }

  if (doc.source) {
    console.log(colorize(`Source: ${doc.source}`, 'dim'));
  }

  const content = doc.content.substring(0, 200);
  const truncated = doc.content.length > 200 ? '...' : '';
  console.log(`${content}${truncated}`);
}

function showHelp() {
  console.log(`
${colorize('Knowledge Database CLI', 'bold')}

${colorize('USAGE:', 'green')}
  ${colorize('Interactive mode:', 'yellow')}
    bun run cli.ts

  ${colorize('Command mode:', 'yellow')}
    bun run cli.ts [command] [options]

${colorize('COMMANDS:', 'green')}
  ${colorize('Document Management:', 'cyan')}
    --add <text>              Add a document
    --add-batch <file>        Add documents from JSON file
    --get <id>                Get document by ID
    --list [limit]            List all documents
    --delete <id>             Delete a document

  ${colorize('Search:', 'cyan')}
    --search <query>          Semantic search
    --fts <query>             Full-text search
    --hybrid <sql> <semantic> Hybrid search (SQL + semantic)
    --vector-search <handle>  Search using named vector

  ${colorize('Named Vectors:', 'cyan')}
    --save-vector <handle> <text> [desc]  Save named vector
    --get-vector <handle>                  Get named vector
    --list-vectors                         List all named vectors
    --delete-vector <handle>               Delete named vector

  ${colorize('Vector Algebra:', 'cyan')}
    --algebra <operations>    Perform vector algebra search
                              Format: "handle1,+,1.0;handle2,-,0.5"

  ${colorize('Utilities:', 'cyan')}
    --stats                   Show database statistics
    --help, -h                Show this help message

${colorize('OPTIONS:', 'green')}
  -l, --limit <n>           Result limit (default: 10)
  -t, --threshold <n>       Similarity threshold (default: 0.0)
  --db <path>               Database path (default: ./data/knowledge.db)
  --index <path>            Index path (default: ./data/vectors.index)

${colorize('EXAMPLES:', 'green')}
  ${colorize('# Start interactive mode', 'dim')}
  bun run cli.ts

  ${colorize('# Search for documents', 'dim')}
  bun run cli.ts --search "machine learning tutorials" --limit 5

  ${colorize('# Add a document', 'dim')}
  bun run cli.ts --add "Vector databases enable semantic search"

  ${colorize('# Hybrid search', 'dim')}
  bun run cli.ts --hybrid "Python" "machine learning" --limit 10

  ${colorize('# Save and use named vectors', 'dim')}
  bun run cli.ts --save-vector ai_practical "hands-on tutorials"
  bun run cli.ts --algebra "ai_practical,+,1.0" --limit 5

  ${colorize('# Get statistics', 'dim')}
  bun run cli.ts --stats
  `);
}

async function runInteractive(kb: KnowledgeBase) {
  console.log(colorize('\n🔍 Knowledge Database - Interactive Mode', 'bold'));
  console.log(colorize('Type "help" for commands, "exit" to quit\n', 'dim'));

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colorize('kb> ', 'green')
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      continue;
    }

    const [cmd, ...args] = input.split(' ');

    try {
      switch (cmd.toLowerCase()) {
        case 'help':
          console.log(`
${colorize('Available Commands:', 'cyan')}
  ${colorize('search <query>', 'yellow')}              Semantic search
  ${colorize('fts <query>', 'yellow')}                 Full-text search
  ${colorize('hybrid <sql> | <semantic>', 'yellow')}   Hybrid search (use | separator)
  ${colorize('add <text>', 'yellow')}                  Add document
  ${colorize('get <id>', 'yellow')}                    Get document by ID
  ${colorize('list [limit]', 'yellow')}                List documents
  ${colorize('delete <id>', 'yellow')}                 Delete document
  ${colorize('save-vec <handle> <text>', 'yellow')}    Save named vector
  ${colorize('get-vec <handle>', 'yellow')}            Get named vector
  ${colorize('list-vecs', 'yellow')}                   List named vectors
  ${colorize('delete-vec <handle>', 'yellow')}         Delete named vector
  ${colorize('stats', 'yellow')}                       Show statistics
  ${colorize('help', 'yellow')}                        Show this help
  ${colorize('exit', 'yellow')}                        Exit interactive mode
          `);
          break;

        case 'search': {
          const query = args.join(' ');
          if (!query) {
            console.log(colorize('Usage: search <query>', 'red'));
            break;
          }

          printHeader('🔍 Semantic Search Results');
          const results = await kb.search(query, { limit: 10 });

          if (results.length === 0) {
            console.log(colorize('No results found', 'yellow'));
          } else {
            results.forEach((r, i) => printResult(r, i));
            console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
          }
          break;
        }

        case 'fts': {
          const query = args.join(' ');
          if (!query) {
            console.log(colorize('Usage: fts <query>', 'red'));
            break;
          }

          printHeader('📝 Full-Text Search Results');
          const results = kb.fulltextSearch(query, 10);

          if (results.length === 0) {
            console.log(colorize('No results found', 'yellow'));
          } else {
            results.forEach((doc, i) => printDocument(doc, i));
            console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
          }
          break;
        }

        case 'hybrid': {
          const fullQuery = args.join(' ');
          const parts = fullQuery.split('|').map(s => s.trim());

          if (parts.length !== 2) {
            console.log(colorize('Usage: hybrid <sql query> | <semantic query>', 'red'));
            break;
          }

          printHeader('🔀 Hybrid Search Results');
          const results = await kb.hybridSearch(parts[0]!, parts[1]!, 10);

          if (results.length === 0) {
            console.log(colorize('No results found', 'yellow'));
          } else {
            results.forEach((r, i) => {
              const score = (r.score * 100).toFixed(1);
              console.log(`\n${colorize(`[${i + 1}]`, 'bold')} ${colorize(`Score: ${score}%`, 'cyan')}`);
              console.log(colorize(`ID: ${r.document.id}`, 'dim'));
              const content = r.document.content.substring(0, 200);
              console.log(`${content}${r.document.content.length > 200 ? '...' : ''}`);
            });
            console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
          }
          break;
        }

        case 'add': {
          const text = args.join(' ');
          if (!text) {
            console.log(colorize('Usage: add <text>', 'red'));
            break;
          }

          const id = await kb.addDocument(text);
          console.log(colorize(`✓ Added document with ID: ${id}`, 'green'));
          break;
        }

        case 'get': {
          const id = parseInt(args[0] || '');
          if (isNaN(id)) {
            console.log(colorize('Usage: get <id>', 'red'));
            break;
          }

          const doc = kb.getDocument(id);
          if (!doc) {
            console.log(colorize(`Document ${id} not found`, 'yellow'));
          } else {
            printDocument(doc);
          }
          break;
        }

        case 'list': {
          const limit = parseInt(args[0] || '10');
          printHeader('📚 Documents');
          const docs = kb.getAllDocuments(limit);

          if (docs.length === 0) {
            console.log(colorize('No documents found', 'yellow'));
          } else {
            docs.forEach((doc, i) => printDocument(doc, i));
            console.log(colorize(`\n\nShowing ${docs.length} documents`, 'dim'));
          }
          break;
        }

        case 'delete': {
          const id = parseInt(args[0] || '');
          if (isNaN(id)) {
            console.log(colorize('Usage: delete <id>', 'red'));
            break;
          }

          const deleted = await kb.deleteDocument(id);
          if (deleted) {
            console.log(colorize(`✓ Deleted document ${id}`, 'green'));
          } else {
            console.log(colorize(`Document ${id} not found`, 'yellow'));
          }
          break;
        }

        case 'save-vec': {
          const [handle, ...textParts] = args;
          const text = textParts.join(' ');

          if (!handle || !text) {
            console.log(colorize('Usage: save-vec <handle> <text>', 'red'));
            break;
          }

          await kb.saveNamedVector(handle, text);
          console.log(colorize(`✓ Saved named vector: @${handle}`, 'green'));
          break;
        }

        case 'get-vec': {
          const handle = args[0];
          if (!handle) {
            console.log(colorize('Usage: get-vec <handle>', 'red'));
            break;
          }

          const vec = kb.getNamedVector(handle);
          if (!vec) {
            console.log(colorize(`Named vector @${handle} not found`, 'yellow'));
          } else {
            console.log(`\n${colorize(`@${vec.handle}`, 'cyan')}`);
            if (vec.description) {
              console.log(colorize(vec.description, 'dim'));
            }
            console.log(colorize(`Dimension: ${vec.vector.length}`, 'dim'));
          }
          break;
        }

        case 'list-vecs': {
          printHeader('🏷️  Named Vectors');
          const vectors = kb.getAllNamedVectors();

          if (vectors.length === 0) {
            console.log(colorize('No named vectors found', 'yellow'));
          } else {
            vectors.forEach((vec, i) => {
              console.log(`\n${colorize(`[${i + 1}]`, 'bold')} ${colorize(`@${vec.handle}`, 'cyan')}`);
              if (vec.description) {
                console.log(colorize(vec.description, 'dim'));
              }
              console.log(colorize(`Dimension: ${vec.vector.length}`, 'dim'));
            });
            console.log(colorize(`\n\nTotal: ${vectors.length} named vectors`, 'dim'));
          }
          break;
        }

        case 'delete-vec': {
          const handle = args[0];
          if (!handle) {
            console.log(colorize('Usage: delete-vec <handle>', 'red'));
            break;
          }

          const deleted = kb.deleteNamedVector(handle);
          if (deleted) {
            console.log(colorize(`✓ Deleted named vector: @${handle}`, 'green'));
          } else {
            console.log(colorize(`Named vector @${handle} not found`, 'yellow'));
          }
          break;
        }

        case 'stats': {
          const stats = kb.getStats();
          printHeader('📊 Database Statistics');
          console.log(`${colorize('Documents:', 'cyan')} ${stats.documents}`);
          console.log(`${colorize('Embeddings:', 'cyan')} ${stats.embeddings}`);
          console.log(`${colorize('Vector Count:', 'cyan')} ${stats.vectorCount}`);
          console.log(`${colorize('Dimension:', 'cyan')} ${stats.dimension}`);
          console.log(`${colorize('Named Vectors:', 'cyan')} ${stats.namedVectors}`);
          console.log(`${colorize('Tokens Used:', 'cyan')} ${stats.tokensUsed.toLocaleString()}`);

          const cost = stats.tokensUsed * 0.00002 / 1000;
          console.log(`${colorize('Estimated Cost:', 'cyan')} $${cost.toFixed(6)}`);
          break;
        }

        case 'exit':
        case 'quit':
          console.log(colorize('\nGoodbye!', 'green'));
          rl.close();
          return;

        default:
          console.log(colorize(`Unknown command: ${cmd}`, 'red'));
          console.log(colorize('Type "help" for available commands', 'dim'));
      }
    } catch (error) {
      console.log(colorize(`Error: ${error}`, 'red'));
    }

    console.log(); // Empty line
    rl.prompt();
  }
}

async function runCommand(kb: KnowledgeBase, values: any) {
  // Document management
  if (values.add) {
    const id = await kb.addDocument(values.add);
    console.log(colorize(`✓ Added document with ID: ${id}`, 'green'));
    return;
  }

  if (values['add-batch']) {
    const file = Bun.file(values['add-batch']);
    const data = await file.json();
    const ids = await kb.addDocuments(data);
    console.log(colorize(`✓ Added ${ids.length} documents`, 'green'));
    return;
  }

  if (values.get) {
    const id = parseInt(values.get);
    const doc = kb.getDocument(id);
    if (!doc) {
      console.log(colorize(`Document ${id} not found`, 'yellow'));
    } else {
      printDocument(doc);
    }
    return;
  }

  if (values.list !== undefined) {
    const limit = typeof values.list === 'string' ? parseInt(values.list) : 10;
    printHeader('📚 Documents');
    const docs = kb.getAllDocuments(limit);
    docs.forEach((doc, i) => printDocument(doc, i));
    console.log(colorize(`\n\nShowing ${docs.length} documents`, 'dim'));
    return;
  }

  if (values.delete) {
    const id = parseInt(values.delete);
    const deleted = await kb.deleteDocument(id);
    if (deleted) {
      console.log(colorize(`✓ Deleted document ${id}`, 'green'));
    } else {
      console.log(colorize(`Document ${id} not found`, 'yellow'));
    }
    return;
  }

  // Search
  if (values.search) {
    const limit = parseInt(values.limit || '10');
    const threshold = parseFloat(values.threshold || '0');

    printHeader('🔍 Semantic Search Results');
    const results = await kb.search(values.search, { limit, threshold });

    if (results.length === 0) {
      console.log(colorize('No results found', 'yellow'));
    } else {
      results.forEach((r, i) => printResult(r, i));
      console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
    }
    return;
  }

  if (values.fts) {
    const limit = parseInt(values.limit || '10');
    printHeader('📝 Full-Text Search Results');
    const results = kb.fulltextSearch(values.fts, limit);

    if (results.length === 0) {
      console.log(colorize('No results found', 'yellow'));
    } else {
      results.forEach((doc, i) => printDocument(doc, i));
      console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
    }
    return;
  }

  if (values.hybrid) {
    const [sqlQuery, semanticQuery] = values.hybrid.split('|').map((s: string) => s.trim());
    if (!sqlQuery || !semanticQuery) {
      console.log(colorize('Usage: --hybrid "sql query|semantic query"', 'red'));
      return;
    }

    const limit = parseInt(values.limit || '10');
    printHeader('🔀 Hybrid Search Results');
    const results = await kb.hybridSearch(sqlQuery, semanticQuery, limit);

    if (results.length === 0) {
      console.log(colorize('No results found', 'yellow'));
    } else {
      results.forEach((r, i) => {
        const score = (r.score * 100).toFixed(1);
        console.log(`\n${colorize(`[${i + 1}]`, 'bold')} ${colorize(`Score: ${score}%`, 'cyan')}`);
        console.log(colorize(`ID: ${r.document.id}`, 'dim'));
        const content = r.document.content.substring(0, 200);
        console.log(`${content}${r.document.content.length > 200 ? '...' : ''}`);
      });
      console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
    }
    return;
  }

  if (values['vector-search']) {
    const vec = kb.getNamedVector(values['vector-search']);
    if (!vec) {
      console.log(colorize(`Named vector @${values['vector-search']} not found`, 'yellow'));
      return;
    }

    const limit = parseInt(values.limit || '10');
    const threshold = parseFloat(values.threshold || '0');

    printHeader(`🔍 Vector Search: @${values['vector-search']}`);
    const results = await kb.searchByVector(vec.vector, { limit, threshold });

    if (results.length === 0) {
      console.log(colorize('No results found', 'yellow'));
    } else {
      results.forEach((r, i) => printResult(r, i));
      console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
    }
    return;
  }

  // Named vectors
  if (values['save-vector']) {
    const parts = values['save-vector'].split(' ');
    const handle = parts[0];
    const text = parts.slice(1).join(' ');
    const description = values.description;

    if (!handle || !text) {
      console.log(colorize('Usage: --save-vector "<handle> <text>" [--description "desc"]', 'red'));
      return;
    }

    await kb.saveNamedVector(handle, text, description);
    console.log(colorize(`✓ Saved named vector: @${handle}`, 'green'));
    return;
  }

  if (values['get-vector']) {
    const vec = kb.getNamedVector(values['get-vector']);
    if (!vec) {
      console.log(colorize(`Named vector @${values['get-vector']} not found`, 'yellow'));
    } else {
      console.log(`\n${colorize(`@${vec.handle}`, 'cyan')}`);
      if (vec.description) {
        console.log(colorize(vec.description, 'dim'));
      }
      console.log(colorize(`Dimension: ${vec.vector.length}`, 'dim'));
    }
    return;
  }

  if (values['list-vectors']) {
    printHeader('🏷️  Named Vectors');
    const vectors = kb.getAllNamedVectors();

    if (vectors.length === 0) {
      console.log(colorize('No named vectors found', 'yellow'));
    } else {
      vectors.forEach((vec, i) => {
        console.log(`\n${colorize(`[${i + 1}]`, 'bold')} ${colorize(`@${vec.handle}`, 'cyan')}`);
        if (vec.description) {
          console.log(colorize(vec.description, 'dim'));
        }
        console.log(colorize(`Dimension: ${vec.vector.length}`, 'dim'));
      });
      console.log(colorize(`\n\nTotal: ${vectors.length} named vectors`, 'dim'));
    }
    return;
  }

  if (values['delete-vector']) {
    const deleted = kb.deleteNamedVector(values['delete-vector']);
    if (deleted) {
      console.log(colorize(`✓ Deleted named vector: @${values['delete-vector']}`, 'green'));
    } else {
      console.log(colorize(`Named vector @${values['delete-vector']} not found`, 'yellow'));
    }
    return;
  }

  // Vector algebra
  if (values.algebra) {
    // Parse operations: "handle1,+,1.0;handle2,-,0.5"
    const ops = values.algebra.split(';').map((op: string) => {
      const [handle, type, weight] = op.split(',');
      return {
        handle: handle!.trim(),
        type: type!.trim() === '+' ? 'add' : 'subtract',
        weight: weight ? parseFloat(weight) : 1.0
      } as VectorOperation;
    });

    const limit = parseInt(values.limit || '10');
    const threshold = parseFloat(values.threshold || '0');

    printHeader('🧮 Vector Algebra Search');
    console.log(colorize(`Operations: ${ops.map(o => `${o.type === 'add' ? '+' : '-'}@${o.handle}×${o.weight}`).join(' ')}`, 'dim'));

    const results = await kb.searchWithVectorAlgebra(ops, { limit, threshold });

    if (results.length === 0) {
      console.log(colorize('No results found', 'yellow'));
    } else {
      results.forEach((r, i) => printResult(r, i));
      console.log(colorize(`\n\nFound ${results.length} results`, 'dim'));
    }
    return;
  }

  // Stats
  if (values.stats) {
    const stats = kb.getStats();
    printHeader('📊 Database Statistics');
    console.log(`${colorize('Documents:', 'cyan')} ${stats.documents}`);
    console.log(`${colorize('Embeddings:', 'cyan')} ${stats.embeddings}`);
    console.log(`${colorize('Vector Count:', 'cyan')} ${stats.vectorCount}`);
    console.log(`${colorize('Dimension:', 'cyan')} ${stats.dimension}`);
    console.log(`${colorize('Named Vectors:', 'cyan')} ${stats.namedVectors}`);
    console.log(`${colorize('Tokens Used:', 'cyan')} ${stats.tokensUsed.toLocaleString()}`);

    const cost = stats.tokensUsed * 0.00002 / 1000;
    console.log(`${colorize('Estimated Cost:', 'cyan')} $${cost.toFixed(6)}`);
    return;
  }

  // If no command specified, show help
  console.log(colorize('No command specified. Use --help for usage information.', 'yellow'));
}

// Main
try {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      // Document management
      add: { type: 'string' },
      'add-batch': { type: 'string' },
      get: { type: 'string' },
      list: { type: 'string', default: undefined },
      delete: { type: 'string' },

      // Search
      search: { type: 'string' },
      fts: { type: 'string' },
      hybrid: { type: 'string' },
      'vector-search': { type: 'string' },

      // Named vectors
      'save-vector': { type: 'string' },
      'get-vector': { type: 'string' },
      'list-vectors': { type: 'boolean' },
      'delete-vector': { type: 'string' },
      description: { type: 'string' },

      // Vector algebra
      algebra: { type: 'string' },

      // Utilities
      stats: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },

      // Options
      limit: { type: 'string', short: 'l', default: '10' },
      threshold: { type: 'string', short: 't', default: '0' },
      db: { type: 'string', default: DEFAULT_DB_PATH },
      index: { type: 'string', default: DEFAULT_INDEX_PATH }
    },
    allowPositionals: true
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log(colorize('Error: OPENAI_API_KEY environment variable not set', 'red'));
    console.log(colorize('Please set your OpenAI API key in .env file', 'yellow'));
    process.exit(1);
  }

  // Initialize knowledge base
  const kb = new KnowledgeBase({
    openaiKey: process.env.OPENAI_API_KEY,
    dbPath: values.db,
    indexPath: values.index
  });

  await kb.initialize();

  // Check if running in interactive mode (no command args)
  const hasCommand = values.add || values['add-batch'] || values.get ||
                     values.list !== undefined || values.delete ||
                     values.search || values.fts || values.hybrid || values['vector-search'] ||
                     values['save-vector'] || values['get-vector'] || values['list-vectors'] ||
                     values['delete-vector'] || values.algebra || values.stats;

  if (!hasCommand) {
    await runInteractive(kb);
  } else {
    await runCommand(kb, values);
  }

  await kb.close();
} catch (error) {
  console.error(colorize(`Error: ${error}`, 'red'));
  process.exit(1);
}
