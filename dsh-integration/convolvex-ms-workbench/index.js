/**
 * Convolvex-MS workbench bundle — Host half.
 *
 * One package-private RPC channel (`/convolvex-ms-workbench`, method `dispatch`)
 * that the Client panel uses for every operation, plus the read-only
 * `convolvex_workbench` agent tool. The numerical work is delegated to the
 * original Convolvex Python web service, started per DSH workspace.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkbenchHost } from './host/service.mjs';
import { registerWorkbenchTool } from './host/tool.mjs';

const CHANNEL = '/convolvex-ms-workbench';
const ENDPOINT = 'dispatch';

function logWarn(ctx, error) {
  try { ctx?.logger?.warn?.(error); } catch { /* logging must never break activation */ }
}

export function apply(ctx, config = {}) {
  const packageDir = path.dirname(fileURLToPath(import.meta.url));
  const host = createWorkbenchHost({ ctx, config, packageDir });
  ctx.effect(() => () => host.dispose());

  ctx.inject(['connection', 'webServer'], (webCtx) => {
    const { connection, webServer } = webCtx;
    webCtx.effect(() => webServer.register({
      kind: 'prefix',
      path: CHANNEL,
      handler: async (req, res) => {
        let admission;
        try { admission = connection.admit(req); }
        catch { admission = { rejection: 401 }; }
        if ('rejection' in admission) { res.writeHead(admission.rejection); res.end(); return; }
        if (admission.peer?.principal?.kind !== 'owner') { res.writeHead(403); res.end(); return; }
        if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return; }
        const chunks = [];
        let bytes = 0;
        try {
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > 40 * 1024 * 1024) { res.writeHead(413); res.end('request exceeds 40 MiB'); return; }
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
        } catch { res.writeHead(400); res.end('cannot read request'); return; }
        let message;
        try { message = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { res.writeHead(400); res.end('body is not JSON'); return; }
        if (!message || message.method !== ENDPOINT) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ type: 'server-response', rpcId: message?.rpcId || 'unknown', result: { ok: false, error: { code: 'UNKNOWN_ENDPOINT', message: 'Unknown endpoint' } } }));
          return;
        }
        const rpcId = typeof message.rpcId === 'string' ? message.rpcId : 'unknown';
        let result;
        try {
          result = await host.dispatch(message.payload, { signal: req.signal });
        } catch (error) {
          result = { ok: false, error: { code: 'WORKBENCH_ERROR', message: error?.message ? error.message : String(error) } };
        }
        if (res.destroyed) return;
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ type: 'server-response', rpcId, result: { ok: true, value: result } }));
      },
    }));
  });

  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() => {
      try {
        return registerWorkbenchTool(toolCtx, host);
      } catch (error) {
        logWarn(ctx, error);
        return () => {};
      }
    });
  });
}
