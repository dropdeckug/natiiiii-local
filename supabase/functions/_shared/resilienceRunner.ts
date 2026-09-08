/**
 * Self-healing resilience runner for GitHub Actions workflow execution.
 *
 * Provides live checkpoint events, error classification, automated fixes,
 * and a strict no-progress guard halting execution when stderr fingerprint is unchanged.
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

const KNOWN_NATIVE_PACKAGES = {
  sharp: "Image processing native C++ library. Use client-side Canvas or standard web image handling.",
  sqlite3: "Native SQLite binding. Use Capacitor SQLite plugin (@capacitor-community/sqlite) or IndexedDB.",
  "better-sqlite3": "Native SQLite binding against Node C++ ABI. Use sql.js (Wasm) or IndexedDB.",
  bcrypt: "Native C++ password hashing. Use bcryptjs (pure JS) instead.",
  argon2: "Native password hashing. Use argon2-browser or backend hashing.",
  canvas: "Native Cairo canvas binding. Use HTML5 Canvas elements natively supported in WebViews.",
  "node-gyp": "Native C++ build tool, not a runtime web package.",
  fsevents: "macOS native filesystem watcher. Not applicable or needed in WebView runtime.",
  nodegit: "Native libgit2 binding. Incompatible with mobile WebView environments.",
  puppeteer: "Headless Chrome automation. Cannot run inside mobile WebView.",
  playwright: "Browser automation library. Cannot run inside mobile WebView."
};

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "crypto", "http", "https", "stream", "util", "events", "url",
  "buffer", "child_process", "net", "tls", "zlib", "cluster", "dgram", "dns", "readline",
  "repl", "string_decoder", "timers", "tty", "v8", "vm", "wasi", "worker_threads", "assert",
  "constants", "perf_hooks", "async_hooks", "punycode"
]);

function bareSpecifier(spec) {
  if (!spec) return undefined;
  var s = String(spec).trim().replace(/^npm:/, '');
  if (/^[./]|^node:|^virtual:|^data:|^https?:|^file:|^@\\/|^~\\/|^#|^\\$\\//.test(s)) return undefined;
  if (s.startsWith('@/') || s.startsWith('~/') || s.startsWith('#') || s.startsWith('$/') || s.startsWith('~')) return undefined;
  var parts = s.split('/');
  var name = s.startsWith('@') ? (parts.length >= 2 ? parts.slice(0, 2).join('/') : null) : parts[0];
  if (!name) return undefined;
  name = name.split('@')[0];
  if (NODE_BUILTINS.has(name)) return undefined;
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) return undefined;
  var base = name.startsWith('@') ? name.split('/')[1] : name;
  if (!base || base.startsWith('.') || base.startsWith('_')) return undefined;
  return name;
}

const PKG_RE = /(?:Cannot find module|Module not found:? (?:Error: )?Can't resolve|failed to resolve import|Rollup failed to resolve import)\\s*["']?([^"'\\s)]+)["']?/i;

function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[1] : undefined;
}

function computeStderrFingerprint(output, stepName) {
  const normalized = (output || "")
    .toLowerCase()
    .replace(/\\d{4}-\\d{2}-\\d{2}t[\\d:.+-]+z?/gi, "<timestamp>")
    .replace(/\\b[0-9a-f]{7,64}\\b/gi, "<hash>")
    .replace(/\\b(?:run|job|build)\\s*#?\\d+\\b/gi, "<execution-id>")
    .replace(/\\/home\\/runner\\/work\\/[^\\s:'"]+/gi, "<workspace>")
    .replace(/\\b\\d+(?:\\.\\d+){1,3}\\b/g, "<version>")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(-1200);
  return (stepName ? stepName.trim().toLowerCase() : '') + '|' + normalized;
}

function classifyError(output, stepName) {
  const text = (stepName || '') + '\\n' + (output || '');

  if (/node-gyp|prebuild-install|gyp ERR|native module/i.test(text)) {
    const pkg =
      bareSpecifier(firstMatch(text, /(?:npm ERR!.*?)?node_modules[\\\\/]((?:@[^\\\\/]+[\\\\/])?[^\\\\/\\s]+)/i)) ||
      bareSpecifier(firstMatch(text, /(?:for package|building package|building|package)\\s+([@\\w./-]+)@?/i));
    return {
      errorType: 'native_addon',
      packageName: pkg,
      fixAction: 'remove_native_package',
      automatic: false,
      explanation: pkg ? (pkg + ' requires native compilation, unsupported on WebView.') : 'A native C++ dependency is unsupported.'
    };
  }

  if (/ERESOLVE|unable to resolve dependency tree|peer dependency conflict|npm ERR! peer dep/i.test(text)) {
    return {
      errorType: 'dependency_conflict',
      fixAction: 'legacy_peer_deps',
      automatic: true,
      explanation: 'Peer dependency conflict; retrying with --legacy-peer-deps.'
    };
  }

  if (/ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network error|npm ERR! network|socket hang up/i.test(text)) {
    return {
      errorType: 'network_error',
      fixAction: 'retry_with_delay',
      automatic: true,
      explanation: 'Transient network failure; retrying after backoff.'
    };
  }

  if (/Did you mean to import\\s+(\\S+)/i.test(text)) {
    const suggested = firstMatch(text, /Did you mean to import\\s+["']?([^\\s"'?]+)["']?/i);
    return {
      errorType: 'import_extension_missing',
      suggestedFile: suggested,
      filePath: firstMatch(text, /from\\s+["']?([^\\s"']+\\.(?:m?js|jsx|ts|tsx))["']?/i),
      fixAction: 'add_import_extension',
      automatic: true,
      explanation: 'Missing import extension: ' + suggested
    };
  }

  if (/require is not defined in ES module|Cannot use import statement|"type"\\s*:\\s*"module"|type module/i.test(text)) {
    return {
      errorType: 'module_system_conflict',
      fixAction: 'normalize_module_system',
      automatic: true,
      explanation: 'Mixed CommonJS/ESM module system conflict.'
    };
  }

  if (/Duplicate class|duplicate class found in modules/i.test(text)) {
    return {
      errorType: 'gradle_duplicate_class',
      className: firstMatch(text, /Duplicate class ([\\w.$]+)/i),
      fixAction: 'add_gradle_resolution',
      automatic: true,
      explanation: 'Duplicate Android classes found.'
    };
  }

  if (/www\\/index\\.html|webDir[^\\n]*not found|No such file or directory[^\\n]*index\\.html/i.test(text)) {
    return {
      errorType: 'output_missing',
      fixAction: 'find_alternate_output',
      automatic: true,
      explanation: 'Web output directory missing.'
    };
  }

  if (PKG_RE.test(text)) {
    const pkg = bareSpecifier(firstMatch(text, PKG_RE));
    if (pkg && KNOWN_NATIVE_PACKAGES[pkg]) {
      return {
        errorType: 'native_addon',
        packageName: pkg,
        fixAction: 'remove_native_package',
        automatic: false,
        explanation: pkg + ' requires native compilation.'
      };
    }
    return {
      errorType: 'dependency_missing',
      packageName: pkg,
      filePath: firstMatch(text, /from\\s+["']?([^\\s"']+\\.(?:m?js|jsx|ts|tsx|vue|svelte))["']?/i),
      fixAction: 'add_package',
      automatic: Boolean(pkg),
      explanation: pkg ? ('Missing npm package ' + pkg) : 'Missing dependency.'
    };
  }

  if (/Could not find installation of TypeScript|Cannot find name|Type error|TS\\d{4}/i.test(text)) {
    return {
      errorType: 'typescript_error',
      fixAction: 'install_typescript',
      automatic: true,
      explanation: 'TypeScript compilation error.'
    };
  }

  if (/Execution failed for task|BUILD FAILED/i.test(text)) {
    return {
      errorType: 'gradle_error',
      fixAction: 'clean_gradle_cache',
      automatic: true,
      explanation: 'Gradle task failure.'
    };
  }

  return {
    errorType: 'unknown',
    fixAction: 'ai_diagnosis',
    automatic: false,
    explanation: 'Unhandled error requiring AI diagnosis.'
  };
}

function applyFix(classification) {
  if (!classification || !classification.automatic) return { applied: false };
  try {
    if (classification.fixAction === 'legacy_peer_deps') {
      const res = spawnSync('npm install --legacy-peer-deps --no-audit --no-fund', { shell: true, stdio: 'inherit' });
      return { applied: res.status === 0, command: 'npm install --legacy-peer-deps' };
    }
    if (classification.fixAction === 'add_package' && classification.packageName) {
      const p = classification.packageName;
      spawnSync('npm pkg set dependencies.' + p + '="*"', { shell: true, stdio: 'inherit' });
      const res = spawnSync('npm install --no-audit --no-fund', { shell: true, stdio: 'inherit' });
      return { applied: res.status === 0, command: 'npm pkg set dependencies.' + p + ' && npm install' };
    }
    if (classification.fixAction === 'normalize_module_system') {
      const res = spawnSync('npm pkg delete type', { shell: true, stdio: 'inherit' });
      return { applied: res.status === 0, command: 'npm pkg delete type' };
    }
    if (classification.fixAction === 'clean_gradle_cache') {
      const cwd = fs.existsSync('android') ? 'android' : '.';
      const res = spawnSync('./gradlew clean --no-daemon', { shell: true, stdio: 'inherit', cwd });
      return { applied: res.status === 0, command: './gradlew clean' };
    }
    if (classification.fixAction === 'retry_with_delay') {
      spawnSync('sleep 3', { shell: true });
      return { applied: true, command: 'sleep 3' };
    }
  } catch (e) {
    return { applied: false, error: e.message };
  }
  return { applied: false };
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
  let lastFingerprint = null;

  while (attempt < maxAttempts) {
    attempt++;
    const res = spawnSync(cmd, { shell: true, encoding: 'utf8', env: process.env });
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    lastExit = res.status === null ? 1 : res.status;
    if (lastExit === 0) {
      await postEvent('step_completed', { step: stepName, attempt: attempt, status: 'success' });
      process.exit(0);
    }

    const combinedOutput = (res.stderr || '') + '\\n' + (res.stdout || '');
    const fingerprint = computeStderrFingerprint(combinedOutput, stepName);
    const classification = classifyError(combinedOutput, stepName);

    console.warn('[nb-resilience] step "' + stepName + '" failed (attempt ' + attempt + '/' + maxAttempts + ') with exit ' + lastExit + ' [' + classification.errorType + ']');

    // No-progress guard
    if (lastFingerprint && lastFingerprint === fingerprint) {
      console.warn('[nb-resilience] NO-PROGRESS GUARD: stderr fingerprint identical to previous attempt. Halting retry loop to escalate to agent.');
      await postEvent('step_failed', {
        step: stepName,
        attempts: attempt,
        exit_code: lastExit,
        error_type: classification.errorType,
        fingerprint: fingerprint,
        no_progress: true,
        explanation: classification.explanation
      });
      process.exit(lastExit);
    }
    lastFingerprint = fingerprint;

    if (attempt < maxAttempts) {
      if (classification.automatic) {
        console.log('[nb-resilience] applying automated fix for ' + classification.errorType + ' (' + classification.fixAction + ')...');
        const fix = applyFix(classification);
        if (fix.applied) {
          console.log('[nb-resilience] fix applied (' + fix.command + '); retrying step...');
          await postEvent('step_healed_checkpoint', {
            step: stepName,
            attempt: attempt,
            fix_action: classification.fixAction,
            command: fix.command
          });
          continue;
        }
      }
      console.log('[nb-resilience] retrying in 2s...');
      spawnSync('sleep 2', { shell: true });
    }
  }

  await postEvent('step_failed', {
    step: stepName,
    attempts: attempt,
    exit_code: lastExit,
    fingerprint: lastFingerprint
  });
  process.exit(lastExit);
}

async function handleEvent(eventName, rawData) {
  let data = {};
  try { data = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {}); } catch (e) { data = { raw: rawData }; }
  await postEvent(eventName, data);
  process.exit(0);
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
