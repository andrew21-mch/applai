const apiUrlInput = document.getElementById('apiUrl');
const apiSecretInput = document.getElementById('apiSecret');
const statusEl = document.getElementById('status');

chrome.storage.sync.get(['apiUrl', 'apiSecret'], (data) => {
  if (data.apiUrl) apiUrlInput.value = data.apiUrl;
  if (data.apiSecret) apiSecretInput.value = data.apiSecret;
});

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set({
    apiUrl: apiUrlInput.value.replace(/\/$/, ''),
    apiSecret: apiSecretInput.value,
  }, () => {
    statusEl.textContent = 'Settings saved.';
  });
});

document.getElementById('fill').addEventListener('click', async () => {
  statusEl.textContent = 'Filling…';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusEl.textContent = 'No active tab.';
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: 'fill' }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = 'Reload the job page and try again.';
      return;
    }
    statusEl.textContent = response?.message ?? 'Done.';
  });
});
