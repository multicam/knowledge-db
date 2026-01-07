// OpenAI embeddings provider - Phase 4

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface EmbeddingOptions {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  dimensions?: number;
}

export class OpenAIEmbeddings {
  private apiKey: string;
  private model: string;
  private maxRetries: number;
  private retryDelay: number;
  private batchSize: number;
  private dimensions?: number;
  private totalTokens: number = 0;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', options: EmbeddingOptions = {}) {
    if (!apiKey || apiKey === 'your-api-key-here') {
      throw new Error('Valid OpenAI API key is required');
    }

    this.apiKey = apiKey;
    this.model = model;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.batchSize = options.batchSize ?? 2048; // OpenAI max batch size
    this.dimensions = options.dimensions;
  }

  async embed(text: string): Promise<Float32Array> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const embeddings = await this.embedBatch([text]);
    return embeddings[0]!;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    // Validate inputs
    const validTexts = texts.filter(t => t && t.trim().length > 0);
    if (validTexts.length === 0) {
      throw new Error('All texts are empty');
    }

    if (validTexts.length !== texts.length) {
      console.warn(`Filtered out ${texts.length - validTexts.length} empty texts`);
    }

    // Process in batches if needed
    if (validTexts.length > this.batchSize) {
      return await this.embedBatchChunked(validTexts);
    }

    return await this.embedBatchWithRetry(validTexts);
  }

  private async embedBatchChunked(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const chunk = texts.slice(i, i + this.batchSize);
      const chunkResults = await this.embedBatchWithRetry(chunk);
      results.push(...chunkResults);

      // Small delay between batches to avoid rate limits
      if (i + this.batchSize < texts.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  private async embedBatchWithRetry(texts: string[], attempt: number = 0): Promise<Float32Array[]> {
    try {
      const requestBody: any = {
        model: this.model,
        input: texts
      };

      // Add dimensions parameter if specified (for text-embedding-3-* models)
      if (this.dimensions) {
        requestBody.dimensions = this.dimensions;
      }

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorText;
        } catch {
          errorMessage = errorText;
        }

        // Handle rate limiting with exponential backoff
        if (response.status === 429 && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delay);
          return this.embedBatchWithRetry(texts, attempt + 1);
        }

        // Handle server errors with retry
        if (response.status >= 500 && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`Server error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delay);
          return this.embedBatchWithRetry(texts, attempt + 1);
        }

        throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json() as OpenAIEmbeddingResponse;

      // Track token usage
      this.totalTokens += data.usage.total_tokens;

      // Convert embeddings to Float32Array and sort by index
      return data.data
        .sort((a, b) => a.index - b.index)
        .map(item => new Float32Array(item.embedding));

    } catch (error) {
      // Retry on network errors
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt);
        console.warn(`Network error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
        await this.sleep(delay);
        return this.embedBatchWithRetry(texts, attempt + 1);
      }

      throw new Error(`Failed to get embeddings: ${error}`);
    }
  }

  private isRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get total tokens used
  getTotalTokens(): number {
    return this.totalTokens;
  }

  // Reset token counter
  resetTokenCount(): void {
    this.totalTokens = 0;
  }

  // Get embedding dimension for this model
  getEmbeddingDimension(): number {
    if (this.dimensions) {
      return this.dimensions;
    }

    // Default dimensions for common models
    const modelDimensions: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };

    return modelDimensions[this.model] || 1536;
  }

  // Estimate tokens (rough approximation: ~0.75 tokens per word)
  static estimateTokens(text: string): number {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return 0;
    }
    const words = trimmed.split(/\s+/).length;
    return Math.ceil(words * 0.75);
  }

  // Estimate cost for embedding (based on text-embedding-3-small pricing)
  static estimateCost(tokens: number, model: string = 'text-embedding-3-small'): number {
    const pricing: Record<string, number> = {
      'text-embedding-3-small': 0.00002 / 1000,  // $0.02 per 1M tokens
      'text-embedding-3-large': 0.00013 / 1000,  // $0.13 per 1M tokens
      'text-embedding-ada-002': 0.0001 / 1000,   // $0.10 per 1M tokens
    };

    const pricePerToken = pricing[model] || pricing['text-embedding-3-small']!;
    return tokens * pricePerToken;
  }
}
