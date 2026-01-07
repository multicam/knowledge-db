#!/usr/bin/env bun
// Import script for markdown files - Phase 7

import { parseArgs } from 'util';
import { KnowledgeBase } from './src';
import {
  importDirectory,
  findMarkdownFiles,
  type MarkdownDocument,
  type ImportOptions,
  type ImportStats
} from './src/import/markdown';
import { existsSync } from 'fs';

const DEFAULT_DB_PATH = './data/knowledge.db';
const DEFAULT_INDEX_PATH = './data/vectors.index';

// Color codes
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

function showHelp() {
  console.log(`
${colorize('Knowledge Database Import Tool', 'bold')}

${colorize('USAGE:', 'green')}
  bun run import.ts <directory> [options]

${colorize('ARGUMENTS:', 'green')}
  <directory>              Directory containing markdown files to import

${colorize('OPTIONS:', 'green')}
  --chunk-size <n>         Characters per chunk (default: 1000)
  --chunk-overlap <n>      Overlap between chunks (default: 200)
  --no-chunk               Disable chunking (import as single documents)
  --no-frontmatter         Don't parse YAML frontmatter
  --no-recursive           Don't recurse into subdirectories
  --exclude <dirs>         Comma-separated list of directories to exclude
  --extensions <exts>      Comma-separated list of extensions (default: .md,.markdown)
  --dry-run                Show what would be imported without importing
  --stats-only             Only show statistics, don't import
  --db <path>              Database path (default: ./data/knowledge.db)
  --index <path>           Index path (default: ./data/vectors.index)
  -h, --help               Show this help message

${colorize('EXAMPLES:', 'green')}
  ${colorize('# Import all markdown files from a directory', 'dim')}
  bun run import.ts ./my-notes

  ${colorize('# Import without chunking', 'dim')}
  bun run import.ts ./my-notes --no-chunk

  ${colorize('# Custom chunk size', 'dim')}
  bun run import.ts ./my-notes --chunk-size 2000 --chunk-overlap 300

  ${colorize('# Dry run to see what would be imported', 'dim')}
  bun run import.ts ./my-notes --dry-run

  ${colorize('# Only show statistics', 'dim')}
  bun run import.ts ./my-notes --stats-only

  ${colorize('# Exclude specific directories', 'dim')}
  bun run import.ts ./my-notes --exclude "drafts,archive"
  `);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function printProgress(stats: ImportStats, currentFile?: string) {
  const duration = Date.now() - stats.startTime;
  const filesPerSec = duration > 0 ? (stats.filesProcessed / (duration / 1000)).toFixed(1) : '0';

  process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear line

  const status = colorize(
    `[${stats.filesProcessed} files, ${stats.documentsCreated} docs, ${stats.chunksCreated} chunks, ${stats.errors} errors] `,
    'cyan'
  );

  const speed = colorize(`${filesPerSec} files/s`, 'dim');

  if (currentFile) {
    const fileName = currentFile.split('/').pop() || currentFile;
    process.stdout.write(`${status}${speed} - ${colorize(fileName, 'yellow')}`);
  } else {
    process.stdout.write(`${status}${speed}`);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      'chunk-size': { type: 'string' },
      'chunk-overlap': { type: 'string' },
      'no-chunk': { type: 'boolean' },
      'no-frontmatter': { type: 'boolean' },
      'no-recursive': { type: 'boolean' },
      exclude: { type: 'string' },
      extensions: { type: 'string' },
      'dry-run': { type: 'boolean' },
      'stats-only': { type: 'boolean' },
      db: { type: 'string', default: DEFAULT_DB_PATH },
      index: { type: 'string', default: DEFAULT_INDEX_PATH },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // Get directory argument
  const directory = positionals[0];
  if (!directory) {
    console.error(colorize('Error: Directory argument required', 'red'));
    console.log(colorize('Usage: bun run import.ts <directory> [options]', 'yellow'));
    console.log(colorize('Run with --help for more information', 'dim'));
    process.exit(1);
  }

  // Check if directory exists
  if (!existsSync(directory)) {
    console.error(colorize(`Error: Directory not found: ${directory}`, 'red'));
    process.exit(1);
  }

  // Build import options
  const importOptions: ImportOptions = {
    extractFrontmatter: !values['no-frontmatter'],
    recursive: !values['no-recursive']
  };

  // Chunk settings
  if (values['no-chunk']) {
    importOptions.chunkSize = Infinity; // Don't chunk
  } else {
    if (values['chunk-size']) {
      importOptions.chunkSize = parseInt(values['chunk-size']);
    }
    if (values['chunk-overlap']) {
      importOptions.chunkOverlap = parseInt(values['chunk-overlap']);
    }
  }

  // Extensions
  if (values.extensions) {
    importOptions.includeExtensions = values.extensions.split(',').map(e => e.trim());
  }

  // Exclude directories
  if (values.exclude) {
    importOptions.excludeDirs = values.exclude.split(',').map(d => d.trim());
  }

  console.log(colorize('\n📁 Knowledge Database Import', 'bold'));
  console.log(colorize('─'.repeat(60), 'dim'));
  console.log(`${colorize('Directory:', 'cyan')} ${directory}`);
  console.log(`${colorize('Chunk Size:', 'cyan')} ${importOptions.chunkSize === Infinity ? 'disabled' : importOptions.chunkSize}`);
  if (importOptions.chunkSize !== Infinity) {
    console.log(`${colorize('Chunk Overlap:', 'cyan')} ${importOptions.chunkOverlap}`);
  }
  console.log(`${colorize('Extract Frontmatter:', 'cyan')} ${importOptions.extractFrontmatter ? 'yes' : 'no'}`);
  console.log(`${colorize('Recursive:', 'cyan')} ${importOptions.recursive ? 'yes' : 'no'}`);

  if (importOptions.excludeDirs && importOptions.excludeDirs.length > 0) {
    console.log(`${colorize('Excluded Dirs:', 'cyan')} ${importOptions.excludeDirs.join(', ')}`);
  }

  // Stats-only mode: just show what would be imported
  if (values['stats-only']) {
    console.log(colorize('\n📊 Scanning files...', 'bold'));
    const files = findMarkdownFiles(directory, importOptions);

    console.log(`${colorize('Files found:', 'cyan')} ${files.length}`);

    if (files.length > 0) {
      console.log(colorize('\nSample files:', 'dim'));
      files.slice(0, 10).forEach(f => {
        console.log(`  ${colorize('•', 'dim')} ${f}`);
      });

      if (files.length > 10) {
        console.log(`  ${colorize(`... and ${files.length - 10} more`, 'dim')}`);
      }
    }

    process.exit(0);
  }

  // Dry-run mode: process files but don't import
  if (values['dry-run']) {
    console.log(colorize('\n🔍 Dry Run Mode - No changes will be made', 'yellow'));
    console.log(colorize('─'.repeat(60), 'dim'));

    const files = findMarkdownFiles(directory, importOptions);
    let totalDocs = 0;
    let totalChunks = 0;

    for (const filePath of files) {
      try {
        const file = Bun.file(filePath);
        const content = await file.text();

        const { processMarkdownFile } = await import('./src/import/markdown');
        const documents = processMarkdownFile(filePath, content, importOptions);

        totalDocs += documents.length;
        totalChunks += documents.filter(d => d.chunkIndex !== undefined).length;

        const fileName = filePath.split('/').pop() || filePath;
        const chunked = documents.length > 1 ? colorize(` (${documents.length} chunks)`, 'yellow') : '';
        console.log(`${colorize('✓', 'green')} ${fileName}${chunked}`);
      } catch (error) {
        console.error(`${colorize('✗', 'red')} ${filePath}: ${error}`);
      }
    }

    console.log(colorize('\n📊 Dry Run Summary', 'bold'));
    console.log(`${colorize('Files:', 'cyan')} ${files.length}`);
    console.log(`${colorize('Documents:', 'cyan')} ${totalDocs}`);
    console.log(`${colorize('Chunks:', 'cyan')} ${totalChunks}`);

    process.exit(0);
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error(colorize('\nError: OPENAI_API_KEY environment variable not set', 'red'));
    console.log(colorize('Please set your OpenAI API key in .env file', 'yellow'));
    process.exit(1);
  }

  // Initialize knowledge base
  console.log(colorize('\n🔧 Initializing knowledge base...', 'bold'));
  const kb = new KnowledgeBase({
    openaiKey: process.env.OPENAI_API_KEY,
    dbPath: values.db!,
    indexPath: values.index!
  });

  await kb.initialize();

  // Import documents
  console.log(colorize('\n📥 Importing documents...', 'bold'));
  console.log(colorize('─'.repeat(60), 'dim'));

  const startTime = Date.now();

  const stats = await importDirectory(
    directory,
    async (documents: MarkdownDocument[]) => {
      // Add documents to knowledge base
      const docsToAdd = documents.map(d => ({
        content: d.content,
        metadata: d.metadata,
        source: d.source
      }));

      await kb.addDocuments(docsToAdd);
    },
    importOptions,
    (stats, currentFile) => {
      printProgress(stats, currentFile);
    }
  );

  process.stdout.write('\n\n'); // New line after progress

  // Show final statistics
  console.log(colorize('✅ Import Complete!', 'green'));
  console.log(colorize('─'.repeat(60), 'dim'));
  console.log(`${colorize('Files Processed:', 'cyan')} ${stats.filesProcessed}`);
  console.log(`${colorize('Documents Created:', 'cyan')} ${stats.documentsCreated}`);
  console.log(`${colorize('Chunks Created:', 'cyan')} ${stats.chunksCreated}`);
  console.log(`${colorize('Errors:', 'cyan')} ${stats.errors}`);
  console.log(`${colorize('Duration:', 'cyan')} ${formatDuration(stats.duration!)}`);

  // Show database stats
  const dbStats = kb.getStats();
  console.log(colorize('\n📊 Database Statistics', 'bold'));
  console.log(colorize('─'.repeat(60), 'dim'));
  console.log(`${colorize('Total Documents:', 'cyan')} ${dbStats.documents}`);
  console.log(`${colorize('Total Embeddings:', 'cyan')} ${dbStats.embeddings}`);
  console.log(`${colorize('Vector Count:', 'cyan')} ${dbStats.vectorCount}`);
  console.log(`${colorize('Tokens Used:', 'cyan')} ${dbStats.tokensUsed.toLocaleString()}`);

  const cost = dbStats.tokensUsed * 0.00002 / 1000;
  console.log(`${colorize('Estimated Cost:', 'cyan')} $${cost.toFixed(6)}`);

  await kb.close();
}

// Run main
try {
  await main();
} catch (error) {
  console.error(colorize(`\nError: ${error}`, 'red'));
  process.exit(1);
}
