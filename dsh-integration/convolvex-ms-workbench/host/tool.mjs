/**
 * `convolvex_workbench` — agent-facing handle for the visual Convolvex-MS panel.
 *
 * The tool is deliberately read-only over the panel's own workspace:
 *   - both the panel and the tool use `<workspace>/.convolvex-ms`;
 *   - the agent can answer "what did I run in the workbench?" and report the
 *     same job ids the user sees in the Records tab;
 *   - numerical work still belongs to the `mcp__convolvex-ms__*` tools, which
 *     remain the single audited analysis surface.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    action: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
    error: { type: 'object', additionalProperties: true },
  },
  required: ['ok', 'action'],
  additionalProperties: true,
};

function pruneProject(project) {
  if (!project || typeof project !== 'object') return null;
  const dataset = project.dataset || null;
  const analysis = project.analysis || null;
  if (!dataset && !analysis) {
    return {
      schemaVersion: project.schema_version || null,
      kind: project.task || 'generic',
      method: project.method || null,
      operatorKind: project.operator && project.operator.kind ? project.operator.kind : null,
      observedSamples: Array.isArray(project.observed) ? project.observed.length : null,
      parameters: project.parameters || null,
      metadata: project.metadata ? {
        name: project.metadata.name || null,
        synthetic: project.metadata.synthetic === true,
      } : null,
    };
  }
  return {
    schemaVersion: project.schema_version || null,
    dataset: dataset ? {
      mz: dataset.mz,
      samples: Array.isArray(dataset.time_s) ? dataset.time_s.length : null,
      timeRangeS: Array.isArray(dataset.time_s) && dataset.time_s.length
        ? [dataset.time_s[0], dataset.time_s[dataset.time_s.length - 1]] : null,
      signalUnit: dataset.signal_unit || null,
      synthetic: dataset.synthetic === true,
      name: dataset.metadata && dataset.metadata.name ? dataset.metadata.name : null,
      hasPotential: Array.isArray(dataset.potential_V),
      hasCurrent: Array.isArray(dataset.current_A),
    } : null,
    analysis: analysis ? {
      species: analysis.species,
      model: analysis.model,
      method: analysis.method,
      kernels: Array.isArray(analysis.kernels) ? analysis.kernels.length : 0,
      l2: analysis.l2,
      l1: analysis.l1,
      maxIter: analysis.max_iter,
      blankWindowsS: analysis.blank_windows_s || [],
    } : null,
  };
}

function render(_args, value) {
  const v = value || {};
  const lines = [];
  if (v.error) {
    lines.push('[convolvex_workbench] error: ' + (v.error.code || 'UNKNOWN'));
    lines.push(v.error.message || '');
  } else {
    lines.push('[convolvex_workbench] ' + String(v.action || 'status'));
    lines.push(JSON.stringify(v.data || {}, null, 2));
  }
  const text = lines.filter(Boolean).join('\n\n');
  return [{ type: 'text', text: text.length <= 18_000 ? text : text.slice(0, 18_000) + '\n[truncated]' }];
}

const DESCRIPTION = [
  'Read the Convolvex-MS visual workbench bound to this conversation\'s DSH workspace.',
  'The left-sidebar Convolvex-MS panel and this tool share <workspace>/.convolvex-ms, so job ids returned here are the same records the user sees in the panel\'s Records tab.',
  'Actions: status (workspace, service capability, job counts, recent jobs, last project submitted from the panel), jobs (recent run records), result (compact result summary for one jobId), project (last project submitted from the panel, without bulk arrays).',
  'This tool does not run new numerical fits. Use the mcp__convolvex-ms__* tools for dataset import, background diagnosis, analysis and calibrated quantification; those MCP tools use a separate runtime/ms-stdio store, so their datasets and job ids are not visible in this panel.',
].join(' ');

async function rootForTool(ctx, host, exec, args) {
  if (typeof args.root === 'string' && args.root.trim()) return args.root;
  const workingDirectory = ctx && typeof ctx.get === 'function' ? ctx.get('workingDirectory') : null;
  if (workingDirectory && typeof workingDirectory.ensure === 'function' && exec && exec.agent) {
    try {
      const directory = await workingDirectory.ensure(exec.agent, exec.signal);
      if (typeof directory === 'string' && directory) return host.rootForWorkdir(directory);
    } catch { /* fall through to the session header */ }
  }
  const cwd = exec && exec.agent && exec.agent.session && exec.agent.session.header
    ? exec.agent.session.header.cwd : null;
  if (typeof cwd === 'string' && cwd) return host.rootForWorkdir(cwd);
  return host.rootForWorkdir(exec && exec.workdir);
}

export function registerWorkbenchTool(ctx, host) {
  if (!ctx?.tools || typeof ctx.tools.register !== 'function') return () => {};
  return ctx.tools.register({
    name: 'convolvex_workbench',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'jobs', 'result', 'project'],
          description: 'status: workspace/service/job summary; jobs: recent records; result: compact result for jobId; project: last project submitted from the panel.',
        },
        jobId: { type: 'string', description: 'Job UUID for action=result.' },
        root: { type: 'string', description: 'Optional absolute workspace path; defaults to this session\'s registered workspace.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: { schema: OUTPUT_SCHEMA, render },
    timeoutMs: 200_000,
    async execute(args = {}, exec = {}) {
      const action = args.action;
      if (!['status', 'jobs', 'result', 'project'].includes(action)) {
        return { ok: false, action: action || null, error: { code: 'INVALID_ACTION', message: 'action must be status, jobs, result or project' } };
      }
      if (action === 'result' && !/^[0-9a-fA-F-]{36}$/.test(String(args.jobId || ''))) {
        return { ok: false, action, error: { code: 'INVALID_JOB', message: 'action=result requires a job UUID in jobId' } };
      }
      const root = await rootForTool(ctx, host, exec, args);
      const result = await host.dispatch({
        action: action === 'project' ? 'lastProject' : action,
        root,
        jobId: args.jobId,
      }, { workdir: root, signal: exec.signal });
      if (!result.ok) return { ok: false, action, error: result.error };
      if (action === 'project') {
        return { ok: true, action, data: { root: result.value.project ? root : null, summary: result.value.summary, project: pruneProject(result.value.project) } };
      }
      return { ok: true, action, data: result.value };
    },
  });
}
