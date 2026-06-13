/** ApplAI Chrome extension — fills forms on sites you're already logged into */

const LABEL_RULES = [
  { re: /email|e-mail/i, key: 'email' },
  { re: /phone|mobile|tel/i, key: 'phone' },
  { re: /first.?name|given/i, key: 'firstName' },
  { re: /last.?name|family|surname/i, key: 'lastName' },
  { re: /full.?name|^name$/i, key: 'name' },
  { re: /location|city|address/i, key: 'location' },
  { re: /linkedin/i, key: 'linkedin' },
  { re: /cover.?letter|motivation|why.*role/i, key: 'coverHint' },
];

function textForInput(input, profile) {
  const label = findLabel(input);
  const hay = `${label} ${input.name} ${input.id} ${input.placeholder} ${input.getAttribute('aria-label') ?? ''}`;
  for (const rule of LABEL_RULES) {
    if (!rule.re.test(hay)) continue;
    if (rule.key === 'firstName') return profile.name.split(/\s+/)[0] ?? '';
    if (rule.key === 'lastName') return profile.name.split(/\s+/).slice(1).join(' ');
    if (rule.key === 'coverHint') return profile.coverHint ?? '';
    return profile[rule.key] ?? '';
  }
  return '';
}

function findLabel(input) {
  if (input.id) {
    const l = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (l?.textContent) return l.textContent.trim();
  }
  const parent = input.closest('label');
  return parent?.textContent?.trim() ?? '';
}

function setValue(el, value) {
  if (!value?.trim()) return false;
  if (el.tagName === 'SELECT') {
    for (const opt of el.options) {
      if (opt.text.toLowerCase().includes(value.toLowerCase().slice(0, 20))) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

async function fetchProfile(apiUrl, apiSecret) {
  const headers = { Accept: 'application/json' };
  if (apiSecret) headers['x-api-secret'] = apiSecret;
  const res = await fetch(`${apiUrl}/api/profile`, { headers });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const p = json.data;
  return {
    name: p.name ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    location: p.location ?? '',
    linkedin: '',
    coverHint: '',
  };
}

async function fillPage() {
  const { apiUrl = 'http://localhost:4000', apiSecret = '' } = await chrome.storage.sync.get([
    'apiUrl',
    'apiSecret',
  ]);

  const profile = await fetchProfile(apiUrl, apiSecret);
  let filled = 0;

  const fields = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, select',
  );

  for (const el of fields) {
    if (!(el instanceof HTMLElement) || el.offsetParent === null) continue;
    const value = textForInput(el, profile);
    if (setValue(el, value)) filled++;
  }

  return { message: `Filled ${filled} field(s) from ApplAI profile.` };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'fill') {
    fillPage()
      .then(sendResponse)
      .catch((err) => sendResponse({ message: err.message ?? 'Fill failed' }));
    return true;
  }
});
