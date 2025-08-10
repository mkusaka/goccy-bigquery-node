// Minimal test script to verify BigQuery emulator connection
import { BigQuery } from '@google-cloud/bigquery';

// Completely bypass authentication for local emulator
const customAuthClient = {
  request: async (config: any) => {
    console.log('[Auth] Request called with config:', JSON.stringify(config, null, 2).substring(0, 500));
    return { data: {} };
  },
  getAccessToken: async () => ({ token: 'dummy-token' }),
  getProjectId: async () => 'test-project',
  getRequestHeaders: async () => ({}),
};

async function testEmulator() {
  console.log('Testing BigQuery emulator connection...\n');
  
  // Clear all auth environment variables
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GCLOUD_PROJECT;
  
  // Set emulator host
  process.env.BIGQUERY_EMULATOR_HOST = 'http://localhost:9050';
  
  console.log('Environment:');
  console.log('  BIGQUERY_EMULATOR_HOST:', process.env.BIGQUERY_EMULATOR_HOST);
  console.log('  Project ID: test-project\n');
  
  try {
    // Try with just environment variable first
    console.log('Attempt 1: Using environment variable only...');
    const bq1 = new BigQuery({ 
      projectId: 'test-project',
      keyFilename: undefined,
      credentials: undefined,
    });
    
    const query1 = 'SELECT 1 AS num, "hello" AS msg';
    console.log('Query:', query1);
    
    try {
      const [job1] = await bq1.createQueryJob({ query: query1 });
      const [rows1] = await job1.getQueryResults();
      console.log('✅ Success with environment variable!');
      console.log('Results:', rows1);
    } catch (err: any) {
      console.log('❌ Failed with environment variable');
      console.log('Error:', err.message);
    }
    
    console.log('\n---\n');
    
    // Try with custom auth client
    console.log('Attempt 2: Using custom auth client...');
    const bq2 = new BigQuery({ 
      projectId: 'test-project',
      apiEndpoint: 'localhost:9050',
      authClient: customAuthClient as any,
    });
    
    const query2 = 'SELECT 2 AS num, "world" AS msg';
    console.log('Query:', query2);
    
    try {
      const [job2] = await bq2.createQueryJob({ query: query2 });
      const [rows2] = await job2.getQueryResults();
      console.log('✅ Success with custom auth client!');
      console.log('Results:', rows2);
    } catch (err: any) {
      console.log('❌ Failed with custom auth client');
      console.log('Error:', err.message);
    }
    
  } catch (error: any) {
    console.error('Unexpected error:', error);
  }
}

testEmulator();