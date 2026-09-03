/**
 * Self-healing resilience runner for GitHub Actions workflow execution.
 *
 * Provides live checkpoint events and command execution with retry guards.
 */

export const RESILIENCE_RUNNER_FILENAME = "nb-resilience.cjs";

export const RESILIENCE_RUNNER_JS = `/* NativeBridge self-healing resilience runner */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');

const CALLBACK_URL = process.env.NB_CALLBACK_URL || '';
const CALLBACK_SECRET = process.env.NB_CALLBACK_SECRET || '';
const BUILD_ID = process.env.NB_BUILD_ID || '';
const PROJECT_ID = process.env.NB_PROJECT_ID || '';

function postEvent(eventName, payload) {
  if (!CALLBACK_URL) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const url = new URL(CALLBACK_URL);
      const data = JSON.stringify({
        event: eventName,
        build_id: BUILD_ID,
        project_id: PROJECT_ID,
        timestamp: new Date().toISOString(),
        payload: payload || {}
      });
      const req = (url.protocol === 'https:' ? https : http).request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(CALLBACK_SECRET ? { 'Authorization': 'Bearer ' + CALLBACK_SECRET } : {})
        },
        timeout: 8000
      }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.write(data);
      req.end();
    } catch (e) {
      resolve();
    }
  });
}

async function handleEvent(eventName, rawData) {
  let data = {};
  try { data = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {}); } catch (e) { data = { raw: rawData }; }
  await postEvent(eventName, data);
  process.exit(0);
}

async function handleStep(stepName, cmdArgs) {
  if (!cmdArgs || cmdArgs.length === 0) {
    console.error('[nb-resilience] no command specified for step: ' + stepName);
    process.exit(1);
  }
  const cmd = cmdArgs.join(' ');
  console.log('[nb-resilience] >> executing: ' + stepName + ' (' + cmd + ')');
  await postEvent('step_started', { step: stepName, command: cmd });

  const maxAttempts = 3;
  let attempt = 0;
  let lastExit = 0;

  while (attempt < maxAttempts) {
    attempt++;
    const res = spawnSync(cmd, { shell: true, stdio: 'inherit', env: process.env });
    lastExit = res.status === null ? 1 : res.status;
    if (lastExit === 0) {
      await postEvent('step_completed', { step: stepName, attempt: attempt, status: 'success' });
      process.exit(0);
    }

    console.warn('[nb-resilience] step "' + stepName + '" failed (attempt ' + attempt + '/' + maxAttempts + ') with exit ' + lastExit);
    if (attempt < maxAttempts) {
      console.log('[nb-resilience] retrying in 2s...');
      spawnSync('sleep 2', { shell: true });
    }
  }

  await postEvent('step_failed', { step: stepName, attempts: attempt, exit_code: lastExit });
  process.exit(lastExit);
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (action === 'event') {
    const eventName = args[1] || 'generic';
    const eventData = args[2] || '{}';
    await handleEvent(eventName, eventData);
    return;
  }

  if (action === 'step') {
    const stepName = args[1] || 'unnamed-step';
    const sepIdx = args.indexOf('--');
    const cmdArgs = sepIdx !== -1 ? args.slice(sepIdx + 1) : args.slice(2);
    await handleStep(stepName, cmdArgs);
    return;
  }

  console.log('[nb-resilience] unknown action: ' + action);
  process.exit(0);
}

main().catch(() => process.exit(1));
`;
