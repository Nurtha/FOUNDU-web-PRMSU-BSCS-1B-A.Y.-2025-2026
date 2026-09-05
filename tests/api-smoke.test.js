const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ENABLE_GOOGLE_BYPASS_TESTS = process.env.TEST_GOOGLE_BYPASS === '1';

async function getCsrfSession() {
  const response = await fetch(`${BASE_URL}/api/csrf-token`);
  assert.equal(response.status, 200, 'csrf-token endpoint should return 200');

  const payload = await response.json();
  const setCookie = response.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];

  assert.ok(payload.token, 'csrf token should be returned');
  assert.ok(cookie.startsWith('foundu_csrf='), 'csrf cookie should be set');

  return { token: payload.token, cookie };
}

test('health endpoint returns ok', async () => {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
});

test('item validation rejects missing required fields', async () => {
  const csrf = await getCsrfSession();

  const response = await fetch(`${BASE_URL}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf.token,
      Cookie: csrf.cookie
    },
    body: JSON.stringify({
      type: 'lost'
    })
  });

  assert.equal(response.status, 400);

  const payload = await response.json();
  assert.ok(payload.error);
});

async function loginViaBypass(email) {
  const response = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      credential: `test:${email}`
    })
  });

  const payload = await response.json();
  assert.equal(response.status, 200, payload.error || 'expected successful test bypass login');

  const setCookie = response.headers.get('set-cookie') || '';
  const cookie = setCookie
    .split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('foundu_session=')) || '';

  assert.ok(cookie.includes('foundu_session='), 'session cookie should be set');
  return { payload, cookie: cookie.split(';')[0] };
}

test('auth me returns unauthenticated when no session', { skip: !ENABLE_GOOGLE_BYPASS_TESTS }, async () => {
  const response = await fetch(`${BASE_URL}/api/auth/me`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.authenticated, false);
});

test('non-admin google user can login but is denied admin routes', { skip: !ENABLE_GOOGLE_BYPASS_TESTS }, async () => {
  const { payload, cookie } = await loginViaBypass('nonadmin@example.com');
  assert.equal(payload.user.isAdmin, false);

  const response = await fetch(`${BASE_URL}/api/admin/items`, {
    headers: { Cookie: cookie }
  });
  assert.equal(response.status, 403);
});

test('super-admin can read allowlist endpoint', { skip: !ENABLE_GOOGLE_BYPASS_TESTS }, async () => {
  const { payload, cookie } = await loginViaBypass('athrun.sison7@gmail.com');
  assert.equal(payload.user.isSuperAdmin, true);

  const response = await fetch(`${BASE_URL}/api/admin/allowlist`, {
    headers: { Cookie: cookie }
  });
  assert.equal(response.status, 200);
});

test('auth config exposes google client id when set', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/config`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(typeof payload.googleEnabled, 'boolean');
  assert.equal(typeof payload.googleClientId, 'string');
});

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  return (response.headers.get('set-cookie') || '').split(/(?<!Expires=[A-Za-z]{3},) ,/);
}

test('same-origin login keeps SameSite=Lax cookie over http', { skip: !ENABLE_GOOGLE_BYPASS_TESTS }, async () => {
  const response = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'test:athrun.sison7@gmail.com' })
  });
  assert.equal(response.status, 200);

  const cookies = getSetCookies(response);
  const sessionCookie = cookies.find((entry) => entry.startsWith('foundu_session='));
  assert.ok(sessionCookie, 'session cookie should be set');
  assert.match(sessionCookie, /SameSite=Lax/);
  assert.doesNotMatch(sessionCookie, /SameSite=None/);
});

test('cross-origin https login gets SameSite=None; Secure cookies', { skip: !ENABLE_GOOGLE_BYPASS_TESTS }, async () => {
  const response = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://nurtha.example',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Host': 'api.nurtha.example'
    },
    body: JSON.stringify({ credential: 'test:athrun.sison7@gmail.com' })
  });
  assert.equal(response.status, 200);

  const cookies = getSetCookies(response);
  const sessionCookie = cookies.find((entry) => entry.startsWith('foundu_session='));
  assert.ok(sessionCookie, 'session cookie should be set');
  assert.match(sessionCookie, /SameSite=None/);
  assert.match(sessionCookie, /Secure/);

  const csrfCookie = cookies.find((entry) => entry.startsWith('foundu_csrf='));
  assert.ok(csrfCookie, 'csrf cookie should be set');
  assert.match(csrfCookie, /SameSite=None/);
  assert.match(csrfCookie, /Secure/);
});

test('csrf token endpoint issues cookie matching its session context', async () => {
  const response = await fetch(`${BASE_URL}/api/csrf-token`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.ok(payload.token, 'csrf token should be returned');
});
