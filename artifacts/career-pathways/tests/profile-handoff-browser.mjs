import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Isolated local Chrome profile. No real user's browser data or credentials.
export async function withProfileBrowser(run) {
  const dir = await mkdtemp('/tmp/futurepath-handoff-chrome-');
  const port = 9468;
  const chrome = spawn('/repl/tools/bin/chromium', ['--headless', '--no-sandbox',
    '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  let socket;
  try {
    let target;
    for (let i = 0; i < 80; i++) {
      try {
        target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
        break;
      } catch { await sleep(100); }
    }
    if (!target) throw new Error('Local Chromium did not start');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve));
    let id = 0;
    const pending = new Map();
    const errors = [];
    const requests = [];
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      socket.send(JSON.stringify({ id: next, method, params }));
    });
    socket.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.id) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (p) m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
      if (m.method === 'Page.javascriptDialogOpening') void cdp('Page.handleJavaScriptDialog', { accept: true });
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
      if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    });
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('DOM.enable');
    await cdp('Network.enable');
    await cdp('Network.setBlockedURLs', { urls: ['*runpod*'] });
    const evaluate = async expression => {
      const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async expression => {
      for (let i = 0; i < 180; i++) {
        if (await evaluate(expression)) return;
        await sleep(100);
      }
      throw new Error(`Timed out: ${expression}`);
    };
    const selector = id => `[data-testid="${id}"]`;
    const present = id => wait(`!!document.querySelector('${selector(id)}')`);
    const click = async id => {
      await present(id);
      await evaluate(`document.querySelector('${selector(id)}').click()`);
      await sleep(150);
    };
    const setValue = async (id, value) => {
      await present(id);
      await evaluate(`(() => {
        const node = document.querySelector('${selector(id)}');
        const proto = node.tagName === 'SELECT' ? HTMLSelectElement.prototype :
          node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, ${JSON.stringify(value)});
        node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true}));
      })()`);
      await sleep(150);
    };
    const upload = async file => {
      const document = await cdp('DOM.getDocument');
      const node = await cdp('DOM.querySelector', { nodeId: document.root.nodeId, selector: selector('input-profile-pdf') });
      await cdp('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [file] });
      await present('status-pdf-selected');
    };
    await run({ cdp, evaluate, wait, present, click, setValue, upload, errors, requests });
  } finally {
    socket?.close();
    chrome.kill('SIGTERM');
    await sleep(300);
    await rm(dir, { recursive: true, force: true });
  }
}
