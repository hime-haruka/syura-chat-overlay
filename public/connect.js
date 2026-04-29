async function post(path) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}
async function refreshStatus() {
  const res = await fetch(`/api/connect/${window.CLIENT_ID}/status`);
  const data = await res.json();
  document.querySelector('#status').textContent = JSON.stringify(data, null, 2);
  const badge = document.querySelector('.status');
  if (badge) { badge.textContent = data.status; badge.className = `status ${data.status}`; }
}

document.addEventListener('click', async (e) => {
  const action = e.target && e.target.dataset && e.target.dataset.action;
  if (!action) return;
  try {
    if (action === 'start') await post(`/api/connect/${window.CLIENT_ID}/start`);
    if (action === 'test') await post(`/api/connect/${window.CLIENT_ID}/test`);
    if (action === 'logout') {
      if (!confirm('연결을 해제하고 저장된 토큰을 삭제할까요?')) return;
      await post(`/api/connect/${window.CLIENT_ID}/logout`);
    }
    await refreshStatus();
  } catch (err) {
    alert(`실패: ${err.message}`);
    await refreshStatus();
  }
});
setInterval(refreshStatus, 5000);
