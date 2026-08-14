let API_BASE = '';
let CSRF_TOKEN = '';

function normalizeEmails(text) {
  return [...new Set(
    text
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function setMessage(text, isError = false) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.style.color = isError ? '#dc2626' : '#0f766e';
}

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
  for (const base of getApiCandidates()) {
    try {
      const health = await fetch(`${base}/api/health`, { credentials: 'include' });
      if (health.ok) {
        API_BASE = base;
        return;
      }
    } catch (_) {
      // continue
    }
  }

  throw new Error('Cannot connect to API server');
}

async function fetchCsrfToken() {
  const response = await fetch(`${API_BASE}/api/csrf-token`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to get CSRF token');
  }
  const payload = await response.json();
  CSRF_TOKEN = payload.token || '';
}

async function fetchCurrentUser() {
  const response = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to read user session');
  }

  const payload = await response.json();
  return payload.user || null;
}

async function loadAllowlist() {
  const response = await fetch(`${API_BASE}/api/admin/allowlist`, { credentials: 'include' });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Failed to load allowlist (${response.status})`);
  }

  const admins = payload.data?.admins || [];
  const superAdmins = payload.data?.superAdmins || [];
  document.getElementById('adminsInput').value = admins.join('\n');
  document.getElementById('superAdminsInput').value = superAdmins.join('\n');
}

async function saveAllowlist() {
  const admins = normalizeEmails(document.getElementById('adminsInput').value);
  const superAdmins = normalizeEmails(document.getElementById('superAdminsInput').value);

  const response = await fetch(`${API_BASE}/api/admin/allowlist`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': CSRF_TOKEN
    },
    credentials: 'include',
    body: JSON.stringify({ admins, superAdmins })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Failed to save allowlist (${response.status})`);
  }

  document.getElementById('adminsInput').value = (payload.data?.admins || []).join('\n');
  document.getElementById('superAdminsInput').value = (payload.data?.superAdmins || []).join('\n');
}

window.addEventListener('load', async () => {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'Admin.html';
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (_) {
      // ignore
    }
    window.location.replace('Login.html');
  });

  document.getElementById('reloadBtn').addEventListener('click', async () => {
    try {
      await loadAllowlist();
      setMessage('Allowlist reloaded.');
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    try {
      await fetchCsrfToken();
      await saveAllowlist();
      setMessage('Allowlist updated successfully.');
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  try {
    await resolveApiBase();
    const user = await fetchCurrentUser();
    if (!user) {
      window.location.replace('Login.html');
      return;
    }

    if (!user.isSuperAdmin) {
      setMessage('Super-admin access denied for this account.', true);
      setTimeout(() => window.location.replace('Admin.html'), 1200);
      return;
    }

    document.getElementById('userInfo').textContent = `Signed in as ${user.email}`;
    await fetchCsrfToken();
    await loadAllowlist();
  } catch (error) {
    setMessage(error.message, true);
  }
});
