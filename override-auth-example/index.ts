// BigQuery emulator connection by overriding makeAuthenticatedRequest
import { BigQuery } from '@google-cloud/bigquery';
import fetch, { RequestInit } from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const EMULATOR_HOST = process.env.EMULATOR_HOST || 'http://127.0.0.1:9050';
const PROJECT_ID = 'test-project';

// Type definitions for the request options
interface RequestOptions {
  uri?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  callback?: (error: Error | null, body?: any, response?: any) => void;
}

interface UserRow {
  user_id: number;
  username: string;
  email: string | null;
  age: number | null;
  is_active: boolean;
}

interface StatsRow {
  total_users: number;
  unique_emails: number;
  avg_age: number | null;
  active_users: number;
}

/**
 * Custom authenticated request function that redirects to the emulator
 * This bypasses the normal Google Cloud authentication
 */
function createCustomAuthRequest(emulatorHost: string) {
  return async function makeAuthenticatedRequest(reqOpts: RequestOptions): Promise<any> {
    // Redirect the request to the emulator
    if (reqOpts.uri) {
      // Replace the Google API URL with the emulator URL
      reqOpts.uri = reqOpts.uri
        .replace(/https:\/\/[^\/]+\.googleapis\.com/, emulatorHost)
        .replace(/http:\/\/[^\/]+\.googleapis\.com/, emulatorHost);
      
      // Ensure we're using HTTP not HTTPS for local emulator
      if (reqOpts.uri.startsWith('https://127.0.0.1') || reqOpts.uri.startsWith('https://localhost')) {
        reqOpts.uri = reqOpts.uri.replace('https://', 'http://');
      }
    }
    
    // Log the request for debugging
    console.log(`[Request] ${reqOpts.method || 'GET'} ${reqOpts.uri}`);
    
    try {
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: reqOpts.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...reqOpts.headers,
        },
      };

      if (reqOpts.body) {
        fetchOptions.body = JSON.stringify(reqOpts.body);
      }

      // Make the HTTP request using fetch
      const response = await fetch(reqOpts.uri!, fetchOptions);
      
      const responseText = await response.text();
      let responseBody: any;
      
      try {
        responseBody = JSON.parse(responseText);
      } catch (e) {
        responseBody = responseText;
      }
      
      // Return in the expected format
      const result = {
        statusCode: response.status,
        body: responseBody,
        headers: Object.fromEntries(response.headers),
      };
      
      // Call the callback if provided (for backward compatibility)
      if (reqOpts.callback) {
        if (response.ok) {
          reqOpts.callback(null, responseBody, result);
        } else {
          const error = new Error(`Request failed with status ${response.status}`);
          (error as any).response = result;
          reqOpts.callback(error, null, result);
        }
      }
      
      return result;
      
    } catch (error) {
      const err = error as Error;
      console.error(`[Request Error] ${err.message}`);
      if (reqOpts.callback) {
        reqOpts.callback(err);
      }
      throw error;
    }
  };
}

async function main(): Promise<void> {
  console.log('Connecting to BigQuery emulator by overriding makeAuthenticatedRequest...');
  console.log(`Emulator host: ${EMULATOR_HOST}`);
  console.log(`Project ID: ${PROJECT_ID}\n`);
  
  // Initialize BigQuery client with custom configuration
  const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    apiEndpoint: EMULATOR_HOST.replace('http://', '').replace('https://', ''),
    // Override the authentication mechanism
    authClient: {
      request: createCustomAuthRequest(EMULATOR_HOST),
      getAccessToken: () => Promise.resolve({ token: 'dummy-token' }),
      getProjectId: () => Promise.resolve(PROJECT_ID),
      getRequestHeaders: () => Promise.resolve({}),
    } as any,
  });
  
  // Override makeAuthenticatedRequest on the client instance
  (bigquery as any).makeAuthenticatedRequest = createCustomAuthRequest(EMULATOR_HOST);
  
  try {
    // Create a test dataset
    const datasetId = 'override_test_dataset';
    
    console.log(`Creating dataset: ${datasetId}`);
    const [dataset] = await bigquery.createDataset(datasetId).catch((err: any) => {
      if (err.code === 409) {
        console.log(`Dataset ${datasetId} already exists`);
        return [bigquery.dataset(datasetId)];
      }
      throw err;
    });
    
    // Create a test table with more complex schema
    const tableId = 'users_table';
    const schema = [
      { name: 'user_id', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'username', type: 'STRING', mode: 'REQUIRED' },
      { name: 'email', type: 'STRING', mode: 'NULLABLE' },
      { name: 'age', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'is_active', type: 'BOOLEAN', mode: 'REQUIRED' },
      { name: 'registration_date', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'metadata', type: 'JSON', mode: 'NULLABLE' },
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
      {
        user_id: 1,
        username: 'alice_wonder',
        email: 'alice@example.com',
        age: 28,
        is_active: true,
        registration_date: new Date('2023-01-15').toISOString(),
        metadata: JSON.stringify({ role: 'admin', team: 'engineering' }),
      },
      {
        user_id: 2,
        username: 'bob_builder',
        email: 'bob@example.com',
        age: 35,
        is_active: true,
        registration_date: new Date('2023-02-20').toISOString(),
        metadata: JSON.stringify({ role: 'developer', team: 'platform' }),
      },
      {
        user_id: 3,
        username: 'charlie_chocolate',
        email: null,
        age: null,
        is_active: false,
        registration_date: new Date('2023-03-10').toISOString(),
        metadata: null,
      },
    ];
    
    console.log(`\nInserting ${rows.length} rows into ${tableId}`);
    await table.insert(rows);
    
    // Query the data with WHERE clause
    const query = `
      SELECT user_id, username, email, age, is_active
      FROM \`${dataset.id}.${tableId}\`
      WHERE is_active = true
      ORDER BY user_id
    `;
    
    console.log(`\nExecuting filtered query:\n${query}`);
    const [job] = await bigquery.createQueryJob({ query });
    const [queryRows] = await job.getQueryResults() as [UserRow[]];
    
    console.log('\nActive users:');
    queryRows.forEach((row: UserRow) => {
      console.log(`  ID: ${row.user_id}, Username: ${row.username}, Email: ${row.email || 'N/A'}, Age: ${row.age || 'N/A'}`);
    });
    
    // Complex aggregation query
    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(DISTINCT email) as unique_emails,
        AVG(age) as avg_age,
        SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_users
      FROM \`${dataset.id}.${tableId}\`
    `;
    
    console.log(`\nExecuting statistics query:\n${statsQuery}`);
    const [statsJob] = await bigquery.createQueryJob({ query: statsQuery });
    const [statsRows] = await statsJob.getQueryResults() as [StatsRow[]];
    
    console.log('\nUser statistics:');
    const stats = statsRows[0];
    console.log(`  Total users: ${stats.total_users}`);
    console.log(`  Unique emails: ${stats.unique_emails}`);
    console.log(`  Average age: ${stats.avg_age ? stats.avg_age.toFixed(1) : 'N/A'}`);
    console.log(`  Active users: ${stats.active_users}`);
    
    console.log('\n✅ Successfully connected to BigQuery emulator by overriding makeAuthenticatedRequest!');
    
  } catch (error) {
    const err = error as Error;
    console.error('\n❌ Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);