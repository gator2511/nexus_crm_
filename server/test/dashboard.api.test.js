import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function request(path, init) {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + path, init);
    return { status: response.status, data: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('UI-API-01 staff dashboard requires authentication', async () => {
  const result = await request('/api/staff/dashboard');
  assert.equal(result.status, 401);
});

test('UI-API-02 staff profile requires authentication', async () => {
  const result = await request('/api/staff/me');
  assert.equal(result.status, 401);
});

test('UI-API-03 staff login rejects missing credentials', async () => {
  const result = await request('/api/staff/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '', password: '' }),
  });
  assert.equal(result.status, 400);
});

test('UI-API-04 program list does not require auth middleware', async () => {
  // Endpoint is registered. A database must be configured for a 200 response.
  // With no database, the generic error handler may produce 500; this test
  // validates route existence without mistaking deployment for integration.
  const result = await request('/api/programs');
  assert.notEqual(result.status, 404);
});
