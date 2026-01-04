// Core TypeScript types for the Knowledge Database

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

export interface KnowledgeBaseConfig {
  dbPath?: string;
  indexPath?: string;
  openaiKey: string;
  dimension?: number;
}
