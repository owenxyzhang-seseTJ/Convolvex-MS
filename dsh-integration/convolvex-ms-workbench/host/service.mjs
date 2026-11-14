/**
 * Host half of the Convolvex-MS workbench bundle.
 *
 * Responsibilities:
 *   1. Resolve the DSH workspace that a panel request or agent tool belongs to.
 *   2. Run the original Convolvex web service (`python -m convolvex.cli serve`)
 *      with a data directory inside that workspace: `<workspace>/.convolvex-ms`.
 *   3. Proxy the original `/api/v1` contract so the reused web frontend needs no
 *      numerical rewrite, and expose compact read-only status to agent tools.
 *
 * One Python service is started lazily per workspace and shared by the panel
 * and the `convolvex_workbench` tool. It is stopped when the plugin unloads.
 */
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = '.convolvex-ms';
const START_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 180_000;
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const STDERR_LIMIT = 16_000;

const fail = (code, message, status) => Object.assign(new Error(message), { code, status });

function within(root, candidate) {
  const base = path.resolve(root);
  const value = path.resolve(candidate);
  return value === base || value.startsWith(base.endsWith(path.sep) ? base : base + path.sep);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultPython(appRoot) {
  return process.platform === 'win32'
    ? path.join(appRoot, '.venv', 'Scripts', 'python.exe')
    : path.join(appRoot, '.venv', 'bin', 'python');
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  if (!port) throw fail('PORT_FAILED', '无法分配本地端口');
  return port;
}

function looksLikeConvolvex(root) {
  if (typeof root !== 'string' || !root) return false;
  try {
    return existsSync(path.join(root, 'pyproject.toml')) && existsSync(path.join(root, 'src', 'convolvex'));
  } catch { return false; }
}

function resolveAppRoot(packageDir, config) {
  const candidates = [];
  if (typeof config.appRoot === 'string' && config.appRoot.trim()) candidates.push(config.appRoot);
  if (process.env.CONVOLVEX_MS_ROOT) candidates.push(process.env.CONVOLVEX_MS_ROOT);
  candidates.push(
    path.join(packageDir, '..', '..'),
    path.join(packageDir, 'vendor', 'convolvex-ms'),
    path.join(process.cwd(), 'Convolvex_MS_1.1.0'),
    path.join(process.cwd(), 'Convolvex-MS'),
    process.cwd(),
  );
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (looksLikeConvolvex(resolved)) return resolved;
  }
  return path.resolve(config.appRoot || path.join(packageDir, '..', '..'));
}

export function createWorkbenchHost({ ctx, config = {}, packageDir } = {}) {
  let realPackageDir = packageDir;
  try { realPackageDir = realpathSync(packageDir); } catch { /* keep the resolved module path */ }
  const appRoot = resolveAppRoot(realPackageDir, config);
  const configuredPython = config.python || defaultPython(appRoot);
  const python = path.isAbsolute(configuredPython) ? path.resolve(configuredPython) : configuredPython;
  const servers = new Map();
  let activeRoot = null;
  let disposed = false;

  const getService = (name) => {
    try { return typeof ctx?.get === 'function' ? ctx.get(name) : undefined; } catch { return undefined; }
  };

  const log = (level, message) => {
    try { ctx?.logger?.[level]?.(message); } catch { /* logging must never fail a request */ }
  };

  /** Registered DSH workspaces, newest first in the registry's own order. */
  function workspaceList() {
    const out = [];
    const registry = getService('workspaceRegistry');
    if (registry && typeof registry.list === 'function') {
      try {
        for (const workspace of registry.list() || []) {
          if (!workspace || typeof workspace.path !== 'string' || !workspace.path) continue;
          out.push({
            id: String(workspace.id || workspace.workspaceId || ''),
            title: String(workspace.title || path.basename(workspace.path)),
            path: path.resolve(workspace.path),
            updatedAt: String(workspace.updatedAt || ''),
          });
        }
      } catch (error) { log('warn', 'convolvex: cannot read workspace registry: ' + error.message); }
    }
    if (!out.length) {
      const workingDirectory = getService('workingDirectory');
      const directory = workingDirectory && typeof workingDirectory.defaultDirectory === 'string'
        ? workingDirectory.defaultDirectory : '';
      if (directory) out.push({ id: 'default', title: path.basename(directory), path: path.resolve(directory), updatedAt: '' });
    }
    const seen = new Set();
    return out.filter((workspace) => {
      const key = process.platform === 'win32' ? workspace.path.toLowerCase() : workspace.path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function fallbackRoot() {
    if (activeRoot) return activeRoot;
    const list = workspaceList();
    if (list.length) {
      const sorted = list.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return sorted[0].path;
    }
    const workingDirectory = getService('workingDirectory');
    if (workingDirectory && typeof workingDirectory.defaultDirectory === 'string' && workingDirectory.defaultDirectory) {
      return path.resolve(workingDirectory.defaultDirectory);
    }
    return path.resolve(packageDir || process.cwd());
  }

  /** Resolve an explicit workspace path; only registered workspaces are writable. */
  function resolveRoot(requested) {
    if (typeof requested !== 'string' || !requested.trim()) return fallbackRoot();
    if (requested.length > 4096 || /[\0\r\n]/.test(requested)) throw fail('INVALID_PATH', '工作区路径无效');
    const resolved = path.resolve(requested);
    const list = workspaceList();
    if (list.length && !list.some((workspace) => within(workspace.path, resolved))) {
      throw fail('UNKNOWN_WORKSPACE', '该目录不是已注册的 DSH 工作区：' + resolved);
    }
    return resolved;
  }

  /** Map a Session working directory to the owning registered workspace. */
  function rootForWorkdir(workdir) {
    const resolved = path.resolve(typeof workdir === 'string' && workdir ? workdir : fallbackRoot());
    let best = null;
    for (const workspace of workspaceList()) {
      if (within(workspace.path, resolved) && (!best || workspace.path.length > best.length)) best = workspace.path;
    }
    return best || resolved;
  }

  async function safeDataDir(root) {
    const realRoot = await fsp.realpath(root);
    const stat = await fsp.stat(realRoot).catch(() => null);
    if (!stat || !stat.isDirectory()) throw fail('NOT_A_DIRECTORY', '工作区目录不存在：' + realRoot);
    const directory = path.join(realRoot, DATA_DIR);
    try {
      const existing = await fsp.lstat(directory);
      if (existing.isSymbolicLink()) throw fail('UNSAFE_DATA_DIR', '工作区内的 ' + DATA_DIR + ' 不能是符号链接');
      if (!existing.isDirectory()) throw fail('UNSAFE_DATA_DIR', '工作区内的 ' + DATA_DIR + ' 不是目录');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    return { realRoot, directory };
  }

  async function stopEntry(entry) {
    const child = entry && entry.child;
    if (!child || child.exitCode !== null) return;
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
    const deadline = Date.now() + 4000;
    while (child.exitCode === null && Date.now() < deadline) await delay(100);
    if (child.exitCode === null) {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }
  }

  async function startServer(root) {
    if (disposed) throw fail('DISPOSED', 'Convolvex 工作台插件已卸载');
    const { realRoot, directory } = await safeDataDir(root);
    const key = process.platform === 'win32' ? realRoot.toLowerCase() : realRoot;
    const existing = servers.get(key);
    if (existing?.ready && existing.child?.exitCode === null) return existing;
    if (existing?.starting) return existing.starting;

    const entry = { root: realRoot, dataDir: directory, port: 0, child: null, ready: false, stderr: '', spawnError: null };
    entry.starting = (async () => {
      const port = await freePort();
      const args = ['-u', '-m', 'convolvex.cli', 'serve', '--host', '127.0.0.1', '--port', String(port), '--data-dir', directory];
      log('info', 'convolvex: starting ' + python + ' ' + args.join(' '));
      let child;
      try {
        child = spawn(python, args, {
          cwd: appRoot,
          env: {
            ...process.env,
            CONVOLVEX_DATA: directory,
            PYTHONUNBUFFERED: '1',
            OPENBLAS_NUM_THREADS: '1',
            OMP_NUM_THREADS: '1',
            MKL_NUM_THREADS: '1',
            VECLIB_MAXIMUM_THREADS: '1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (error) {
        throw fail('PYTHON_NOT_FOUND', '无法启动 Convolvex Python 服务：' + error.message + '\n请检查插件配置中的 python 或 appRoot。');
      }
      entry.child = child;
      child.stderr.on('data', (chunk) => {
        entry.stderr = (entry.stderr + chunk.toString('utf8')).slice(-STDERR_LIMIT);
      });
      child.stdout.on('data', () => {});
      child.on('error', (error) => { entry.spawnError = error; });
      child.on('exit', (code, signal) => {
        entry.ready = false;
        const current = servers.get(key);
        if (current === entry) servers.delete(key);
        if (!disposed) log(code === 0 ? 'info' : 'warn', 'convolvex service exited for ' + realRoot + ': ' + String(code || signal));
      });

      const deadline = Date.now() + START_TIMEOUT_MS;
      let lastError = null;
      while (Date.now() < deadline) {
        if (entry.spawnError) {
          throw fail('PYTHON_NOT_FOUND', '无法启动 Convolvex Python 服务：' + entry.spawnError.message
            + '\n请检查插件配置中的 python 或 appRoot。');
        }
        if (child.exitCode !== null) {
          throw fail('SERVICE_EXITED', 'Convolvex 服务启动后立即退出（code ' + child.exitCode + '）：\n' + entry.stderr.slice(-4000));
        }
        try {
          const response = await fetch('http://127.0.0.1:' + port + '/api/v1/health', { signal: AbortSignal.timeout(1500) });
          if (response.ok) {
            entry.port = port;
            entry.ready = true;
            return entry;
          }
          lastError = 'health ' + response.status;
        } catch (error) { lastError = error.message; }
        await delay(150);
      }
      await stopEntry(entry);
      throw fail('SERVICE_TIMEOUT', 'Convolvex 服务在 ' + Math.round(START_TIMEOUT_MS / 1000) + ' 秒内未就绪（'
        + String(lastError || 'timeout') + '）：\n' + entry.stderr.slice(-4000));
    })();

    servers.set(key, entry);
    try {
      return await entry.starting;
    } catch (error) {
      if (servers.get(key) === entry) servers.delete(key);
      await stopEntry(entry);
      throw error;
    }
  }

  async function api(root, apiPath, method = 'GET', body) {
    if (typeof apiPath !== 'string' || !apiPath.startsWith('/') || apiPath.includes('..')) {
      throw fail('INVALID_PATH', '无效的 API 路径');
    }
    let encoded;
    if (body !== undefined) {
      encoded = JSON.stringify(body);
      if (Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) throw fail('PAYLOAD_TOO_LARGE', '请求数据超过 32 MB');
    }
    const entry = await startServer(root);
    const url = 'http://127.0.0.1:' + entry.port + '/api/v1' + apiPath;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: encoded ? { 'content-type': 'application/json' } : undefined,
        body: encoded,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (entry.child && entry.child.exitCode !== null) {
        throw fail('SERVICE_EXITED', 'Convolvex 服务已退出：\n' + entry.stderr.slice(-4000));
      }
      throw fail('SERVICE_UNAVAILABLE', '无法连接 Convolvex 服务：' + error.message);
    }
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { detail: text.slice(0, 4000) }; }
    }
    if (!response.ok) {
      const detail = data && typeof data.detail === 'string' ? data.detail : (data && data.detail ? JSON.stringify(data.detail) : response.statusText);
      throw fail('API_ERROR', detail, response.status);
    }
    return data;
  }

  async function writeLastProject(root, project) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) return;
    try {
      const { directory } = await safeDataDir(root);
      const text = JSON.stringify(project);
      if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return;
      const file = path.join(directory, 'last-project.json');
      const temporary = file + '.' + randomUUID() + '.tmp';
      await fsp.writeFile(temporary, text, { mode: 0o600 });
      await fsp.rename(temporary, file);
    } catch (error) { log('warn', 'convolvex: cannot persist last project: ' + error.message); }
  }

  async function readLastProject(root) {
    try {
      const { directory } = await safeDataDir(root);
      const file = path.join(directory, 'last-project.json');
      const stat = await fsp.lstat(file);
      if (stat.size > MAX_BODY_BYTES || !stat.isFile() || stat.isSymbolicLink()) return null;
      return JSON.parse(await fsp.readFile(file, 'utf8'));
    } catch { return null; }
  }

  function projectSummary(project) {
    if (!project || typeof project !== 'object') return null;
    const dataset = project.dataset;
    const analysis = project.analysis;
    if (dataset && analysis) {
      return {
        kind: 'dems',
        channels: Array.isArray(dataset.mz) ? dataset.mz.length : null,
        samples: Array.isArray(dataset.time_s) ? dataset.time_s.length : null,
        signalUnit: dataset.signal_unit || null,
        species: Array.isArray(analysis.species) ? analysis.species : [],
        method: analysis.method || null,
        model: analysis.model || null,
        synthetic: dataset.synthetic === true,
      };
    }
    return { kind: project.task || 'generic', method: project.method || null };
  }

  async function info(requestedRoot) {
    const root = resolveRoot(requestedRoot);
    const { directory } = await safeDataDir(root);
    let capability = null;
    const existing = servers.get(process.platform === 'win32' ? root.toLowerCase() : root);
    if (existing?.ready) {
      try { capability = await api(root, '/capabilities'); } catch { capability = null; }
    }
    return {
      root,
      dataDir: directory,
      appRoot,
      python,
      running: Boolean(existing?.ready),
      capability,
      workspaces: workspaceList(),
    };
  }

  async function dispatch(input = {}, execution = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'Expected an object payload.' } };
    }
    const action = input.action;
    try {
      if (action === 'info') {
        const value = await info(input.root);
        if (!activeRoot) activeRoot = value.root;
        return { ok: true, value };
      }
      if (action === 'setWorkspace') {
        const root = resolveRoot(input.path);
        const { directory } = await safeDataDir(root);
        activeRoot = root;
        return { ok: true, value: { root, dataDir: directory, workspaces: workspaceList() } };
      }
      if (action === 'api') {
        const root = input.root ? resolveRoot(input.root) : fallbackRoot();
        const value = await api(root, input.path, input.method || 'GET', input.body);
        if (input.path === '/jobs' && (input.method || 'GET').toUpperCase() === 'POST') await writeLastProject(root, input.body);
        return { ok: true, value };
      }
      if (action === 'lastProject') {
        const root = input.root ? resolveRoot(input.root) : fallbackRoot();
        const project = await readLastProject(root);
        return { ok: true, value: { project, summary: projectSummary(project) } };
      }
      if (action === 'status') {
        const root = input.root ? resolveRoot(input.root) : (execution.workdir ? rootForWorkdir(execution.workdir) : fallbackRoot());
        const project = await readLastProject(root);
        let jobs = [];
        let capability = null;
        try {
          const list = await api(root, '/jobs');
          jobs = Array.isArray(list) ? list : [];
        } catch (error) {
          if (error.code !== 'SERVICE_UNAVAILABLE' && error.code !== 'SERVICE_EXITED') throw error;
        }
        try { capability = await api(root, '/capabilities'); } catch { capability = null; }
        const counts = { total: jobs.length, completed: 0, running: 0, failed: 0, queued: 0, cancelled: 0, interrupted: 0 };
        for (const job of jobs) if (counts[job.status] !== undefined) counts[job.status] += 1;
        return {
          ok: true,
          value: {
            root,
            dataDir: (await safeDataDir(root)).directory,
            capability,
            jobCounts: counts,
            recentJobs: jobs.slice(0, 10),
            lastProject: projectSummary(project),
          },
        };
      }
      if (action === 'jobs') {
        const root = input.root ? resolveRoot(input.root) : (execution.workdir ? rootForWorkdir(execution.workdir) : fallbackRoot());
        const jobs = await api(root, '/jobs');
        return { ok: true, value: { root, jobs } };
      }
      if (action === 'result') {
        const root = input.root ? resolveRoot(input.root) : (execution.workdir ? rootForWorkdir(execution.workdir) : fallbackRoot());
        const jobId = typeof input.jobId === 'string' ? input.jobId : '';
        if (!/^[0-9a-fA-F-]{36}$/.test(jobId)) throw fail('INVALID_JOB', 'jobId 需要一个 UUID');
        const result = await api(root, '/jobs/' + jobId + '/result');
        const arrays = {};
        for (const field of ['estimate', 'predicted', 'residual', 'background', 'objective_history']) {
          if (Array.isArray(result?.[field])) arrays[field] = { rows: result[field].length, columns: Array.isArray(result[field][0]) ? result[field][0].length : 0 };
        }
        return {
          ok: true,
          value: {
            root,
            jobId,
            method: result?.method || null,
            converged: result?.converged === true,
            scienceStatus: result?.science_status || null,
            quantificationStatus: result?.quantification_status || null,
            relativeResidual: result?.relative_residual ?? null,
            iterations: result?.iterations ?? null,
            elapsedS: result?.elapsed_s ?? null,
            species: result?.species || [],
            warnings: result?.warnings || [],
            diagnostics: result?.diagnostics || {},
            arrays,
          },
        };
      }
      return { ok: false, error: { code: 'UNKNOWN_ACTION', message: '未知操作：' + String(action) } };
    } catch (error) {
      return { ok: false, error: { code: error.code || 'WORKBENCH_ERROR', message: error.message || String(error), status: error.status || 500 } };
    }
  }

  async function dispose() {
    disposed = true;
    const entries = Array.from(servers.values());
    servers.clear();
    await Promise.all(entries.map((entry) => stopEntry(entry)));
  }

  return {
    appRoot,
    python,
    dispatch,
    info,
    rootForWorkdir,
    workspaceList,
    dispose,
  };
}
