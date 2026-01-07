// Markdown import and processing - Phase 7

import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export interface MarkdownDocument {
  content: string;
  metadata: Record<string, any>;
  source: string;
  frontmatter?: Record<string, any>;
  originalPath: string;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface ImportOptions {
  chunkSize?: number;        // Characters per chunk (default: 1000)
  chunkOverlap?: number;     // Overlap between chunks (default: 200)
  includeExtensions?: string[]; // File extensions to include (default: ['.md'])
  excludeDirs?: string[];    // Directories to exclude
  extractFrontmatter?: boolean; // Parse YAML frontmatter (default: true)
  recursive?: boolean;       // Recurse into subdirectories (default: true)
  baseDir?: string;          // Base directory for relative paths
}

const DEFAULT_OPTIONS: Required<ImportOptions> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  includeExtensions: ['.md', '.markdown'],
  excludeDirs: ['node_modules', '.git', 'dist', 'build'],
  extractFrontmatter: true,
  recursive: true,
  baseDir: ''
};

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, any>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const [, yamlContent, mainContent] = match;
  const frontmatter: Record<string, any> = {};

  // Simple YAML parser (handles basic key: value pairs)
  const lines = yamlContent!.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Parse arrays (simple comma-separated values in brackets)
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
      frontmatter[key] = items.filter(s => s.length > 0);
    }
    // Parse numbers
    else if (!isNaN(Number(value))) {
      frontmatter[key] = Number(value);
    }
    // Parse booleans
    else if (value === 'true' || value === 'false') {
      frontmatter[key] = value === 'true';
    }
    // String value
    else {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: mainContent! };
}

/**
 * Chunk a document into smaller pieces with overlap
 */
export function chunkDocument(
  content: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  // If content is smaller than chunk size, return as is
  if (content.length <= chunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let position = 0;

  while (position < content.length) {
    // Extract chunk
    let chunk = content.substring(position, position + chunkSize);

    // If not the first chunk, try to start at a word boundary
    if (position > 0 && overlap > 0) {
      const overlapText = content.substring(Math.max(0, position - overlap), position + chunkSize);
      chunk = overlapText;
    }

    // If not the last chunk, try to end at a sentence or paragraph boundary
    if (position + chunkSize < content.length) {
      // Look for paragraph break
      const paragraphBreak = chunk.lastIndexOf('\n\n');
      if (paragraphBreak > chunkSize * 0.5) {
        chunk = chunk.substring(0, paragraphBreak);
      } else {
        // Look for sentence break
        const sentenceBreak = Math.max(
          chunk.lastIndexOf('. '),
          chunk.lastIndexOf('.\n'),
          chunk.lastIndexOf('! '),
          chunk.lastIndexOf('? ')
        );
        if (sentenceBreak > chunkSize * 0.5) {
          chunk = chunk.substring(0, sentenceBreak + 1);
        }
      }
    }

    chunks.push(chunk.trim());

    // Move position forward, accounting for overlap
    position += chunk.length;
    if (position < content.length && overlap > 0) {
      position -= overlap;
    }
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Process a single markdown file
 */
export function processMarkdownFile(
  filePath: string,
  fileContent: string,
  options: ImportOptions = {}
): MarkdownDocument[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const baseDir = opts.baseDir || '';
  const relativePath = baseDir ? relative(baseDir, filePath) : filePath;

  let content = fileContent;
  let frontmatter: Record<string, any> = {};

  // Extract frontmatter if enabled
  if (opts.extractFrontmatter) {
    const parsed = parseFrontmatter(content);
    frontmatter = parsed.frontmatter;
    content = parsed.content;
  }

  // Clean up content
  content = content.trim();

  // Chunk the document if needed
  const chunks = chunkDocument(content, opts.chunkSize, opts.chunkOverlap);

  // Create documents for each chunk
  return chunks.map((chunk, index) => {
    const metadata: Record<string, any> = {
      ...frontmatter,
      fileType: 'markdown',
      originalLength: content.length,
    };

    // Add chunk info if document was chunked
    if (chunks.length > 1) {
      metadata.isChunk = true;
      metadata.chunkIndex = index;
      metadata.totalChunks = chunks.length;
    }

    return {
      content: chunk,
      metadata,
      source: relativePath,
      frontmatter,
      originalPath: filePath,
      chunkIndex: chunks.length > 1 ? index : undefined,
      totalChunks: chunks.length > 1 ? chunks.length : undefined
    };
  });
}

/**
 * Find all markdown files in a directory
 */
export function findMarkdownFiles(
  dir: string,
  options: ImportOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const files: string[] = [];

  function traverse(currentDir: string) {
    try {
      const entries = readdirSync(currentDir);

      for (const entry of entries) {
        const fullPath = join(currentDir, entry);

        try {
          const stats = statSync(fullPath);

          if (stats.isDirectory()) {
            // Skip excluded directories
            if (opts.excludeDirs.includes(entry)) {
              continue;
            }

            // Recurse if enabled
            if (opts.recursive) {
              traverse(fullPath);
            }
          } else if (stats.isFile()) {
            // Check if file has allowed extension
            const hasAllowedExt = opts.includeExtensions.some(ext =>
              fullPath.toLowerCase().endsWith(ext.toLowerCase())
            );

            if (hasAllowedExt) {
              files.push(fullPath);
            }
          }
        } catch (error) {
          console.warn(`Warning: Could not access ${fullPath}: ${error}`);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}: ${error}`);
    }
  }

  traverse(dir);
  return files;
}

/**
 * Import statistics
 */
export interface ImportStats {
  filesProcessed: number;
  documentsCreated: number;
  chunksCreated: number;
  errors: number;
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * Progress callback
 */
export type ProgressCallback = (stats: ImportStats, currentFile?: string) => void;

/**
 * Import all markdown files from a directory
 */
export async function importDirectory(
  dir: string,
  processor: (docs: MarkdownDocument[]) => Promise<void>,
  options: ImportOptions = {},
  onProgress?: ProgressCallback
): Promise<ImportStats> {
  const opts = { ...DEFAULT_OPTIONS, ...options, baseDir: dir };

  const stats: ImportStats = {
    filesProcessed: 0,
    documentsCreated: 0,
    chunksCreated: 0,
    errors: 0,
    startTime: Date.now()
  };

  // Find all markdown files
  const files = findMarkdownFiles(dir, opts);

  if (files.length === 0) {
    stats.endTime = Date.now();
    stats.duration = stats.endTime - stats.startTime;
    return stats;
  }

  // Process each file
  for (const filePath of files) {
    try {
      // Read file
      const file = Bun.file(filePath);
      const content = await file.text();

      // Process file into documents
      const documents = processMarkdownFile(filePath, content, opts);

      // Send documents to processor
      await processor(documents);

      // Update stats
      stats.filesProcessed++;
      stats.documentsCreated += documents.length;
      stats.chunksCreated += documents.filter(d => d.chunkIndex !== undefined).length;

      // Call progress callback
      if (onProgress) {
        onProgress(stats, filePath);
      }

    } catch (error) {
      console.error(`Error processing ${filePath}: ${error}`);
      stats.errors++;
    }
  }

  stats.endTime = Date.now();
  stats.duration = stats.endTime - stats.startTime;

  return stats;
}

/**
 * Extract text content from markdown (strip formatting)
 */
export function stripMarkdownFormatting(content: string): string {
  let text = content;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');

  // Remove headers but keep text
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');

  // Remove bold/italic
  text = text.replace(/\*\*([^\*]+)\*\*/g, '$1');
  text = text.replace(/\*([^\*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // Remove horizontal rules
  text = text.replace(/^---+$/gm, '');
  text = text.replace(/^\*\*\*+$/gm, '');

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}
