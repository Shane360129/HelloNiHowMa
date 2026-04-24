const API = import.meta.env.VITE_API_URL || '';

async function handle(res, errMsg) {
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* empty */ }
    throw new Error(body.error || errMsg);
  }
  return res.json();
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

/* Public */
export async function fetchProfile() {
  const res = await fetch(`${API}/api/profile`);
  return res.json();
}
export async function fetchWorks() {
  const res = await fetch(`${API}/api/works`);
  return res.json();
}
export async function fetchServices() {
  const res = await fetch(`${API}/api/services`);
  return res.json();
}
export async function fetchNews() {
  const res = await fetch(`${API}/api/news`);
  return res.json();
}
export async function fetchPublicSettings() {
  const res = await fetch(`${API}/api/public-settings`);
  return res.json();
}
export async function createBooking(booking) {
  const res = await fetch(`${API}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking)
  });
  return handle(res, '預約送出失敗，請稍後再試');
}
export async function fetchMonthAvailability(year, month, service) {
  const qs = new URLSearchParams({ year, month });
  if (service) qs.set('service', service);
  const res = await fetch(`${API}/api/availability/month?${qs.toString()}`);
  return handle(res, '載入月曆失敗');
}
export async function fetchDayAvailability(date, service) {
  const qs = new URLSearchParams({ date });
  if (service) qs.set('service', service);
  const res = await fetch(`${API}/api/availability/day?${qs.toString()}`);
  return handle(res, '載入時段失敗');
}

/* Admin: Profile */
export async function updateProfile(profile) {
  const res = await fetch(`${API}/api/admin/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(profile)
  });
  return handle(res, '更新失敗');
}

/* Admin: Works */
export async function createWork(work) {
  const res = await fetch(`${API}/api/admin/works`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(work)
  });
  return handle(res, '新增失敗');
}
export async function updateWork(id, work) {
  const res = await fetch(`${API}/api/admin/works/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(work)
  });
  return handle(res, '更新失敗');
}
export async function deleteWork(id) {
  const res = await fetch(`${API}/api/admin/works/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return handle(res, '刪除失敗');
}

/* Admin: Services */
export async function createService(data) {
  const res = await fetch(`${API}/api/admin/services`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return handle(res, '新增失敗');
}
export async function updateService(id, data) {
  const res = await fetch(`${API}/api/admin/services/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return handle(res, '更新失敗');
}
export async function deleteService(id) {
  const res = await fetch(`${API}/api/admin/services/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return handle(res, '刪除失敗');
}

/* Admin: News */
export async function fetchAdminNews() {
  const res = await fetch(`${API}/api/admin/news`, { headers: authHeaders() });
  return handle(res, '載入失敗');
}
export async function createNews(data) {
  const res = await fetch(`${API}/api/admin/news`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return handle(res, '新增失敗');
}
export async function updateNews(id, data) {
  const res = await fetch(`${API}/api/admin/news/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return handle(res, '更新失敗');
}
export async function deleteNews(id) {
  const res = await fetch(`${API}/api/admin/news/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return handle(res, '刪除失敗');
}

/* Admin: Bookings */
export async function fetchBookings(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API}/api/admin/bookings${qs}`, {
    headers: authHeaders()
  });
  return handle(res, '載入失敗');
}
export async function updateBooking(id, data) {
  const res = await fetch(`${API}/api/admin/bookings/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return handle(res, '更新失敗');
}
export async function deleteBooking(id) {
  const res = await fetch(`${API}/api/admin/bookings/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return handle(res, '刪除失敗');
}

/* Admin: Settings */
export async function fetchSettings() {
  const res = await fetch(`${API}/api/admin/settings`, {
    headers: authHeaders()
  });
  return handle(res, '載入失敗');
}
export async function updateSettings(data) {
  const res = await fetch(`${API}/api/admin/settings`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return handle(res, '儲存失敗');
}
export async function sendLineTest() {
  const res = await fetch(`${API}/api/admin/line/test`, {
    method: 'POST',
    headers: authHeaders()
  });
  return handle(res, '測試失敗');
}

/* Admin: Password */
export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API}/api/admin/password`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword })
  });
  return handle(res, '更新失敗');
}
