const API = import.meta.env.VITE_API_URL || '';

async function handle(res, errMsg) {
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* empty */ }
    const err = new Error(body.error || errMsg);
    err.code = body.code;
    err.status = res.status;
    throw err;
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

function customerHeaders() {
  const token = localStorage.getItem('customer_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
    headers: customerHeaders(),
    body: JSON.stringify(booking)
  });
  return handle(res, '預約送出失敗，請稍後再試');
}

/* Customer: My Bookings */
export async function fetchMyBookings() {
  const res = await fetch(`${API}/api/me/bookings`, { headers: customerHeaders() });
  return handle(res, '載入失敗');
}
export async function cancelMyBooking(id) {
  const res = await fetch(`${API}/api/me/bookings/${id}/cancel`, {
    method: 'PATCH',
    headers: customerHeaders()
  });
  return handle(res, '取消失敗');
}
export async function updateMyProfile(payload) {
  const res = await fetch(`${API}/api/me/profile`, {
    method: 'PATCH',
    headers: customerHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '更新失敗');
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
export async function createAdminBooking(payload) {
  const res = await fetch(`${API}/api/admin/bookings`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '建立失敗');
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

/* Admin: Users (LINE 客戶 + 走入客戶) */
export async function fetchAdminUsers(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, v); });
  const res = await fetch(`${API}/api/admin/users${qs.toString() ? `?${qs}` : ''}`, {
    headers: authHeaders()
  });
  return handle(res, '載入用戶失敗');
}
export async function fetchAdminUser(id) {
  const res = await fetch(`${API}/api/admin/users/${id}`, { headers: authHeaders() });
  return handle(res, '載入用戶失敗');
}
export async function lookupUserByPhone(phone) {
  const res = await fetch(`${API}/api/admin/users/lookup?phone=${encodeURIComponent(phone)}`, {
    headers: authHeaders()
  });
  return handle(res, '查詢失敗');
}
export async function updateAdminUser(id, payload) {
  const res = await fetch(`${API}/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '更新失敗');
}
export async function createAdminUser(payload) {
  const res = await fetch(`${API}/api/admin/users`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '建立失敗');
}
export async function deleteAdminUser(id) {
  const res = await fetch(`${API}/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return handle(res, '刪除失敗');
}

/* Admin: Message Templates */
export async function fetchMessageTemplates() {
  const res = await fetch(`${API}/api/admin/message-templates`, { headers: authHeaders() });
  return handle(res, '載入模板失敗');
}
export async function fetchMessageTemplate(key) {
  const res = await fetch(`${API}/api/admin/message-templates/${key}`, { headers: authHeaders() });
  return handle(res, '載入模板失敗');
}
export async function updateMessageTemplate(key, payload) {
  const res = await fetch(`${API}/api/admin/message-templates/${key}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '更新失敗');
}
export async function previewMessageTemplate(key, payload) {
  const res = await fetch(`${API}/api/admin/message-templates/${key}/preview`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '預覽失敗');
}
export async function testSendMessageTemplate(key, payload) {
  const res = await fetch(`${API}/api/admin/message-templates/${key}/test-send`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '測試發送失敗');
}

/* Admin: Broadcasts */
export async function fetchBroadcasts() {
  const res = await fetch(`${API}/api/admin/broadcasts`, { headers: authHeaders() });
  return handle(res, '載入失敗');
}
export async function createBroadcast(payload) {
  const res = await fetch(`${API}/api/admin/broadcasts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return handle(res, '推播失敗');
}
export async function deleteBroadcast(id) {
  const res = await fetch(`${API}/api/admin/broadcasts/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return handle(res, '刪除失敗');
}
export async function fetchLineQuota() {
  const res = await fetch(`${API}/api/admin/line/quota`, { headers: authHeaders() });
  return handle(res, '查詢配額失敗');
}
export async function fetchAdminUserTags() {
  const res = await fetch(`${API}/api/admin/user-tags`, { headers: authHeaders() });
  return handle(res, '載入標籤失敗');
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
