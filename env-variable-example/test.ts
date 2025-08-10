// Simple test to verify BigQuery emulator connection
import { BigQuery } from '@google-cloud/bigquery';
import * as dotenv from 'dotenv';

dotenv.config();

// Clear authentication environment variables to force emulator usage
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GCLOUD_PROJECT;

process.env.BIGQUERY_EMULATOR_HOST = process.env.BIGQUERY_EMULATOR_HOST || 'http://127.0.0.1:9050';

interface TestQueryRow {
  test_value: number;
  current_time: { value: string };
}

async function testConnection(): Promise<void> {
  console.log('Testing BigQuery emulator connection...');
  console.log(`Emulator host: ${process.env.BIGQUERY_EMULATOR_HOST}\n`);
  
  // Create custom auth client that skips authentication
  const customAuthClient = {
    request: async (config: any) => {
      // Simply return success without authentication
      return { data: {} };
    },
    getAccessToken: async () => {
      return { token: 'dummy-token' };
    },
    getProjectId: async () => {
      return 'test-project';
    },
    getRequestHeaders: async () => {
      return {};
    },
  };
  
  const bigquery = new BigQuery({
    projectId: 'test-project',
    apiEndpoint: 'localhost:9050',
    authClient: customAuthClient as any,
  });

  try {
    // Simple query to test connection
    const query = 'SELECT 1 AS test_value, CURRENT_TIMESTAMP() AS current_time';
    
    console.log('Executing test query:', query);
    const [job] = await bigquery.createQueryJob({ query });
    const [rows] = await job.getQueryResults() as [TestQueryRow[]];
    
    if (rows && rows.length > 0) {
      console.log('\n✅ Connection successful!');
      console.log('Test value:', rows[0].test_value);
      console.log('Current time:', rows[0].current_time.value);
      return;
    } else {
      throw new Error('No results returned from test query');
    }
    
  } catch (error) {
    const err = error as Error;
    console.error('\n❌ Connection failed!');
    console.error('Error:', err.message);
    
    // Provide helpful troubleshooting info
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure Docker is running');
    console.log('2. Check if the emulator is running: docker-compose ps');
    console.log('3. Verify port 9050 is accessible: curl http://localhost:9050/discovery/v1/apis/bigquery/v2/rest');
    
    process.exit(1);
  }
}

testConnection();