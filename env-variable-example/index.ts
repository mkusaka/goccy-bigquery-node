// BigQuery emulator connection using environment variable approach
import { BigQuery } from '@google-cloud/bigquery';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Clear authentication environment variables to force emulator usage
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GCLOUD_PROJECT;

// Set the emulator host via environment variable
// This tells the client to connect to the local emulator instead of GCP
process.env.BIGQUERY_EMULATOR_HOST = process.env.BIGQUERY_EMULATOR_HOST || 'http://127.0.0.1:9050';

interface TestRow {
  id: number;
  name: string;
  created_at: { value: string };
}

interface AggregationRow {
  total: number;
  max_id: number;
}

async function main(): Promise<void> {
  console.log('Connecting to BigQuery emulator using environment variable...');
  console.log(`BIGQUERY_EMULATOR_HOST: ${process.env.BIGQUERY_EMULATOR_HOST}`);
  
  // Create custom auth client to bypass authentication for emulator
  const customAuthClient = {
    request: async (config: any) => ({ data: {} }),
    getAccessToken: async () => ({ token: 'dummy-token' }),
    getProjectId: async () => 'test-project',
    getRequestHeaders: async () => ({}),
  };
  
  // Initialize BigQuery client
  // When BIGQUERY_EMULATOR_HOST is set, the client automatically uses it
  const bigquery = new BigQuery({
    projectId: 'test-project',
    apiEndpoint: 'localhost:9050',
    authClient: customAuthClient as any,
  });

  try {
    // Create a test dataset
    const datasetId = 'test_dataset';
    
    console.log(`\nCreating dataset: ${datasetId}`);
    const [dataset] = await bigquery.createDataset(datasetId).catch((err: any) => {
      if (err.code === 409) {
        console.log(`Dataset ${datasetId} already exists`);
        return [bigquery.dataset(datasetId)];
      }
      throw err;
    });
    
    // Create a test table
    const tableId = 'test_table';
    const schema = [
      { name: 'id', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ];
    
    console.log(`Creating table: ${tableId}`);
    const [table] = await dataset.createTable(tableId, { schema }).catch((err: any) => {
      if (err.code === 409) {
        console.log(`Table ${tableId} already exists`);
        return [dataset.table(tableId)];
      }
      throw err;
    });
    
    // Insert test data
    const rows = [
      { id: 1, name: 'Alice', created_at: new Date().toISOString() },
      { id: 2, name: 'Bob', created_at: new Date().toISOString() },
      { id: 3, name: 'Charlie', created_at: new Date().toISOString() },
    ];
    
    console.log(`\nInserting ${rows.length} rows into ${tableId}`);
    await table.insert(rows);
    
    // Query the data
    const query = `
      SELECT id, name, created_at
      FROM \`${dataset.id}.${tableId}\`
      ORDER BY id
    `;
    
    console.log(`\nExecuting query:\n${query}`);
    const [job] = await bigquery.createQueryJob({ query });
    const [queryRows] = await job.getQueryResults() as [TestRow[]];
    
    console.log('\nQuery results:');
    queryRows.forEach((row: TestRow) => {
      console.log(`  ID: ${row.id}, Name: ${row.name}, Created: ${row.created_at.value}`);
    });
    
    // Test aggregation query
    const aggregationQuery = `
      SELECT COUNT(*) as total, MAX(id) as max_id
      FROM \`${dataset.id}.${tableId}\`
    `;
    
    console.log(`\nExecuting aggregation query:\n${aggregationQuery}`);
    const [aggJob] = await bigquery.createQueryJob({ query: aggregationQuery });
    const [aggRows] = await aggJob.getQueryResults() as [AggregationRow[]];
    
    console.log('Aggregation results:');
    console.log(`  Total rows: ${aggRows[0].total}, Max ID: ${aggRows[0].max_id}`);
    
    console.log('\n✅ Successfully connected to BigQuery emulator using environment variable!');
    
  } catch (error) {
    const err = error as Error;
    console.error('\n❌ Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);