// Example usage of the Knowledge Database
// This will be functional once Phase 2-5 are complete

import { KnowledgeBase } from './src';

async function main() {
  console.log('Knowledge Database Example\n');

  // Initialize the knowledge base
  const kb = new KnowledgeBase({
    openaiKey: process.env.OPENAI_API_KEY!,
    dbPath: './data/knowledge.db',
    indexPath: './data/vectors.index'
  });

  await kb.initialize();
  console.log('✓ Knowledge base initialized');

  // Add some sample documents
  console.log('\nAdding sample documents...');
  const doc1 = await kb.addDocument(
    'Vector databases enable semantic search using embeddings',
    { category: 'technology', tags: ['ai', 'databases'] },
    'example'
  );
  console.log(`✓ Added document ${doc1}`);

  const doc2 = await kb.addDocument(
    'Machine learning models can understand text meaning',
    { category: 'ai', tags: ['ml', 'nlp'] },
    'example'
  );
  console.log(`✓ Added document ${doc2}`);

  // Perform semantic search
  console.log('\nSearching for: "how to search by meaning"');
  const results = await kb.search('how to search by meaning', { limit: 5 });
  console.log(`Found ${results.length} results:`);
  results.forEach((result, i) => {
    console.log(`\n${i + 1}. Similarity: ${result.similarity.toFixed(3)}`);
    console.log(`   ${result.document.content.substring(0, 100)}...`);
  });

  // Create named vectors
  console.log('\nCreating named vectors...');
  await kb.saveNamedVector(
    'ai_practical',
    'hands-on machine learning implementations and tutorials',
    'Practical AI applications'
  );
  console.log('✓ Saved @ai_practical');

  await kb.saveNamedVector(
    'academic_theory',
    'theoretical research papers and mathematical proofs',
    'Academic theory'
  );
  console.log('✓ Saved @academic_theory');

  // Vector algebra
  console.log('\nPerforming vector algebra: @ai_practical - @academic_theory');
  const practicalVector = await kb.vectorAlgebra([
    { type: 'add', handle: 'ai_practical' },
    { type: 'subtract', handle: 'academic_theory' }
  ]);
  console.log('✓ Vector computed successfully');

  // Clean up
  await kb.close();
  console.log('\n✓ Closed knowledge base');
}

// Run the example
main().catch(console.error);
