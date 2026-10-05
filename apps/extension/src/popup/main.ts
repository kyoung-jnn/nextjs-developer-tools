import { extensionVersion } from '../shared/settings';
import { isDetection } from '../shared/validate';
import { popupContent } from './content';
import './style.css';

function render(detection: Parameters<typeof popupContent>[0]): void {
  const content = popupContent(detection);
  document.body.dataset.tone = content.tone;
  const title = document.getElementById('title');
  const body = document.getElementById('body');
  const details = document.getElementById('details');
  if (!title || !body || !details) return;
  title.textContent = content.title;
  body.textContent = content.body;
  if (detection?.mode === 'development' && detection.router === 'app') {
    const text = body.lastChild;
    if (text) {
      text.textContent = content.body.slice(0, -'Logs.'.length);
      const label = document.createElement('strong');
      label.textContent = 'Logs';
      body.append(label, '.');
    }
  }
  details.replaceChildren();
  for (const [label, value] of content.details) {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    details.append(term, description);
  }
}

async function load(): Promise<void> {
  const override = new URLSearchParams(location.search).get('tabId');
  const tabId =
    override !== null && /^\d+$/.test(override)
      ? Number(override)
      : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (tabId === undefined || !Number.isSafeInteger(tabId)) return;
  const detection: unknown = await chrome.runtime.sendMessage({ type: 'get-detection', tabId });
  render(isDetection(detection) ? detection : null);
}
render(null);
void load().catch(() => {});

const version = document.getElementById('version');
const current = extensionVersion();
if (version && current !== 'Preview') version.textContent = `v${current}`;

document.getElementById('settings')?.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage().catch(() => {});
});
