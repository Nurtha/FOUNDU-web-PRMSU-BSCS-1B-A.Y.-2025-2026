let API_BASE = '';
let pendingCredential = null;

function getApiCandidates() {
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname;
  const sameOriginBase = window.location.origin || '';
  const isLocalPage = host === 'localhost' || host === '127.0.0.1';
  const candidates = isLocalPage
    ? [sameOriginBase, `${protocol}//${host}:3000`, 'http://127.0.0.1:3000', 'http://localhost:3000', '']
    : [sameOriginBase, ''];

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
        return;
      }
    } catch (_) {
      // try next
    }
  }
  throw new Error('Cannot connect to API server. Start backend on http://127.0.0.1:3000.');
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

  const openAdminBtn = document.getElementById('goAdminBtn');
  openAdminBtn.style.display = 'inline-flex';
  showError('Signed in successfully, but this account is not in the admin allowlist.');
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

async function setupGoogleSignIn() {
  const configResponse = await fetch(`${API_BASE}/api/auth/config`, { credentials: 'include' });
  const configPayload = await configResponse.json().catch(() => ({}));

  if (!configResponse.ok || !configPayload.googleEnabled || !configPayload.googleClientId) {
    throw new Error('Google auth is not configured on the server. Set GOOGLE_CLIENT_ID first.');
  }

  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    throw new Error('Google Identity Services did not load. Check your internet connection.');
  }

  window.google.accounts.id.initialize({
    client_id: configPayload.googleClientId,
    callback: async (response) => {
      pendingCredential = response.credential || '';
      if (!pendingCredential) {
        showError('Google credential was not provided. Please try again.');
        return;
      }

      try {
        await handleGoogleCredential(pendingCredential);
      } catch (error) {
        showError(error.message || 'Google sign-in failed.');
      }
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
  const openAdminBtn = document.getElementById('goAdminBtn');
  openAdminBtn.addEventListener('click', () => {
    window.location.href = 'Admin.html';
  });

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
