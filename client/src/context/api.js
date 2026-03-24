const API = import.meta.env.VITE_API_URL || '';

export async function fetchProfile() {
  const res = await fetch(`${API}/api/profile`);
  return res.json();
}

export async function fetchWorks() {
  const res = await fetch(`${API}/api/works`);
  return res.json();
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

export async function updateProfile(profile) {
  const res = await fetch(`${API}/api/admin/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(profile)
  });
  if (!res.ok) throw new Error('更新失敗');
  return res.json();
}

export async function createWork(work) {
  const res = await fetch(`${API}/api/admin/works`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(work)
  });
  if (!res.ok) throw new Error('新增失敗');
  return res.json();
}

export async function updateWork(id, work) {
  const res = await fetch(`${API}/api/admin/works/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(work)
  });
  if (!res.ok) throw new Error('更新失敗');
  return res.json();
}

export async function deleteWork(id) {
  const res = await fetch(`${API}/api/admin/works/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!res.ok) throw new Error('刪除失敗');
  return res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API}/api/admin/password`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}
