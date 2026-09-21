// Run the commerce tests in a newly created, isolated PostgreSQL database.
// No production or development application rows are used by the tests.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const databaseName = `ontor_payment_test_${randomBytes(6).toString('hex')}`;
const configured = new URL(process.env.DATABASE_URL);
const testUrl = new URL(configured);
testUrl.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: configured.toString(), connectionTimeoutMillis: 5000 });
const env = {
  ...process.env, DATABASE_URL: testUrl.toString(), NODE_ENV: 'test', PAYMENT_PROVIDER: 'mock',
  GAME_TOPUP_PROVIDER: 'mock', MOCK_GAME_API_RESULT: 'success', MOCK_GAME_API_DELAY_MS: '0',
  GIFT_CARD_RESERVATION_MINUTES: '5', GIFT_CARD_RESERVATION_SWEEP_MS: '10000',
  REDIS_URL: '', LOG_LEVEL: 'silent', RUN_GIFT_CARD_INTEGRATION_TESTS: 'true', RUN_GAME_TOPUP_INTEGRATION_TESTS: 'true',
  RUN_USER_INTEGRATION_TESTS: 'true',
};
(async () => {
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const schemaCommand = process.env.TEST_SCHEMA_MODE === 'migrate'
      ? ['migrate', 'deploy']
      : ['db', 'push'];
    const setup = spawnSync(path.resolve('node_modules/.bin/prisma'), schemaCommand, { env, encoding: 'utf8', timeout: 60000 });
    if (setup.status !== 0) throw new Error(`Test database schema setup failed: ${setup.stderr}`);
    let failures = 0;
    let passed = 0;
    for (const moduleName of ['users', 'gift-card', 'game-top-up', 'payment']) {
      const directory = `dist/modules/${moduleName}/tests`;
      for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.test.js')).sort()) {
        // Direct execution also reports individual node:test cases on Node 22.
        const result = spawnSync(process.execPath, [path.join(directory, filename)], { env, encoding: 'utf8', timeout: 60000 });
        const output = `${result.stdout || ''}${result.stderr || ''}`;
        const count = Number(output.match(/# pass (\d+)/)?.[1] || 0);
        passed += count;
        if (result.status !== 0 || count === 0) {
          failures++;
          console.log(`FAIL ${filename}\n${output}`);
          if (result.error) console.log(result.error.code);
        } else console.log(`PASS ${filename}: ${count} cases`);
      }
    }
    console.log(JSON.stringify({ passed, failedFiles: failures }));
    if (failures) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (created) {
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      console.log('Removed isolated test database.');
    }
    await admin.end();
  }
})();
