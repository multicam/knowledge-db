import { test, expect, describe } from 'bun:test';
import { OpenAIEmbeddings } from '../src/embeddings/openai';

describe('OpenAIEmbeddings', () => {
  describe('Constructor', () => {
    test('should create instance with valid API key', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key');
      expect(embeddings).toBeDefined();
      expect(embeddings.getEmbeddingDimension()).toBe(1536);
    });

    test('should throw error for invalid API key', () => {
      expect(() => {
        new OpenAIEmbeddings('your-api-key-here');
      }).toThrow('Valid OpenAI API key is required');
    });

    test('should throw error for empty API key', () => {
      expect(() => {
        new OpenAIEmbeddings('');
      }).toThrow('Valid OpenAI API key is required');
    });

    test('should accept custom model', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key', 'text-embedding-3-large');
      expect(embeddings.getEmbeddingDimension()).toBe(3072);
    });

    test('should accept custom options', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key', 'text-embedding-3-small', {
        maxRetries: 5,
        retryDelay: 2000,
        batchSize: 100,
        dimensions: 512
      });
      expect(embeddings.getEmbeddingDimension()).toBe(512);
    });
  });

  describe('Input Validation', () => {
    test('should throw error for empty text', async () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key');
      await expect(embeddings.embed('')).rejects.toThrow('Text cannot be empty');
    });

    test('should throw error for whitespace-only text', async () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key');
      await expect(embeddings.embed('   ')).rejects.toThrow('Text cannot be empty');
    });

    test('should return empty array for empty batch', async () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key');
      const result = await embeddings.embedBatch([]);
      expect(result).toEqual([]);
    });

    test('should throw error when all texts in batch are empty', async () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key');
      await expect(embeddings.embedBatch(['', '  ', '\n'])).rejects.toThrow('All texts are empty');
    });
  });

  describe('Model Dimensions', () => {
    test('should return correct dimension for text-embedding-3-small', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key', 'text-embedding-3-small');
      expect(embeddings.getEmbeddingDimension()).toBe(1536);
    });

    test('should return correct dimension for text-embedding-3-large', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key', 'text-embedding-3-large');
      expect(embeddings.getEmbeddingDimension()).toBe(3072);
    });

    test('should return correct dimension for text-embedding-ada-002', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key', 'text-embedding-ada-002');
      expect(embeddings.getEmbeddingDimension()).toBe(1536);
    });

    test('should return default dimension for unknown model', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key', 'unknown-model');
      expect(embeddings.getEmbeddingDimension()).toBe(1536);
    });

    test('should use custom dimensions when specified', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key', 'text-embedding-3-small', {
        dimensions: 256
      });
      expect(embeddings.getEmbeddingDimension()).toBe(256);
    });
  });

  describe('Token Tracking', () => {
    test('should initialize with zero tokens', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key');
      expect(embeddings.getTotalTokens()).toBe(0);
    });

    test('should reset token count', () => {
      const embeddings = new OpenAIEmbeddings('sk-test-key');
      embeddings.resetTokenCount();
      expect(embeddings.getTotalTokens()).toBe(0);
    });
  });

  describe('Static Utility Methods', () => {
    describe('estimateTokens', () => {
      test('should estimate tokens for simple text', () => {
        const tokens = OpenAIEmbeddings.estimateTokens('Hello world');
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThan(10);
      });

      test('should estimate tokens for longer text', () => {
        const text = 'The quick brown fox jumps over the lazy dog';
        const tokens = OpenAIEmbeddings.estimateTokens(text);
        expect(tokens).toBeGreaterThan(5);
      });

      test('should handle empty string', () => {
        const tokens = OpenAIEmbeddings.estimateTokens('');
        expect(tokens).toBe(0);
      });

      test('should handle whitespace', () => {
        const tokens = OpenAIEmbeddings.estimateTokens('   ');
        expect(tokens).toBeLessThan(2);
      });
    });

    describe('estimateCost', () => {
      test('should estimate cost for text-embedding-3-small', () => {
        const cost = OpenAIEmbeddings.estimateCost(1000, 'text-embedding-3-small');
        expect(cost).toBeCloseTo(0.00002, 6);
      });

      test('should estimate cost for text-embedding-3-large', () => {
        const cost = OpenAIEmbeddings.estimateCost(1000, 'text-embedding-3-large');
        expect(cost).toBeCloseTo(0.00013, 6);
      });

      test('should estimate cost for text-embedding-ada-002', () => {
        const cost = OpenAIEmbeddings.estimateCost(1000, 'text-embedding-ada-002');
        expect(cost).toBeCloseTo(0.0001, 6);
      });

      test('should use default pricing for unknown model', () => {
        const cost = OpenAIEmbeddings.estimateCost(1000, 'unknown-model');
        expect(cost).toBeGreaterThan(0);
      });

      test('should calculate cost for zero tokens', () => {
        const cost = OpenAIEmbeddings.estimateCost(0);
        expect(cost).toBe(0);
      });

      test('should calculate cost for large token count', () => {
        const cost = OpenAIEmbeddings.estimateCost(1000000); // 1M tokens
        expect(cost).toBeCloseTo(0.02, 3); // ~$0.02 for text-embedding-3-small
      });
    });
  });
});

// Integration tests - only run if OPENAI_API_KEY is set
describe('OpenAIEmbeddings Integration', () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const shouldRunIntegrationTests = apiKey && !apiKey.includes('your-api-key-here');

  if (!shouldRunIntegrationTests) {
    test.skip('Integration tests require valid OPENAI_API_KEY', () => {});
    return;
  }

  describe('Real API Calls', () => {
    test('should embed single text', async () => {
      const embeddings = new OpenAIEmbeddings(apiKey!);
      const result = await embeddings.embed('Hello, world!');

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(1536);
      expect(embeddings.getTotalTokens()).toBeGreaterThan(0);
    }, 10000);

    test('should embed batch of texts', async () => {
      const embeddings = new OpenAIEmbeddings(apiKey!);
      const texts = [
        'First text',
        'Second text',
        'Third text'
      ];
      const results = await embeddings.embedBatch(texts);

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Float32Array);
        expect(result.length).toBe(1536);
      });
      expect(embeddings.getTotalTokens()).toBeGreaterThan(0);
    }, 10000);

    test('should filter empty texts from batch', async () => {
      const embeddings = new OpenAIEmbeddings(apiKey!);
      const texts = [
        'Valid text',
        '',
        'Another valid text',
        '   '
      ];
      const results = await embeddings.embedBatch(texts);

      // Should only embed the valid texts
      expect(results.length).toBeLessThan(texts.length);
    }, 10000);

    test('should handle large batch with chunking', async () => {
      const embeddings = new OpenAIEmbeddings(apiKey!, 'text-embedding-3-small', {
        batchSize: 5
      });

      const texts = Array.from({ length: 12 }, (_, i) => `Text number ${i + 1}`);
      const results = await embeddings.embedBatch(texts);

      expect(results.length).toBe(12);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Float32Array);
      });
    }, 30000);

    test('should use custom dimensions', async () => {
      const embeddings = new OpenAIEmbeddings(apiKey!, 'text-embedding-3-small', {
        dimensions: 512
      });
      const result = await embeddings.embed('Test with custom dimensions');

      expect(result.length).toBe(512);
    }, 10000);
  });
});
