// Simple test to verify BigQuery emulator connection with auth override
import { BigQuery } from '@google-cloud/bigquery';
import fetch, { RequestInit } from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

const EMULATOR_HOST = process.env.EMULATOR_HOST || 'http://127.0.0.1:9050';
const PROJECT_ID = 'test-project';

interface RequestOptions {
  uri?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  callback?: (error: Error | null, body?: any, response?: any) => void;
}

interface TestRow {
  message: string;
  answer: number;
}

// Simplified custom auth request for testing
function createCustomAuthRequest(emulatorHost: string) {
  return async function makeAuthenticatedRequest(reqOpts: RequestOptions): Promise<any> {
    if (reqOpts.uri) {
      // Debug log original URI
      console.log('[DEBUG] Original URI:', reqOpts.uri);
      
      // Replace both https and http googleapis.com URLs
      reqOpts.uri = reqOpts.uri
        .replace(/https:\/\/[^\/]+\.googleapis\.com/, emulatorHost)
        .replace(/http:\/\/[^\/]+\.googleapis\.com/, emulatorHost);
      
      // Ensure we're using HTTP not HTTPS for local emulator
      if (reqOpts.uri.startsWith('https://127.0.0.1') || reqOpts.uri.startsWith('https://localhost')) {
        reqOpts.uri = reqOpts.uri.replace('https://', 'http://');
      }
      
      console.log('[DEBUG] Modified URI:', reqOpts.uri);
    }
    
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

    const response = await fetch(reqOpts.uri!, fetchOptions);
    
    const responseText = await response.text();
    let responseBody: any;
    
    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      responseBody = responseText;
    }
    
    const result = {
      statusCode: response.status,
      body: responseBody,
      headers: Object.fromEntries(response.headers),
    };
    
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
  };
}

async function testConnection(): Promise<void> {
  console.log('Testing BigQuery emulator connection with auth override...');
  console.log(`Emulator host: ${EMULATOR_HOST}\n`);
  
  const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    apiEndpoint: EMULATOR_HOST.replace('http://', '').replace('https://', ''),
    authClient: {
      request: createCustomAuthRequest(EMULATOR_HOST),
      getAccessToken: () => Promise.resolve({ token: 'dummy-token' }),
      getProjectId: () => Promise.resolve(PROJECT_ID),
      getRequestHeaders: () => Promise.resolve({}),
    } as any,
  });
  
  (bigquery as any).makeAuthenticatedRequest = createCustomAuthRequest(EMULATOR_HOST);

  try {
    // Simple query to test connection
    const query = 'SELECT "Hello from override!" AS message, 42 AS answer';
    
    console.log('Executing test query:', query);
    const [job] = await bigquery.createQueryJob({ query });
    const [rows] = await job.getQueryResults() as [TestRow[]];
    
    if (rows && rows.length > 0) {
      console.log('\n✅ Connection successful!');
      console.log('Message:', rows[0].message);
      console.log('Answer:', rows[0].answer);
      return;
    } else {
      throw new Error('No results returned from test query');
    }
    
  } catch (error) {
    const err = error as Error;
    console.error('\n❌ Connection failed!');
    console.error('Error:', err.message);
    
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure Docker is running');
    console.log('2. Check if the emulator is running: docker-compose ps');
    console.log('3. Verify port 9050 is accessible: curl http://localhost:9050/discovery/v1/apis/bigquery/v2/rest');
    console.log('4. Check if node-fetch is installed: npm ls node-fetch');
    
    process.exit(1);
  }
}

testConnection();