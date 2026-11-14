#!/usr/bin/env node
/**
 * Build `client.js` from the original Convolvex web frontend in `web/`.
 *
 * The upstream UI is a vanilla DOM application (`index.html`, `styles.css`,
 * `app.js`, `dems.js`, `ms.js`). Rather than re-implementing 2,000 lines of
 * scientific UI, this build embeds those exact files into a Shadow DOM mount and
 * redirects the frontend's `/api/v1` transport to the plugin Host RPC. All
 * numerical behaviour therefore stays the original Convolvex implementation.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, 'web');

const [html, rawCss, appJs, demsJs, msJs, pkgText] = await Promise.all([
  readFile(path.join(web, 'index.html'), 'utf8'),
  readFile(path.join(web, 'styles.css'), 'utf8'),
  readFile(path.join(web, 'app.js'), 'utf8'),
  readFile(path.join(web, 'dems.js'), 'utf8'),
  readFile(path.join(web, 'ms.js'), 'utf8'),
  readFile(path.join(here, 'package.json'), 'utf8'),
]);
const pkg = JSON.parse(pkgText);

const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('web/index.html has no body');
const markup = bodyMatch[1]
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<a class="skip-link"[\s\S]*?<\/a>/, '')
  .replaceAll('本地工作空间', 'Convolvex 工作台')
  .trim();

// Scope the upstream stylesheet to the Shadow DOM host. Anchor the `body`
// rewrite at the start of a line so `.control-body` and friends stay intact.
let css = rawCss
  .replace(/:root\s*\{/g, ':host {')
  .replace(/(^|\n)\s*body\s*\{/g, '$1:host {');
if (!/\.control-body\s*\{/.test(css) || /-:host/.test(css)) {
  throw new Error('CSS body selector transform corrupted a class selector');
}

css += `

/* ---- DSH panel adaptations: the original page had no outer chrome. ---- */
:host {
  display: block;
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  container-type: inline-size;
  color-scheme: light;
  background: #f4f3f0;
  color: #25272b;
  --canvas: #f4f3f0;
  --surface: #ffffff;
  --ink: #25272b;
  --muted: #50545b;
  --line: #dedfdb;
  --accent: #303236;
  --accent-hover: #191b1e;
  --accent-soft: #eeece9;
}
/* The original workbench keeps its paper canvas; the DSH chrome above it
   follows the host theme. Replacing a light document with a half-dark
   approximation would make scientific labels unreadable. */
.sidebar { display: none; }
.shell { margin-left: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; }
.topbar { height: 52px; padding: 0 18px; flex: none; justify-content: flex-end; background: #f8f7f5; border-bottom: 1px solid var(--line); overflow-x: auto; }
.product-title { display: none; }
main { flex: 1; min-height: 0; overflow: auto; padding: 18px 20px 14px; }
footer { flex: none; padding: 0 20px 10px; }
.skip-link, #authButton, #mobileAuth { display: none !important; }
@media (max-width: 700px) {
  .topbar { padding: 0 10px; }
  main { padding: 12px 10px 10px; }
}
@container (max-width: 980px) {
  .work-grid { grid-template-columns: minmax(220px, 260px) minmax(0, 1fr); gap: 16px; }
  .top-actions { gap: 6px; }
  .top-actions button { padding: 0 10px; font-size: 14px; }
}
@container (max-width: 780px) {
  .work-grid { grid-template-columns: 1fr; }
  .configuration-panel { max-height: none; }
}
@container (max-width: 520px) {
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric:nth-child(2) { border-right: 0; }
}

/* ---- micro-interactions: subtle motion, depth and focus feedback ---- */
:host { --cvx-ease: cubic-bezier(.22, 1, .36, 1); }
/* The spectrum library's right pane is taller than the panel at native
   scale. Keep its own vertical scroll track inside the library shell. */
.reference-pane {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-right: 4px;
}
.reference-pane .reference-plot {
  flex: 0 0 auto;
  height: clamp(300px, 46vh, 480px);
  max-height: none;
}
.panel, .analysis, .metric, .chart-panel, .dems-view {
  transition: transform .28s var(--cvx-ease), box-shadow .28s ease, border-color .28s ease;
}
.panel:hover, .chart-panel:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(37, 39, 43, .08);
  border-color: #d2d3ce;
}
.metric { transition: background .2s ease; }
.metric:hover { background: #fafbfd; }
button {
  transition: background .18s ease, border-color .18s ease, color .18s ease,
    transform .16s var(--cvx-ease), box-shadow .2s ease;
}
button:hover:not(:disabled) { transform: translateY(-1px); }
button:active:not(:disabled) { transform: translateY(0) scale(.985); }
button.primary:hover:not(:disabled) { box-shadow: 0 8px 20px rgba(48, 50, 54, .18); }
.file-drop { transition: background .2s ease, border-color .2s ease, transform .22s var(--cvx-ease), box-shadow .22s ease; }
.file-drop:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(37, 39, 43, .06); }
.file-drop.dragging { animation: cvx-pulse-border 1.2s ease-in-out infinite; }
.nav { transition: background .18s ease, color .18s ease, transform .16s var(--cvx-ease); }
.view { animation: cvx-view-in .32s var(--cvx-ease) both; }
.table-scroll tbody tr { transition: background .15s ease; }
.table-scroll tbody tr:hover { background: #fafbfd; }
dialog[open] { animation: cvx-dialog-in .24s var(--cvx-ease) both; }
.toast:not(.hidden) { animation: cvx-toast-in .3s var(--cvx-ease) both; }
@keyframes cvx-view-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cvx-dialog-in { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes cvx-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cvx-pulse-border { 0%, 100% { border-color: #dfdfdb; } 50% { border-color: #6a6d73; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
`;

const prelude = String.raw`
  const hostDocument = globalThis.document;
  const cleanups = [];
  const shadowElement = (id) => shadow.getElementById
    ? shadow.getElementById(id)
    : shadow.querySelector('#' + CSS.escape(String(id)));
  const document = {
    getElementById: shadowElement,
    querySelector: (selector) => shadow.querySelector(selector),
    querySelectorAll: (selector) => shadow.querySelectorAll(selector),
    createElement: (tag) => hostDocument.createElement(tag),
    createElementNS: (namespace, tag) => hostDocument.createElementNS(namespace, tag),
    createTextNode: (text) => hostDocument.createTextNode(text),
    addEventListener: (type, handler, options) => {
      shadow.addEventListener(type, handler, options);
      cleanups.push(() => shadow.removeEventListener(type, handler, options));
    },
    get documentElement() { return shadow.host; },
  };
  const window = {
    addEventListener: (type, handler, options) => {
      const wrapped = (event) => {
        try { if (shadow.host.isConnected) handler(event); } catch (error) { console.error(error); }
      };
      globalThis.window.addEventListener(type, wrapped, options);
      cleanups.push(() => globalThis.window.removeEventListener(type, wrapped, options));
    },
  };
  const brandLink = shadow.querySelector('.brand');
  if (brandLink) brandLink.addEventListener('click', (event) => event.preventDefault());
  const fetch = async (url, options = {}) => {
    if (typeof url === 'string' && url.startsWith('/api/v1')) {
      const apiPath = url.slice('/api/v1'.length);
      let payload = options.body;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { /* leave as text */ }
      }
      try {
        const data = await bridge.call(apiPath, { method: options.method || 'GET', body: payload });
        return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
      } catch (error) {
        return {
          ok: false,
          status: error.status || 500,
          json: async () => ({ detail: error.message || String(error) }),
          text: async () => error.message || String(error),
        };
      }
    }
    return globalThis.fetch(url, options);
  };
`;

const runtime = [
  '(function bootWorkbench(shadow, bridge) {',
  "  'use strict';",
  prelude,
  appJs.replaceAll('本地工作空间', 'Convolvex 工作台').replaceAll('本地已连接', 'Convolvex 已连接').replaceAll('检查本地服务或设置访问令牌', '检查 Convolvex Python 服务是否可用'),
  demsJs,
  msJs.replaceAll('检查本地服务或设置访问令牌', '检查 Convolvex Python 服务是否可用').replaceAll('本地已连接', 'Convolvex 已连接'),
  '  const __originalChangeView = changeView;',
  '  changeView = async function (name) {',
  '    const outcome = await __originalChangeView(name);',
  '    try { if (bridge.onView) bridge.onView(name); } catch (error) { console.error(error); }',
  '    return outcome;',
  '  };',
  '  return {',
  '    dispose() {',
  '      activeJob = null;',
  '      try { demsSequence += 1; demsReport = null; demsProcessing = false; } catch (error) { console.error(error); }',
  '      clearTimeout(toastTimer);',
  '      clearTimeout(resizeTimer);',
  '      while (cleanups.length) {',
  '        try { cleanups.pop()(); } catch (error) { console.error(error); }',
  '      }',
  '    },',
  '    changeView(name) { return changeView(name); },',
  '    restoreProject(project) {',
  '      adoptProject(project);',
  "      if (view !== 'workspace') void changeView('workspace');",
  '      render();',
  '    },',
  '    loadDemo(kind) {',
  "      if (kind) $('demo').value = kind;",
  '      return loadDemo();',
  '    },',
  '    state() {',
  '      return { view, busy, dirty: Boolean(dirty), hasProject: Boolean(msProject), jobId: msResultJobId };',
  '    },',
  '  };',
  '})',
].join('\n');

const toolbarCss = `
.cvx-panel { box-sizing:border-box; display:flex; flex-direction:column; height:100%; min-height:0; min-width:0; padding-top:var(--dsh-frame-top-clearance, 0px); padding-left:var(--dsh-frame-leading-clearance, 0px); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); }
.cvx-bar { flex:none; display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:58px; padding:8px 20px; background:var(--dsw-alias-bg-layer-1); border-bottom:1px solid var(--dsw-alias-border-l1); flex-wrap:wrap; }
.cvx-bar-left, .cvx-bar-right { display:flex; align-items:center; gap:12px; min-width:0; flex-wrap:wrap; }
.cvx-title { font-size:16px; font-weight:600; letter-spacing:.2px; white-space:nowrap; }
.cvx-dot { width:8px; height:8px; border-radius:50%; background:var(--dsw-alias-state-idle-primary, #999); flex:none; }
.cvx-dot[data-state="ready"] { background:var(--dsw-alias-state-success-primary, #3f9b6d); }
.cvx-dot[data-state="error"] { background:var(--dsw-alias-state-error-primary, #c14b55); }
.cvx-tabs { position:relative; display:flex; align-items:center; gap:4px; padding:0; border-radius:8px; background:transparent; }
.cvx-tab { position:relative; z-index:1; height:32px; padding:0 13px; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--dsw-alias-label-secondary); font-size:14px; cursor:pointer; white-space:nowrap; }
.cvx-tab:hover:not([data-active="true"]) { color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-border-l1); }
.cvx-tab:focus { outline:none; }
.cvx-tab:focus-visible { outline:2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent); outline-offset:2px; }
.cvx-tab[data-active="true"] { color:var(--dsw-alias-label-primary); background:transparent; font-weight:600; box-shadow:none; }
.cvx-tab-indicator {
  position:absolute; z-index:0; top:0; left:0; height:32px; border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 38%, var(--dsw-alias-border-l2)); border-radius:7px;
  background:transparent;
  box-shadow:none;
  pointer-events:none;
  transition: transform .34s var(--cvx-ease), width .34s var(--cvx-ease), opacity .2s ease;
}
.cvx-ws { display:flex; align-items:center; gap:8px; min-width:0; font-size:14px; color:var(--dsw-alias-label-secondary); }
.cvx-ws select { min-width:180px; max-width:320px; height:34px; padding:0 10px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-size:14px; }
.cvx-binding { max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; color:var(--dsw-alias-label-secondary); }
.cvx-action { height:34px; padding:0 13px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary); font-size:14px; cursor:pointer; white-space:nowrap; }
.cvx-action:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.cvx-action:disabled { opacity:.45; cursor:not-allowed; }
.cvx-notice { flex:none; padding:6px 18px; font-size:12px; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-2); border-bottom:1px solid var(--dsw-alias-border-l1); white-space:pre-wrap; }
.cvx-host { flex:1; min-height:0; position:relative; }
.cvx-error { flex:none; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin:8px 14px 0; padding:10px 12px; border:1px solid var(--dsw-alias-state-error-primary, #c14b55); border-radius:9px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font-size:12px; line-height:1.6; white-space:pre-wrap; }
.cvx-error button { flex:none; height:27px; padding:0 10px; border-radius:7px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); cursor:pointer; }
@media (max-width: 900px) {
  .cvx-binding { display:none; }
  .cvx-ws select { max-width:190px; }
}

/* ---- motion and micro UI ---- */
.cvx-panel {
  --cvx-ease: cubic-bezier(.22, 1, .36, 1);
  background:
    radial-gradient(900px 180px at 8% -45%, color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent), transparent 70%),
    var(--dsw-alias-bg-base);
}
.cvx-bar {
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, var(--dsw-alias-brand-primary));
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dsw-alias-border-l1) 80%, transparent), 0 4px 18px rgb(0 0 0 / .035);
  transition: background .3s ease, box-shadow .3s ease;
}
.cvx-title { display:flex; align-items:center; gap:8px; }
.cvx-title::before {
  content:''; width:3px; height:15px; border-radius:3px;
  background: linear-gradient(180deg, var(--dsw-alias-brand-primary), color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent));
  box-shadow: 0 0 10px color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent);
}
.cvx-tab {
  position:relative; overflow:hidden;
  transition: background .22s ease, color .22s ease, transform .18s var(--cvx-ease), box-shadow .22s ease;
}
.cvx-tab:hover { transform: translateY(-1px); }
.cvx-tab:active { transform: translateY(0) scale(.97); }
.cvx-tab[data-active="true"] { box-shadow: 0 1px 2px rgb(0 0 0 / .12), inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
.cvx-ws select { transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }
.cvx-ws select:hover { border-color: var(--dsw-alias-border-l2); }
.cvx-ws select:focus { outline:none; border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }
.cvx-action { transition: background .18s ease, color .18s ease, border-color .18s ease, transform .16s var(--cvx-ease), box-shadow .2s ease; }
.cvx-action:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgb(0 0 0 / .07); }
.cvx-action:active:not(:disabled) { transform: translateY(0) scale(.97); }
.cvx-dot[data-state="ready"] { animation: cvx-breathe 2.8s ease-in-out infinite; }
.cvx-dot[data-state="error"] { animation: cvx-alert 1.4s ease-in-out infinite; }
.cvx-notice { animation: cvx-slide-down .25s var(--cvx-ease); }
.cvx-error { animation: cvx-fade-in .28s var(--cvx-ease); }
.cvx-stage { flex:1; min-height:0; position:relative; display:flex; }
.cvx-host { flex:1; min-height:0; position:relative; }
.cvx-loading {
  position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; gap:15px;
  padding:22px 24px; background:#f4f3f0; color:#50545b;
}
.cvx-loading-head { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.cvx-loading-label { font-size:13px; letter-spacing:.2px; color:#50545b; }
.cvx-loading-grid { display:grid; grid-template-columns:240px minmax(0,1fr); gap:16px; flex:1; min-height:0; }
.cvx-loading-main { display:flex; flex-direction:column; gap:14px; min-height:0; }
.cvx-skel { position:relative; overflow:hidden; background:#e9e8e4; border-radius:9px; }
.cvx-skel::after { content:''; position:absolute; inset:0; transform:translateX(-110%); background:linear-gradient(90deg, transparent, rgb(255 255 255 / .64), transparent); animation: cvx-shimmer 1.65s ease-in-out infinite; }
.cvx-skel-title { width:190px; height:18px; }
.cvx-skel-pill { width:128px; height:32px; border-radius:8px; }
.cvx-skel-panel { min-height:190px; height:100%; }
.cvx-skel-chart { flex:1; min-height:110px; }
@keyframes cvx-breathe { 0%,100% { box-shadow:0 0 0 0 rgb(63 155 109 / .28); } 50% { box-shadow:0 0 0 5px rgb(63 155 109 / 0); } }
@keyframes cvx-alert { 0%,100% { box-shadow:0 0 0 0 rgb(193 75 85 / .28); } 50% { box-shadow:0 0 0 5px rgb(193 75 85 / 0); } }
@keyframes cvx-slide-down { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
@keyframes cvx-fade-in { from { opacity:0; } to { opacity:1; } }
@keyframes cvx-shimmer { 0% { transform:translateX(-110%); } 100% { transform:translateX(110%); } }
@media (prefers-reduced-motion: reduce) {
  .cvx-dot, .cvx-notice, .cvx-error, .cvx-skel::after, .cvx-tab, .cvx-action { animation:none !important; transition:none !important; }
}
`;

const strings = {
  zh: {
    title: 'Convolvex-MS 质谱工作台',
    workspace: '工作区',
    loading: '正在连接 Convolvex 服务…',
    noWorkspace: '没有可用的 DSH 工作区',
    boundTo: '数据：{path}',
    restore: '恢复上次项目',
    copyAgent: '复制 Agent 说明',
    copied: '已复制 Agent 工作区说明，可粘贴到对话中。',
    noProject: '该工作区还没有保存过的项目。',
    restored: '已恢复上次提交的项目。',
    retry: '重试',
    connectionUnavailable: 'DSH 连接服务不可用。',
    rpcFailed: 'Convolvex 请求失败。',
    agentPrompt: 'Convolvex-MS 工作台绑定在 DSH 工作区：{root}。数据目录：{dataDir}。请调用 convolvex_workbench 工具（action=status）查看该工作区的运行记录和结果。',
    viewWorkspace: '工作台',
    viewSpectra: '标准图谱库',
    viewRecords: '记录',
    viewsLabel: '工作台视图',
    switched: '已切换到工作区：{path}',
    switchBlocked: '当前任务仍在运行，请等待完成后再切换工作区。',
    switchConfirm: '当前配置尚未运行或保存，切换工作区会丢失界面中的改动。继续？',
    copyFailed: '复制失败，请手动复制以下内容：',
    serviceDown: 'Convolvex 服务不可用，点击「重试」重新启动前端',
    serviceHint: 'Convolvex 服务状态',
  },
  en: {
    title: 'Convolvex-MS workbench',
    workspace: 'Workspace',
    loading: 'Connecting to the Convolvex service…',
    noWorkspace: 'No DSH workspace available',
    boundTo: 'Data: {path}',
    restore: 'Restore last project',
    copyAgent: 'Copy agent note',
    copied: 'Agent workspace note copied to the clipboard.',
    noProject: 'This workspace has no saved project yet.',
    restored: 'Restored the last submitted project.',
    retry: 'Retry',
    connectionUnavailable: 'The DSH connection service is unavailable.',
    rpcFailed: 'The Convolvex request failed.',
    agentPrompt: "The Convolvex-MS workbench is bound to the DSH workspace {root}. Data directory: {dataDir}. Call the convolvex_workbench tool with action=status to inspect this workspace's run records and results.",
    viewWorkspace: 'Workbench',
    viewSpectra: 'Spectrum library',
    viewRecords: 'Records',
    viewsLabel: 'Workbench views',
    switched: 'Switched to workspace: {path}',
    switchBlocked: 'A task is still running; wait for it to finish before switching workspaces.',
    switchConfirm: 'The current configuration has not been run or saved. Switching workspaces will discard the on-screen changes. Continue?',
    copyFailed: 'Copy failed; copy this text manually:',
    serviceDown: 'Convolvex service unavailable; click Retry to restart the frontend',
    serviceHint: 'Convolvex service status',
  },
};

const wrapper = String.raw`window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useLayoutEffect, useMemo, useRef, useState } = React;
    const NS = 'convolvex-ms-workbench';
    const CHANNEL = '/convolvex-ms-workbench';
    const CSS = ${JSON.stringify(css)};
    const MARKUP = ${JSON.stringify(markup)};
    const BOOT = ${runtime};
    const TOOLBAR_CSS = ${JSON.stringify(toolbarCss)};
    const STRINGS = ${JSON.stringify(strings)};

    function format(template, values) {
      return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => values && values[key] != null ? String(values[key]) : '');
    }

    function PanelIcon(props) {
      const size = props && props.size ? props.size : 18;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 36 36', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M4 29.5h28', opacity: 0.75 }),
        h('path', { d: 'M7.5 29.5V20.5M12.5 29.5V11M17.5 29.5V17M22.5 29.5V6.5M27 29.5V21.5M31 29.5V25' }),
        h('path', { d: 'M4 16.5c2.6 0 3.5-6.5 6.2-6.5 2.8 0 3.6 9.3 6.4 9.3 2.7 0 3.4-7.6 6.1-7.6 2.4 0 3.2 4.6 5.8 4.6 1.4 0 2.4-1 3.5-2.3', opacity: 0.55, strokeWidth: 1.5 })
      );
    }

    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      render() {
        if (this.state.error) {
          return h('div', { className: 'cvx-error', role: 'alert', style: { margin: '16px' } },
            'Convolvex 面板渲染失败: ' + (this.state.error && this.state.error.message ? this.state.error.message : String(this.state.error)));
        }
        return this.props.children;
      }
    }

    function WorkbenchPanel(props) {
      const ctx = props && props.ctx ? props.ctx : null;
      const [localeTick, setLocaleTick] = useState(0);
      const [info, setInfo] = useState(null);
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');
      const [switching, setSwitching] = useState(false);
      const [restoring, setRestoring] = useState(false);
      const [serviceReady, setServiceReady] = useState(null);
      const [view, setView] = useState('workspace');
      const [runtimeKey, setRuntimeKey] = useState(0);
      const [indicator, setIndicator] = useState({ left: 0, width: 0 });
      const hostRef = useRef(null);
      const tabsRef = useRef(null);
      const runtimeRef = useRef(null);
      const infoRef = useRef(null);
      const t = useMemo(() => ctx.locale.bind(NS), [ctx, localeTick]);

      useEffect(() => ctx.locale.subscribe(() => setLocaleTick((value) => value + 1)), [ctx]);

      useLayoutEffect(() => {
        const element = tabsRef.current;
        if (!element) return undefined;
        const update = () => {
          const active = element.querySelector('.cvx-tab[data-active="true"]');
          if (!active) return;
          const parent = element.getBoundingClientRect();
          const rect = active.getBoundingClientRect();
          setIndicator({ left: rect.left - parent.left, width: rect.width });
        };
        update();
        let observer = null;
        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(update);
          observer.observe(element);
        }
        globalThis.window?.addEventListener('resize', update);
        return () => {
          if (observer) observer.disconnect();
          globalThis.window?.removeEventListener('resize', update);
        };
      }, [view, localeTick]);

      function hostCall(payload) {
        const connection = ctx.get('connection');
        if (!connection || typeof connection.rpc?.call !== 'function') {
          return Promise.reject(new Error(t('connectionUnavailable')));
        }
        return connection.rpc.call(CHANNEL, 'dispatch', payload).then((response) => {
          if (!response || response.ok === false) {
            throw new Error(response && response.error && response.error.message ? response.error.message : t('rpcFailed'));
          }
          const result = response.value;
          if (result && result.ok === false) {
            const failure = new Error(result.error && result.error.message ? result.error.message : t('rpcFailed'));
            failure.code = result.error && result.error.code;
            failure.status = result.error && result.error.status;
            throw failure;
          }
          return result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
        });
      }

      async function loadInfo() {
        setError('');
        try {
          const value = await hostCall({ action: 'info' });
          infoRef.current = value;
          setInfo(value);
          return value;
        } catch (failure) {
          setError(failure.message || String(failure));
          return null;
        }
      }

      useEffect(() => { void loadInfo(); }, []);

      useEffect(() => {
        if (!info || !info.root || !hostRef.current) return;
        const host = hostRef.current;
        const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
        shadow.innerHTML = '<style>' + CSS + '</style>' + MARKUP;
        let runtime = null;
        try {
          runtime = BOOT(shadow, {
            onView(name) {
              if (typeof name === 'string') setView(name);
            },
            async call(apiPath, options) {
              const root = infoRef.current && infoRef.current.root ? infoRef.current.root : info.root;
              try {
                const data = await hostCall({ action: 'api', root, path: apiPath, method: options && options.method || 'GET', body: options && options.body });
                setServiceReady(true);
                return data;
              } catch (failure) {
                const code = failure && failure.code ? String(failure.code) : '';
                const status = Number(failure && failure.status);
                const serviceDown = !Number.isFinite(status) || status >= 500
                  || ['SERVICE_UNAVAILABLE', 'SERVICE_EXITED', 'PYTHON_NOT_FOUND', 'SERVICE_TIMEOUT'].includes(code);
                if (serviceDown) setServiceReady(false);
                throw failure;
              }
            },
          });
          runtimeRef.current = runtime;
          setServiceReady(null);
        } catch (failure) {
          setError('Convolvex 前端挂载失败：' + (failure.message || String(failure)));
        }
        return () => {
          try { if (runtime) runtime.dispose(); } catch (failure) { console.error(failure); }
          runtimeRef.current = null;
          shadow.innerHTML = '';
        };
      }, [info && info.root, runtimeKey]);

      function retryRuntime() {
        setError('');
        setNotice('');
        setServiceReady(null);
        setRuntimeKey((value) => value + 1);
        void loadInfo();
      }

      async function switchWorkspace(event) {
        const target = event.target.value;
        if (!info || !target || target === info.root || switching) return;
        const state = runtimeRef.current && typeof runtimeRef.current.state === 'function' ? runtimeRef.current.state() : null;
        if (state && state.busy) {
          event.target.value = info.root;
          setNotice(t('switchBlocked'));
          return;
        }
        if (state && state.dirty && typeof globalThis.confirm === 'function' && !globalThis.confirm(t('switchConfirm'))) {
          event.target.value = info.root;
          return;
        }
        setSwitching(true);
        setNotice('');
        setError('');
        try {
          const value = await hostCall({ action: 'setWorkspace', path: target });
          infoRef.current = { ...(infoRef.current || {}), ...value };
          setInfo((current) => ({ ...(current || {}), ...value, running: false }));
          setNotice(format(t('switched'), { path: target }));
        } catch (failure) {
          setError(failure.message || String(failure));
        } finally {
          setSwitching(false);
        }
      }

      async function restoreProject() {
        if (!info || restoring) return;
        setRestoring(true);
        setNotice('');
        try {
          const value = await hostCall({ action: 'lastProject', root: info.root });
          if (!value || !value.project) { setNotice(t('noProject')); return; }
          if (!runtimeRef.current || typeof runtimeRef.current.restoreProject !== 'function') throw new Error('workbench not ready');
          runtimeRef.current.restoreProject(value.project);
          setNotice(t('restored'));
        } catch (failure) {
          setError(failure.message || String(failure));
        } finally {
          setRestoring(false);
        }
      }

      async function copyAgentNote() {
        if (!info) return;
        const text = format(t('agentPrompt'), { root: info.root, dataDir: info.dataDir });
        try {
          await navigator.clipboard.writeText(text);
          setNotice(t('copied'));
        } catch {
          setNotice(t('copyFailed') + '\n' + text);
        }
      }

      async function changeView(name) {
        setView(name);
        try {
          if (runtimeRef.current && typeof runtimeRef.current.changeView === 'function') await runtimeRef.current.changeView(name);
        } catch (failure) {
          setError(failure.message || String(failure));
        }
      }

      const workspaces = info && Array.isArray(info.workspaces) ? info.workspaces : [];
      const options = workspaces.map((workspace) => h('option', {
        key: workspace.path, value: workspace.path, title: workspace.path,
      }, workspace.title || workspace.path));
      const shortPath = info && info.dataDir ? info.dataDir.replace(/^.*?([^/\\]+[\\/][^/\\]+)$/, '$1') : '';
      const dotState = error || serviceReady === false ? 'error' : serviceReady ? 'ready' : '';
      const showLoading = !error && (!info || serviceReady === null);
      const views = [
        ['workspace', t('viewWorkspace')],
        ['spectra', t('viewSpectra')],
        ['records', t('viewRecords')],
      ];

      return h('div', { className: 'cvx-panel' },
        h('style', null, TOOLBAR_CSS),
        h('div', { className: 'cvx-bar' },
          h('div', { className: 'cvx-bar-left' },
            h('span', { className: 'cvx-dot', 'data-state': dotState, title: serviceReady === false ? t('serviceDown') : t('serviceHint') }),
            h('span', { className: 'cvx-title' }, t('title')),
            h('div', { className: 'cvx-tabs', role: 'tablist', 'aria-label': t('viewsLabel'), ref: tabsRef },
              h('span', {
                key: 'indicator', className: 'cvx-tab-indicator', 'aria-hidden': 'true',
                style: { width: indicator.width ? indicator.width + 'px' : '0px', transform: 'translateX(' + indicator.left + 'px)', opacity: indicator.width ? 1 : 0 },
              }),
              views.map(([id, label]) => h('button', {
                key: id, type: 'button', role: 'tab', className: 'cvx-tab',
                'data-active': String(view === id), 'aria-selected': String(view === id),
                onClick: () => { void changeView(id); },
              }, label))
            ),
            h('label', { className: 'cvx-ws' }, t('workspace'),
              h('select', {
                value: info && info.root ? info.root : '',
                onChange: switchWorkspace,
                disabled: !info || switching,
                'aria-label': t('workspace'),
              }, options.length ? options : [h('option', { key: '__none', value: '' }, t('noWorkspace'))])
            )
          ),
          h('div', { className: 'cvx-bar-right' },
            h('span', { className: 'cvx-binding', title: info && info.dataDir ? info.dataDir : '' }, shortPath ? format(t('boundTo'), { path: shortPath }) : ''),
            h('button', { type: 'button', className: 'cvx-action', onClick: restoreProject, disabled: !info || restoring }, t('restore')),
            h('button', { type: 'button', className: 'cvx-action', onClick: copyAgentNote, disabled: !info }, t('copyAgent')),
            serviceReady === false ? h('button', { type: 'button', className: 'cvx-action', onClick: retryRuntime }, t('retry')) : null
          )
        ),
        error ? h('div', { className: 'cvx-error', role: 'alert' },
          h('span', null, error),
          h('button', { type: 'button', onClick: retryRuntime }, t('retry'))
        ) : null,
        notice ? h('div', { className: 'cvx-notice', role: 'status', 'aria-live': 'polite' }, notice) : null,
        h('div', { className: 'cvx-stage' },
          h('div', { className: 'cvx-host', ref: hostRef, style: info ? undefined : { display: 'none' } }),
          showLoading ? h('div', { className: 'cvx-loading', role: 'status', 'aria-live': 'polite' },
            h('div', { className: 'cvx-loading-head' },
              h('span', { className: 'cvx-loading-label' }, t('loading')),
              h('span', { className: 'cvx-skel cvx-skel-pill' })
            ),
            h('div', { className: 'cvx-loading-grid' },
              h('div', { className: 'cvx-skel cvx-skel-panel' }),
              h('div', { className: 'cvx-loading-main' },
                h('div', { className: 'cvx-skel cvx-skel-chart' }),
                h('div', { className: 'cvx-skel cvx-skel-chart' })
              )
            )
          ) : null
        )
      );
    }

    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, STRINGS));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'convolvex-ms-workbench',
          order: 38,
          label: () => ctx.locale.bind(NS)('title'),
        }, PanelIcon));
        ctx.slots.inject('main', () => {
          const BoundPanel = (panelProps) => h(PanelBoundary, null,
            h(WorkbenchPanel, Object.assign({}, panelProps, { ctx })));
          return ctx.slots.register({
            name: 'main',
            key: 'convolvex-ms-workbench',
          }, BoundPanel);
        });
      },
    };
  },
});
`;

await writeFile(path.join(here, 'client.js'), wrapper, 'utf8');
console.log('client.js written:', Buffer.byteLength(wrapper, 'utf8'), 'bytes');
