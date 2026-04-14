const ADMIN_ACCESS_KEY = 'founduAdminAccessGranted';
const ADMIN_ACCESS_TS_KEY = 'founduAdminAccessTimestamp';
const ADMIN_ACCESS_DURATION_MS = 8 * 60 * 60 * 1000;

function setAdminAccessSession() {
  const now = Date.now();
  sessionStorage.setItem(ADMIN_ACCESS_KEY, '1');
  localStorage.setItem(ADMIN_ACCESS_TS_KEY, String(now));
}

function hasActiveAdminAccess() {
  const granted = sessionStorage.getItem(ADMIN_ACCESS_KEY) === '1';
  const timestamp = Number(localStorage.getItem(ADMIN_ACCESS_TS_KEY) || '0');
  if (!granted || !Number.isFinite(timestamp)) {
    return false;
  }

  return (Date.now() - timestamp) <= ADMIN_ACCESS_DURATION_MS;
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  if (hasActiveAdminAccess()) {
    window.location.replace('Admin.html');
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const schoolId = document.getElementById('schoolId').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');

    const isValidLogin =
      (schoolId === 'yearnerngtaon_2026' && password === 'SABYAEMAMLAA')
      || (schoolId === 'Nurtha' && password === 'ankenosn');

    if (isValidLogin) {
      errorMsg.classList.remove('active');
      setAdminAccessSession();
      alert('Login successful! Redirecting...');
      window.location.href = 'Admin.html';
      return;
    }

    errorMsg.textContent = 'Invalid School ID or Password.';
    errorMsg.classList.add('active');
    setTimeout(() => {
      errorMsg.classList.remove('active');
    }, 4000);
  });
}