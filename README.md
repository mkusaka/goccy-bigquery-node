# BigQuery Emulator Node.js/TypeScript Examples

Production-ready examples for connecting to [goccy/bigquery-emulator](https://github.com/goccy/bigquery-emulator) from Node.js/TypeScript applications.

## 🎯 Purpose

This project demonstrates how to set up a local BigQuery development environment without connecting to Google Cloud. Since there's no official BigQuery emulator, we use the community-maintained `goccy/bigquery-emulator` and show how to connect from the official Node.js client (`@google-cloud/bigquery`).

## ✨ Features

- 🚀 **Two Connection Approaches**: Environment variable method and request override method
- 📝 **TypeScript Support**: Type-safe implementation with excellent DX
- 🔧 **tsx Execution**: Run TypeScript directly without compilation
- 🐳 **Docker Compose**: One-command emulator setup
- ⚡ **Authentication Bypass**: Skip authentication completely for local development
- 🎨 **Clean Code Examples**: Production-ready patterns and best practices

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- pnpm (recommended) or npm/yarn
- Docker & Docker Compose
- Basic TypeScript knowledge

## 📁 Project Structure

```
.
├── docker-compose.yml           # BigQuery emulator configuration
├── env-variable-example/        # Environment variable approach
│   ├── index.ts                # Main example with CRUD operations
│   ├── test.ts                  # Connection test
│   ├── package.json            # Dependencies and scripts
│   ├── tsconfig.json           # TypeScript configuration
│   └── .env.example            # Environment variables template
└── override-auth-example/       # Request override approach
    ├── index.ts                # Full override implementation
    ├── simple-index.ts         # Simplified working version
    ├── test.ts                  # Connection test
    ├── package.json            # Dependencies and scripts
    ├── tsconfig.json           # TypeScript configuration
    └── .env.example            # Environment variables template
```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/mkusaka/goccy-bigquery-node.git
cd goccy-bigquery-node
```

### 2. Start BigQuery Emulator

```bash
# Start the emulator in detached mode
docker-compose up -d

# Verify it's running (STATUS should be "Up")
docker-compose ps

# Test the emulator endpoint
curl http://localhost:9050/discovery/v1/apis/bigquery/v2/rest | jq .

# View logs if needed
docker-compose logs -f bigquery-emulator
```

The emulator exposes two ports:
- **9050**: REST API (for regular queries)
- **9060**: gRPC API (for BigQuery Storage API)

### 3. Run the Examples

#### Option 1: Environment Variable Approach (Recommended)

```bash
cd env-variable-example

# Install dependencies
pnpm install

# Run connection test (start here!)
pnpm test

# If successful, run the full example
pnpm start

# Additional commands
pnpm dev          # Watch mode for development
pnpm typecheck    # TypeScript type checking
```

Expected output:
```
✅ Connection successful!
Test value: 1
Current time: 2025-08-10T07:54:29.920855000Z
```

#### Option 2: Override Approach (Advanced)

```bash
cd override-auth-example

# Install dependencies
pnpm install

# Run simplified version (recommended for testing)
pnpm start:simple

# Run full implementation
pnpm start

# Run connection test
pnpm test
```

## 🔍 Technical Details

### Why Authentication Bypass is Necessary

The `@google-cloud/bigquery` client normally requires Google Cloud credentials. However, when connecting to a local emulator:

1. **Google Cloud authentication is not needed** (the emulator doesn't check credentials)
2. **Setting `BIGQUERY_EMULATOR_HOST` alone is insufficient** (the client still attempts authentication)
3. **A custom auth client is required** to completely bypass authentication

### Approach 1: Environment Variable Method

**Pros:**
- ✅ Simple and easy to understand
- ✅ Minimal code required
- ✅ Less impact on existing code
- ✅ Best for most use cases

**Cons:**
- ❌ Limited control over request details
- ❌ Cannot add custom request logging

**Implementation:**
```typescript
// 1. Clear authentication environment variables (important!)
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.GOOGLE_CLOUD_PROJECT;

// 2. Set emulator host
process.env.BIGQUERY_EMULATOR_HOST = 'http://127.0.0.1:9050';

// 3. Create dummy auth client
const customAuthClient = {
  request: async (config: any) => ({ data: {} }),
  getAccessToken: async () => ({ token: 'dummy-token' }),
  getProjectId: async () => 'test-project',
  getRequestHeaders: async () => ({}),
};

// 4. Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'test-project',
  apiEndpoint: 'localhost:9050',  // Note: no https://
  authClient: customAuthClient as any,
});
```

### Approach 2: Request Override Method

**Pros:**
- ✅ Full control over requests
- ✅ Can add custom logging
- ✅ Can modify request/response data
- ✅ Better for debugging

**Cons:**
- ❌ More complex implementation
- ❌ Requires understanding of internal APIs

**Implementation:**
```typescript
// Override makeAuthenticatedRequest
function createCustomAuthRequest(emulatorHost: string) {
  return async function makeAuthenticatedRequest(reqOpts: RequestOptions) {
    if (reqOpts.uri) {
      // Replace Google API URLs with emulator URL
      reqOpts.uri = reqOpts.uri
        .replace(/https:\/\/[^\/]+\.googleapis\.com/, emulatorHost)
        .replace(/http:\/\/[^\/]+\.googleapis\.com/, emulatorHost);
      
      // Convert HTTPS to HTTP for local emulator
      if (reqOpts.uri.startsWith('https://127.0.0.1') || 
          reqOpts.uri.startsWith('https://localhost')) {
        reqOpts.uri = reqOpts.uri.replace('https://', 'http://');
      }
    }
    
    // Custom logging
    console.log(`[Request] ${reqOpts.method} ${reqOpts.uri}`);
    
    // Execute request with fetch
    const response = await fetch(reqOpts.uri, {
      method: reqOpts.method || 'GET',
      headers: reqOpts.headers,
      body: reqOpts.body ? JSON.stringify(reqOpts.body) : undefined,
    });
    
    // ... handle response
  };
}
```

## 📊 What the Examples Do

Both examples demonstrate:

1. **Dataset Creation**: Create a test dataset with error handling
2. **Table Creation**: Define schema and create tables
3. **Data Insertion**: Insert sample records
4. **Query Execution**: Run SELECT queries with filters
5. **Aggregation**: Use COUNT, MAX, AVG functions
6. **Error Handling**: Gracefully handle existing resources

## 🛠️ Troubleshooting

### Connection Issues

#### Error: `invalid_grant`
**Solution**: The client is trying to authenticate. Make sure you:
1. Clear authentication environment variables
2. Set up the custom auth client properly
3. Use `apiEndpoint: 'localhost:9050'` (not `https://`)

#### Error: `ECONNREFUSED`
**Solution**: The emulator isn't running. Check:
```bash
docker-compose ps
docker-compose up -d
```

#### Error: `wrong version number`
**Solution**: The client is using HTTPS instead of HTTP. Ensure:
- Use `http://` in `BIGQUERY_EMULATOR_HOST`
- Set `apiEndpoint` without `https://`

### Docker Issues

```bash
# Check if Docker is running
docker --version
docker ps

# Restart the emulator
docker-compose down
docker-compose up -d

# Check emulator logs
docker-compose logs bigquery-emulator

# Test emulator directly
curl -X POST http://localhost:9050/bigquery/v2/projects/test-project/queries \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1 as test", "useLegacySql": false}'
```

### TypeScript Issues

```bash
# Ensure tsx is installed
pnpm ls tsx

# Check TypeScript version
pnpm ls typescript

# Run type checking
pnpm typecheck
```

## 📝 Available Scripts

Each example directory provides:

- `pnpm start` - Run the main example
- `pnpm test` - Run connection test
- `pnpm dev` - Watch mode for development
- `pnpm typecheck` - TypeScript type checking

Additional for override-auth-example:
- `pnpm start:simple` - Run simplified version

## 🎯 Best Practices

1. **Always clear authentication environment variables** when using the emulator
2. **Use `http://` not `https://`** for local emulator endpoints
3. **Handle existing resources gracefully** (datasets/tables may already exist)
4. **Start with the connection test** (`pnpm test`) before running full examples
5. **Use the environment variable approach** unless you need advanced features

## 🔗 References

- [goccy/bigquery-emulator](https://github.com/goccy/bigquery-emulator) - The emulator we're using
- [@google-cloud/bigquery](https://www.npmjs.com/package/@google-cloud/bigquery) - Official Node.js client
- [BigQuery Client Library Docs](https://cloud.google.com/nodejs/docs/reference/bigquery/latest) - API documentation
- [TypeScript BigQuery Examples](https://github.com/googleapis/nodejs-bigquery/tree/main/samples) - Official samples

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🙏 Acknowledgments

- [goccy](https://github.com/goccy) for creating the BigQuery emulator
- Google Cloud team for the official Node.js client
- Community members who have shared their solutions