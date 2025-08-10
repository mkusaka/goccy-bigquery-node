// BigQuery emulator connection - Simplified version
import { BigQuery } from '@google-cloud/bigquery';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Clear authentication environment variables
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GCLOUD_PROJECT;

// Configuration
const EMULATOR_HOST = process.env.EMULATOR_HOST || 'http://127.0.0.1:9050';
const PROJECT_ID = 'test-project';

// Set emulator host environment variable
process.env.BIGQUERY_EMULATOR_HOST = EMULATOR_HOST;

interface UserRow {
  user_id: number;
  username: string;
  email: string | null;
  is_active: boolean;
}

async function main(): Promise<void> {
  console.log('Connecting to BigQuery emulator (simplified approach)...');
  console.log(`Emulator host: ${EMULATOR_HOST}`);
  console.log(`Project ID: ${PROJECT_ID}\n`);
  
  // Create custom auth client to bypass authentication
  const customAuthClient = {
    request: async (config: any) => ({ data: {} }),
    getAccessToken: async () => ({ token: 'dummy-token' }),
    getProjectId: async () => PROJECT_ID,
    getRequestHeaders: async () => ({}),
  };
  
  // Initialize BigQuery client
  const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    apiEndpoint: 'localhost:9050',
    authClient: customAuthClient as any,
  });
  
  try {
    // Create a test dataset
    const datasetId = 'override_test_dataset';
    
    console.log(`Creating dataset: ${datasetId}`);
    let dataset;
    try {
      [dataset] = await bigquery.createDataset(datasetId);
    } catch (err: any) {
      if (err.code === 409 || err.message?.includes('already')) {
        console.log(`Dataset ${datasetId} already exists`);
        dataset = bigquery.dataset(datasetId);
      } else {
        throw err;
      }
    }
    
    // Create a simple test table
    const tableId = 'simple_users';
    const schema = [
      { name: 'user_id', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'username', type: 'STRING', mode: 'REQUIRED' },
      { name: 'email', type: 'STRING', mode: 'NULLABLE' },
      { name: 'is_active', type: 'BOOLEAN', mode: 'REQUIRED' },
    ];
    
    console.log(`Creating table: ${tableId}`);
    let table;
    try {
      [table] = await dataset.createTable(tableId, { schema });
    } catch (err: any) {
      if (err.code === 409 || err.message?.includes('already')) {
        console.log(`Table ${tableId} already exists`);
        table = dataset.table(tableId);
      } else {
        throw err;
      }
    }
    
    // Insert test data
    const rows = [
      { user_id: 1, username: 'alice', email: 'alice@example.com', is_active: true },
      { user_id: 2, username: 'bob', email: 'bob@example.com', is_active: true },
      { user_id: 3, username: 'charlie', email: null, is_active: false },
    ];
    
    console.log(`\nInserting ${rows.length} rows into ${tableId}`);
    await table.insert(rows);
    
    // Query active users
    const query = `
      SELECT user_id, username, email, is_active
      FROM \`${dataset.id}.${tableId}\`
      WHERE is_active = true
      ORDER BY user_id
    `;
    
    console.log(`\nExecuting query:\n${query}`);
    const [job] = await bigquery.createQueryJob({ query });
    const [queryRows] = await job.getQueryResults() as [UserRow[]];
    
    console.log('\nActive users:');
    queryRows.forEach((row: UserRow) => {
      console.log(`  ID: ${row.user_id}, Username: ${row.username}, Email: ${row.email || 'N/A'}`);
    });
    
    console.log('\n✅ Successfully connected to BigQuery emulator!');
    
  } catch (error) {
    const err = error as Error;
    console.error('\n❌ Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);