let API_BASE = '';
const API_BASE_STORAGE_KEY = 'founduApiBase';

function getApiCandidates() {
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname;
  const savedBase = (localStorage.getItem(API_BASE_STORAGE_KEY) || '').trim();
  const urlParams = new URLSearchParams(window.location.search);
  const urlBase = (urlParams.get('apiBase') || urlParams.get('api') || '').trim().replace(/\/$/, '');
  const sameOriginBase = window.location.origin || '';
  const isLocalPage = host === 'localhost' || host === '127.0.0.1';
  const candidates = isLocalPage
    ? [urlBase, savedBase, sameOriginBase, `${protocol}//${host}:3000`, 'http://127.0.0.1:3000', 'http://localhost:3000']
    : [urlBase, savedBase, sameOriginBase];

  if (host) {
    candidates.push(`${protocol}//${host}:3000`);
  }

  return [...new Set(candidates.filter(Boolean))];
}

async function resolveApiBase() {
  const candidates = getApiCandidates();
  for (const base of candidates) {
    try {
      const response = await fetch(`${base}/api/health`, { credentials: 'include' });
      if (response.ok) {
        API_BASE = base;
        // Remember the working base so Admin.html/SuperAdmin.html reuse the
        // exact same origin (their cookies live there).
        localStorage.setItem(API_BASE_STORAGE_KEY, base);
        return;
      }
    } catch (_) {
      // try next
    }
  }
  throw new Error('Cannot connect to API server. Start backend on http://127.0.0.1:3000 (run: npm run start).');
}

function showError(message) {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = message;
  errorMsg.classList.add('active');
}

async function handleGoogleCredential(credential) {
  const response = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ credential })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Google sign-in failed');
  }

  if (payload.user?.isAdmin) {
    window.location.href = 'Admin.html';
    return;
  }

  showError(
    `Signed in as ${payload.user?.email || 'your Google account'}, but this account is not in the admin allowlist. ` +
      'Ask a super-admin to add you, then reload this page. You can also sign in with a different account below.'
  );
}

async function ensureAuthenticatedState() {
  const meResponse = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
  const mePayload = await meResponse.json().catch(() => ({}));

  if (mePayload.authenticated && mePayload.user?.isAdmin) {
    window.location.replace('Admin.html');
    return true;
  }

  return false;
}

function looksLikeGoogleClientId(clientId) {
  return /^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId);
}

async function waitForGoogleIdentity(timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (window.google?.accounts?.id) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return Boolean(window.google?.accounts?.id);
}

function describeGoogleScriptError(type) {
  switch (type) {
    case 'scriptFailedError':
    case 'scriptNotLoaded':
      return 'Google sign-in scripts failed to load. Check your internet connection or ad blocker.';
    case 'networkError':
    case 'network_error':
      return 'A network error interrupted Google sign-in. Check your connection and try again.';
    case 'popupClosedByUser':
    case 'popup_closed_by_user':
      return 'The Google sign-in window was closed before finishing. Please try again.';
    case 'browserBlockedPopup':
      return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
    default:
      return 'Google sign-in could not start.';
  }
}

async function setupGoogleSignIn() {
  const configResponse = await fetch(`${API_BASE}/api/auth/config`, { credentials: 'include' });
  const configPayload = await configResponse.json().catch(() => ({}));

  if (!configResponse.ok || !configPayload.googleEnabled || !configPayload.googleClientId) {
    throw new Error(
      'Google auth is not configured on the server. Add GOOGLE_CLIENT_ID to .env next to script.js and restart (npm run start).'
    );
  }

  if (!looksLikeGoogleClientId(configPayload.googleClientId)) {
    throw new Error(
      `The server GOOGLE_CLIENT_ID ("${configPayload.googleClientId}") does not look like a valid OAuth client ID ` +
        '(expected format: <number>-<hash>.apps.googleusercontent.com).'
    );
  }

  const googleReady = await waitForGoogleIdentity();
  if (!googleReady) {
    throw new Error(
      'Google Identity Services did not load. Check your internet connection, VPN, or content blockers, then reload.'
    );
  }

  window.google.accounts.id.initialize({
    client_id: configPayload.googleClientId,
    callback: async (response) => {
      const credential = response.credential || '';
      if (!credential) {
        showError('Google credential was not provided. Please try again.');
        return;
      }

      try {
        await handleGoogleCredential(credential);
      } catch (error) {
        showError(error.message || 'Google sign-in failed.');
      }
    },
    error_callback: (error) => {
      const detail = describeGoogleScriptError(error?.type);
      showError(
        `${detail} If it keeps failing, open https://console.cloud.google.com/apis/credentials and make sure ` +
          `"${window.location.origin}" is listed under "Authorized JavaScript origins" for this OAuth client ID.`
      );
    }
  });

  window.google.accounts.id.renderButton(document.getElementById('googleSignIn'), {
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    width: 300,
    text: 'signin_with'
  });
}

window.addEventListener('load', async () => {
  try {
    await resolveApiBase();
    const alreadyAuthedAdmin = await ensureAuthenticatedState();
    if (alreadyAuthedAdmin) {
      return;
    }

    await setupGoogleSignIn();
  } catch (error) {
    showError(error.message || 'Failed to initialize login');
  }
});
