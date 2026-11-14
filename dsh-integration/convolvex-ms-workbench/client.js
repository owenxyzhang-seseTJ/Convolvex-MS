window.__ModuleLoader__.load({
  id: "dsh-convolvex-ms-workbench",
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useLayoutEffect, useMemo, useRef, useState } = React;
    const NS = 'convolvex-ms-workbench';
    const CHANNEL = '/convolvex-ms-workbench';
    const CSS = ":host {\n  --canvas:#f4f3f0; --surface:#fff; --ink:#25272b; --muted:#50545b; --line:#dedfdb;\n  --accent:#303236; --accent-hover:#191b1e; --accent-soft:#eeece9; --success:#43715d;\n  --radius:12px; --shadow:0 1px 3px #44474d03;\n  --mono:\"SFMono-Regular\",Consolas,\"Liberation Mono\",monospace;\n  font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",Inter,\"Segoe UI\",\"Noto Sans SC\",\"Microsoft YaHei\",sans-serif;\n  color:var(--ink); font-size:16px; font-synthesis:none; -webkit-font-smoothing:antialiased;\n}\n* { box-sizing:border-box; }\n:host { margin:0; background:var(--canvas); }\nbutton,input,select,textarea { font:inherit; }\nbutton { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:40px; padding:0 15px; color:#44474d; background:#ffffffb3; border:1px solid #dfdfdb; border-radius:11px; cursor:pointer; font-weight:500; white-space:nowrap; transition:background .18s,border-color .18s,box-shadow .18s,color .18s; }\nbutton:hover { background:#f7f9fc; border-color:#93958f; color:var(--ink); }\nbutton:disabled { opacity:.42; cursor:not-allowed; }\nbutton:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible,a:focus-visible { outline:3px solid #6a6d73; outline-offset:3px; }\n.icon { display:inline-block; width:18px; height:18px; flex:none; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; vertical-align:middle; }\nbutton .icon { width:15px; height:15px; }\n.icon-definitions { position:absolute; width:0; height:0; overflow:hidden; }\n.primary { background:var(--accent); color:#fff; border-color:var(--accent); padding:0 20px; }\n.primary:hover { background:var(--accent-hover); border-color:var(--accent-hover); color:#fff; }\n.primary .icon { fill:currentColor; width:13px; height:13px; stroke-width:1.3; }\n.primary kbd { margin-left:12px; border:0; background:#ffffff22; color:#fff; font-size:14px; padding:2px 5px; }\n.danger { color:#b94d53; border-color:#efd9db; background:#fff8f8; }\n.plain { min-height:26px; padding:2px 0; border:0; background:transparent; color:var(--accent); font-size:14px; }\n.plain:hover { background:transparent; color:var(--accent-hover); }\n.icon-button { padding:0; width:30px; min-height:30px; border-color:transparent; background:transparent; color:var(--muted); }\n.icon-button:hover { border-color:var(--line); }\n.sr-only { position:absolute; width:1px; height:1px; padding:0; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }\n.skip-link { position:fixed; top:10px; left:88px; background:var(--accent); color:white; padding:12px; z-index:100; border-radius:6px; transform:translateY(-150%); visibility:hidden; }\n.skip-link:focus { transform:none; visibility:visible; }\n.hidden { display:none!important; }\n/* Keep the scroll gutter stable; reveal the thumb only during scrolling. */\n* { scrollbar-width:thin; scrollbar-color:transparent transparent; }\n*::-webkit-scrollbar { width:6px; height:6px; }\n*::-webkit-scrollbar-track { background:transparent; }\n*::-webkit-scrollbar-thumb { background:transparent; border-radius:8px; transition:background-color .16s; }\n*.is-scrolling { scrollbar-color:#aeb1aa transparent; }\n*.is-scrolling::-webkit-scrollbar-thumb,*::-webkit-scrollbar-thumb:active { background:#aeb1aa; }\n.mono { font-family:var(--mono); }\n\n/* Translucent navigation and toolbar share the selected light visual direction. */\n.sidebar { position:fixed; inset:0 auto 0 0; width:196px; padding:27px 16px 26px; display:flex; flex-direction:column; background:#f1f0ed; border-right:1px solid #dedfdb; z-index:30; }\n.brand { display:flex; align-items:center; gap:10px; margin:0 7px 48px; height:38px; color:#25272b; text-decoration:none; font-family:\"Avenir Next\",Avenir,\"Segoe UI Variable Display\",\"Helvetica Neue\",sans-serif; font-size:19px; font-weight:600; letter-spacing:-.65px; }\n.brand .icon { width:33px; height:30px; padding:0; stroke-width:1.9; color:#303236; background:none; border:0; border-radius:0; box-shadow:none; }\n.sidebar nav { width:100%; display:grid; gap:10px; }\n.nav { width:100%; min-height:44px; display:flex; flex-direction:row; align-items:center; justify-content:flex-start; gap:12px; padding:0 15px; background:transparent; border:1px solid transparent; color:#44474d; border-radius:8px; font-size:14px; position:relative; }\n.nav .icon { width:18px; height:18px; stroke-width:1.6; }\n.nav:hover { color:#44474d; background:#ffffff8c; }\n.nav.active { color:#272a2f; background:#e4e3df; border-color:transparent; }\n.nav.active::before { display:none; }\n.sidebar-bottom { margin-top:auto; display:grid; gap:16px; justify-items:start; }\n.rail-status { display:flex; align-items:center; gap:8px; padding-left:15px; color:#44474d; font-size:14px; }\n.rail-status i { width:6px; height:6px; border-radius:50%; background:#44474d; }\n.rail-status i.online { background:#6cbd9d; box-shadow:0 0 0 4px #6cbd9d12; }\n.version { font:13px var(--mono); color:#44474d; padding-left:15px; }\n.shell { margin-left:196px; min-height:100vh; display:flex; flex-direction:column; }\n.topbar { height:70px; padding:0 36px; display:flex; align-items:center; justify-content:space-between; gap:20px; background:#f8f7f5; border-bottom:1px solid #dedfdb; }\n.product-title { display:flex; align-items:center; gap:16px; font-size:14px; font-weight:500; color:#60646b; }\n.product-divider { width:1px; height:13px; background:#dfdfdb; }\n.breadcrumb { display:flex; align-items:center; gap:12px; font-size:14px; color:#6a6d73; }\n.breadcrumb .icon { width:11px; height:11px; color:#44474d; }\n.breadcrumb b { color:#44474d; font-weight:500; }\n.top-actions { display:flex; align-items:center; gap:10px; }\n.top-actions button { font-size:16px; }\n.action-divider { width:1px; height:22px; margin:0 6px; background:var(--line); }\nmain { padding:32px 36px 28px; width:100%; max-width:1840px; margin:0 auto; flex:1; }\n.page-heading { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:30px; }\n.eyebrow { font:13px var(--mono); font-weight:500; letter-spacing:1.65px; color:#44474d; margin-bottom:8px; }\nh1 { margin:0; font-size:32px; line-height:1.4; font-weight:600; letter-spacing:-.5px; color:#25272b; }\n.title-dot { width:6px; height:6px; background:var(--accent); border-radius:50%; }\n.page-heading p { color:#5c6169; font-size:16px; margin:9px 0 0; line-height:1.7; }\n.tags { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }\n.tag { display:inline-flex; align-items:center; font-size:14px; letter-spacing:.2px; font-weight:400; color:#44474d; border:1px solid #dfdfdb; padding:7px 12px; border-radius:20px; background:#ffffff66; }\n.tag.accent { color:#44474d; border-color:#dfdfdb; background:#f8fafc; }\n.work-grid { display:grid; grid-template-columns:286px minmax(0,1fr); gap:26px; align-items:start; }\n.panel { background:var(--surface); border:1px solid #dfdfdb; border-radius:var(--radius); box-shadow:var(--shadow); min-width:0; }\n.panel-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:18px; }\nh2,h3 { margin:0; font-size:14px; line-height:1.5; font-weight:600; }\n.configuration-panel { overflow:hidden; }\n.configuration-heading { height:59px; display:flex; align-items:center; justify-content:space-between; padding:0 22px; border-bottom:1px solid #dfdfdb; }\n.configuration-heading>div { display:flex; gap:10px; align-items:center; }\n.configuration-heading>div>.icon { width:16px; height:16px; color:#6a6d73; }\n.controls { padding:0; border:0; margin:0; min-width:0; }\n.control-section { border-bottom:1px solid #f6f5f2; }\nsummary { cursor:pointer; list-style:none; }\nsummary::-webkit-details-marker { display:none; }\n.control-section>summary { display:flex; align-items:center; gap:10px; min-height:58px; padding:0 24px; }\n.control-section>summary:hover { background:#f8fafc80; }\n.step { display:grid; place-items:center; width:20px; height:20px; font:13px var(--mono); color:#44474d; }\n.control-section[open]>summary .step { color:#44474d; }\n.chevron { width:13px; height:13px; color:#44474d; transition:transform .18s; }\nsummary>.chevron { margin-left:auto; }\ndetails[open]>summary>.chevron { transform:rotate(90deg); }\n.section-meta { margin-left:auto; color:#44474d; font-size:14px; max-width:112px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.section-meta+.chevron { margin-left:0; }\n.control-body { padding:0 24px 24px; }\n.control-body label,dialog label { display:flex; flex-direction:column; gap:7px; margin-bottom:14px; color:#44474d; font-size:14px; line-height:1.4; }\ninput:not([type=checkbox]),select { width:100%; min-width:0; height:40px; padding:0 11px; color:#44474d; background:#f5f7fa99; border:1px solid #f6f5f2; border-radius:9px; font-size:14px; transition:border-color .15s,background .15s; }\ninput:not([type=checkbox]):hover,select:hover { border-color:#93958f; }\ninput:focus,select:focus { border-color:#6a6d73; }\ninput:disabled,select:disabled { background:#f5f7fa; color:#44474d; cursor:not-allowed; border-color:#f6f5f2; }\ninput[type=number] { font-family:var(--mono); font-size:14px; font-variant-numeric:tabular-nums; }\ninput:user-invalid { border-color:#ce7278; background:#fffafa; }\n.two-col { display:grid; grid-template-columns:1fr 1fr; gap:10px; }\n.input-action { display:flex; gap:7px; }\n.input-action select { flex:1; }\n.input-action button { min-height:40px; padding:0 10px; font-size:14px; color:#6a6d73; background:#f6f5f2bb; border-color:#dfdfdb; border-radius:9px; }\n.file-drop { display:flex; flex-direction:column; gap:10px; width:100%; padding:20px 14px; background:#fafbfd; border:1px dashed #dfdfdb; min-height:148px; text-align:center; justify-content:center; border-radius:9px; }\n.file-drop:hover,.file-drop.dragging { background:#f6f5f2; border-color:#6a6d73; }\n.file-icon { width:32px; height:32px; display:grid; place-items:center; color:#44474d; }\n.file-icon .icon { width:22px; height:22px; }\n.file-description { display:flex; flex-direction:column; align-items:center; gap:8px; min-width:0; }\n.file-description b { font-size:16px; font-weight:500; color:#444950; max-width:205px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.file-description>span { font-size:14px; color:#626974; }\n.file-type { color:#69707a; font-size:13px; letter-spacing:0; margin:0; }\n.mini-heading { display:flex; align-items:center; justify-content:space-between; color:var(--muted); font-size:14px; }\n.mini-heading i { margin-left:4px; font-family:Georgia,serif; color:#44474d; }\n.kernel-box { background:#fafbfd; border:1px solid #f6f5f2; border-radius:7px; padding:4px 10px 0; }\n.kernel-box svg { width:100%; height:66px; display:block; }\n.kernel-box .plain { font-size:14px; }\n.check { flex-direction:row!important; align-items:center; gap:7px!important; color:#44474d!important; margin-bottom:15px!important; }\n.check input { margin:0; width:14px; height:14px; accent-color:var(--accent); }\n.field-hint { margin-left:auto; color:#44474d; font:13px var(--mono); }\n.advanced-settings { border-top:1px solid #f6f5f2; padding-top:10px; }\n.advanced-settings>summary { display:flex; align-items:center; gap:7px; color:#44474d; font-size:14px; min-height:20px; }\n.advanced-body { padding-top:14px; }\n.advanced-body .two-col:last-child label { margin-bottom:0; }\n.configuration-foot { display:flex; align-items:center; justify-content:space-between; padding:16px 22px; background:#fafaf8; font-size:14px; color:#59616c; }\n#configState { display:inline-flex; align-items:center; gap:6px; }\n#configState i { width:5px; height:5px; background:#68a88f; border-radius:50%; }\n.configuration-foot>.mono { font-size:14px; letter-spacing:.7px; color:#44474d; }\n.configuration-note { display:none; }\n.configuration-note .icon { width:12px; height:12px; margin-top:3px; }\n\n/* Chart hierarchy and metric typography share one restrained visual language. */\n.analysis { display:flex; flex-direction:column; gap:0; min-width:0; background:#fff; border:1px solid #dfdfdb; border-radius:12px; overflow:hidden; }\n.metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:0; padding:22px 0; border-bottom:1px solid #dfdfdb; }\n.metric { min-width:0; padding:0 23px; border-right:1px solid #dfdfdb; }\n.metric:last-child { border:0; }\n.metric-label { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:14px; color:#555b64; }\n.metric-label .icon { width:14px; height:14px; color:#44474d; }\n.metric strong { display:block; margin:14px 0 10px; font:29px/1 var(--mono); letter-spacing:-.7px; color:#30343a; overflow-wrap:anywhere; }\n.metric .status-value { font-family:inherit; font-size:24px; font-weight:500; letter-spacing:0; color:#5d636d; line-height:29px; }\n.metric-caption { display:block; font-size:14px; line-height:1.4; color:#44474d; }\n.status-metric { background:transparent; }\n.status-indicator { width:6px; height:6px; border-radius:50%; background:#93958f; }\n.status-value[data-state=success] { color:var(--success); }\n.status-value[data-state=running] { color:var(--accent); }\n.status-value[data-state=warning] { color:#ba8741; }\n.status-value[data-state=error] { color:#be6269; }\n.status-metric:has([data-state=success]) .status-indicator { background:#4aab8b; }\n.status-metric:has([data-state=running]) .status-indicator { background:var(--accent); animation:pulse 1.3s ease-in-out infinite; }\n.status-metric:has([data-state=warning]) .status-indicator { background:#c99b5c; }\n.status-metric:has([data-state=error]) .status-indicator { background:#c96c73; }\n.signal-grid,.lower-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; min-width:0; }\n.chart-panel { padding:24px 26px 20px; border:0; border-radius:0; box-shadow:none; background:transparent; }\n.chart-panel .panel-heading { margin-bottom:16px; min-height:34px; }\n.chart-title { display:flex; align-items:center; gap:9px; }\n.chart-icon { display:none; }\n.chart-icon .icon { width:17px; height:17px; }\n.chart-icon.warm { display:none; }\n.chart-title h2 { font-size:16px; font-weight:500; color:#4c535d; }\n.chart-title>div>span { display:none; }\n.chart-tools { display:flex; align-items:center; gap:7px; }\n.compact { display:flex; align-items:center; gap:6px; font-size:14px; color:#44474d; white-space:nowrap; }\n.compact select { width:39px; height:26px; padding:0 4px; font-size:14px; background:#fcfdff; }\n.chart-tools>select { width:auto; max-width:74px; height:27px; font-size:14px; padding:0 5px; }\n.chart-tools .icon-button { width:26px; min-height:26px; }\n.chart-tools .icon-button .icon { width:13px; height:13px; }\n.plot { width:100%; height:340px; position:relative; overflow:hidden; }\n.plot>svg { width:100%; height:100%; display:block; }\n.plot.small { height:155px; }\n.plot canvas { height:100%; width:auto; max-width:calc(100% - 40px); object-fit:contain; display:block; margin:auto; image-rendering:pixelated; }\n.chart-bottom { display:flex; align-items:center; justify-content:space-between; min-height:26px; gap:10px; }\n.legend { display:flex; flex-wrap:wrap; align-items:center; gap:16px; font-size:14px; color:#6a6d73; min-height:18px; }\n.legend i { display:inline-block; width:15px; border-top:2px solid; margin-right:6px; vertical-align:middle; border-radius:2px; }\n.legend .dash { border-top-style:dashed; }\n.plot-hint { font-size:14px; color:#44474d; }\n.secondary-chart { padding:22px 22px 16px; }\n.secondary-chart .panel-heading { margin-bottom:10px; }\n.secondary-chart h2 { font-size:14px; display:flex; align-items:center; gap:8px; color:#44474d; }\n.chart-dot { width:5px; height:5px; border-radius:50%; background:#6a6d73; }\n.chart-dot.amber { background:#c9a274; }\n.notation { font:italic 12px Georgia,serif; color:#44474d; }\n.empty-state { height:100%; display:flex; flex-direction:column; gap:12px; align-items:center; justify-content:center; color:#6a6d73; }\n.empty-state .icon { width:24px; height:24px; color:#44474d; stroke-width:1.2; background:#fff; box-shadow:0 0 0 10px #fff; }\n.empty-state span { font-size:14px; }\n.diagnostic { display:flex; align-items:center; gap:28px; flex-wrap:wrap; padding:22px 24px; }\n.diagnostic-heading { display:flex; align-items:center; gap:7px; color:#44474d; }\n.diagnostic-heading .icon { width:14px; height:14px; color:#44474d; }\n.diagnostic-heading h2 { font-size:14px; color:#44474d; }\n.diagnostic-grid { flex:1; display:grid; grid-template-columns:1fr 1fr 1.5fr; gap:24px; min-width:0; }\n.diagnostic-grid>div { display:flex; flex-direction:column; gap:7px; min-width:0; }\n.diagnostic-grid span { font-size:14px; color:#44474d; }\n.diagnostic-grid b { font:13px var(--mono); color:#44474d; overflow:hidden; text-overflow:ellipsis; }\n#warningBox { flex-basis:100%; border-top:1px solid #f0e7d9; padding-top:12px; color:#ac864e; font-size:14px; line-height:1.7; }\n.tooltip { position:absolute; max-width:calc(100% - 16px); overflow-wrap:anywhere; padding:9px 11px; background:#fff; border:1px solid #dfdfdb; border-radius:6px; box-shadow:0 4px 16px #44474d0e; color:#44474d; font:13px/1.6 var(--mono); pointer-events:none; z-index:5; }\n.heat-scale { position:absolute; right:8px; top:14px; bottom:24px; display:flex; flex-direction:column-reverse; align-items:center; gap:5px; font:13px var(--mono); color:#44474d; pointer-events:none; }\n.heat-scale i { width:6px; flex:1; min-height:40px; background:linear-gradient(to top,#f9f7f4,#7d4f5a); border-radius:4px; }\nfooter { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 36px 24px; color:#44474d; font-size:14px; }\n.footer-state { display:inline-flex; align-items:center; gap:7px; font:13px var(--mono); letter-spacing:.5px; }\n.footer-state i { width:4px; height:4px; background:#93958f; border-radius:50%; }\n.footer-help { display:flex; align-items:center; gap:7px; }\nkbd { font:inherit; color:inherit; border:0; border-radius:0; padding:0; background:none; }\n.footer-divider { height:9px; width:1px; background:#dfdfdb; margin:0 6px; }\n\n.table-panel,.benchmark-detail { padding:23px; }\n.table-scroll { overflow:auto; }\ntable { width:100%; border-collapse:collapse; font-size:14px; font-variant-numeric:tabular-nums; }\nth { padding:15px 12px; text-align:left; font-size:14px; color:#44474d; font-weight:500; border-bottom:1px solid var(--line); white-space:nowrap; }\ntd { padding:17px 12px; border-bottom:1px solid #f6f5f2; color:#44474d; }\ntbody tr:last-child td { border:0; }\ntbody tr:hover { background:#fafbfd; }\ntd button { font-size:14px; min-height:28px; padding:0 10px; }\n.record-status { display:inline-flex; gap:6px; align-items:center; font-size:14px; padding:4px 7px; border-radius:4px; background:#f6f5f2; color:#6a6d73; }\n.record-status.completed { color:#3c9276; background:#edf8f3; }\n.record-status.failed,.record-status.interrupted { color:#be6f74; background:#fff1f1; }\n.record-status.running,.record-status.queued { color:#44474d; background:#f6f5f2; }\n.benchmark-detail { margin-top:20px; }\n.reference-notice { display:flex; align-items:center; gap:8px; color:#6a6d73; font-size:14px; margin-bottom:20px; }\n.reference-notice .icon { width:15px; height:15px; }\npre { overflow:auto; white-space:pre-wrap; font:13px/1.9 var(--mono); color:#44474d; }\ndialog { border:1px solid #fff; border-radius:22px; box-shadow:0 30px 100px #44474d24; width:min(850px,92vw); padding:30px; color:var(--ink); background:#fffffff0; backdrop-filter:blur(24px); }\ndialog::backdrop { background:#44474d38; backdrop-filter:blur(9px); }\ndialog .panel-heading { margin-bottom:20px; }\ndialog .eyebrow { margin-bottom:4px; }\ndialog textarea { width:100%; height:55vh; resize:vertical; padding:18px; border:1px solid #dfdfdb; border-radius:8px; background:#f8fafc; color:#44474d; font:13px/1.8 var(--mono); tab-size:2; }\n.dialog-description { color:#44474d; font-size:14px; line-height:1.7; margin:0 0 22px; }\n#csvDialog { max-width:470px; }\n.dialog-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:18px; }\n.dialog-actions>span { margin-right:auto; color:#b96c74; font-size:14px; overflow-wrap:anywhere; }\n.toast { position:fixed; bottom:28px; right:28px; display:flex; align-items:center; gap:16px; max-width:min(520px,calc(100vw - 32px)); color:#fff; background:#44474d; border:1px solid #ffffff15; padding:12px 12px 12px 18px; border-radius:10px; box-shadow:0 8px 32px #44474d24; z-index:100; font-size:14px; line-height:1.7; }\n.toast .icon-button { color:#fff; flex:none; }\n.toast .icon-button:hover { border-color:#ffffff22; background:#ffffff0d; }\n.busy-icon { animation:spin 1s linear infinite; }\n@keyframes pulse { 50% { opacity:.35; } }\n@keyframes spin { to { transform:rotate(360deg); } }\n\n@media (min-width:1650px) {\n  .work-grid { grid-template-columns:300px minmax(0,1fr); gap:24px; }\n  .plot { height:280px; } .plot.small { height:180px; }\n}\n@media (max-width:1250px) {\n  .product-divider,.breadcrumb { display:none; }\n  main { padding:24px 22px 20px; } .topbar { padding:0 22px; }\n  .work-grid { grid-template-columns:255px minmax(0,1fr); gap:16px; }\n  .metric { padding:15px 13px; } .metric strong { font-size:22px; }\n  .signal-grid { grid-template-columns:1fr; } .plot { height:215px; }\n  .chart-panel { padding:17px 18px 10px; } .diagnostic { gap:16px; }\n  .diagnostic-grid { gap:14px; } .diagnostic-grid>div:last-child { max-width:160px; }\n}\n@media (max-width:960px) {\n  .top-actions button { padding:0 10px; }\n  .top-actions button:not(.primary):not(.danger) .icon { display:none; }\n  .primary kbd { display:none; } .page-heading { align-items:flex-start; }\n  .tags { max-width:220px; justify-content:flex-end; padding-top:8px; }\n  .metrics { grid-template-columns:1fr 1fr; }\n  .lower-grid { grid-template-columns:1fr; }\n  .diagnostic { display:block; } .diagnostic-heading { margin-bottom:16px; }\n  .diagnostic-grid { gap:12px; } .diagnostic-grid>div:last-child { max-width:none; }\n  .configuration-note { font-size:14px; }\n}\n@media (max-width:700px) {\n  .sidebar { width:100%; height:64px; inset:auto 0 0; padding:5px 15px; flex-direction:row; justify-content:center; border:1px solid #fff; background:#f9fbffdc; box-shadow:0 -4px 24px #44474d05; }\n  .brand,.sidebar-bottom { display:none; }\n  .mobile-auth { display:inline-flex!important; margin-left:auto; }\n  .signal-grid,.lower-grid { grid-template-columns:1fr; }\n  .sidebar nav { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }\n  .nav { width:100%; min-height:47px; flex-direction:column; justify-content:center; padding:5px 0; gap:4px; font-size:14px; border-radius:10px; }\n  .nav .icon { width:17px; height:17px; } .nav.active::before { display:none; }\n  .shell { margin:0; padding-bottom:64px; }\n  .topbar { height:auto; min-height:60px; padding:13px 16px; flex-wrap:wrap; gap:13px; }\n  .product-title { width:100%; font-size:16px; justify-content:space-between; }\n  .breadcrumb { display:flex; font-size:14px; gap:8px; }\n  .top-actions { width:100%; gap:6px; }\n  .top-actions button { flex:1; font-size:14px; padding:0 7px; min-height:34px; }\n  .top-actions .primary { flex:1.4; } .top-actions .action-divider { display:none; }\n  main { padding:22px 16px 18px; }\n  .page-heading { flex-direction:column; gap:14px; margin-bottom:19px; }\n  .eyebrow { font-size:14px; } h1 { font-size:23px; } .page-heading p { font-size:14px; }\n  .tags { padding:0; max-width:none; justify-content:flex-start; } .tag { font-size:14px; }\n  .work-grid { grid-template-columns:1fr; gap:20px; }\n  .configuration-heading { height:51px; } .control-section>summary { min-height:48px; }\n  .control-body { padding:0 18px 16px; } .control-body>label { font-size:14px; }\n  .configuration-note { display:none; } .configuration-foot { padding:12px 18px; }\n  .metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }\n  .metric { padding:16px; } .metric strong { font-size:23px; margin-top:12px; }\n  .metric-label { font-size:14px; } .analysis,.signal-grid,.lower-grid { gap:14px; }\n  .chart-panel { padding:16px 13px 10px; } .plot { height:225px; } .plot.small { height:170px; }\n  .plot-hint { display:none; } .diagnostic { padding:17px; }\n  .diagnostic-grid { grid-template-columns:1fr 1fr; row-gap:18px; }\n  .diagnostic-grid>div:last-child { grid-column:1/-1; }\n  #warningBox { margin-top:16px; }\n  footer { padding:0 16px 18px; font-size:14px; } .footer-help { display:none; }\n  .table-panel,.benchmark-detail { padding:16px; }\n  dialog { padding:19px; width:calc(100vw - 24px); max-height:90dvh; }\n  dialog textarea { font-size:14px; } .dialog-actions { flex-wrap:wrap; }\n  .dialog-actions>span:not(:empty) { flex-basis:100%; }\n  .toast { bottom:72px; right:16px; left:16px; font-size:14px; }\n  .skip-link { left:16px; }\n}\n/* Keep secondary labels readable at the workstation's native scale. */\n.control-body label,dialog label { font-size:14px; color:#44474d; }\n.metric-label { font-size:14px; color:#44474d; }\n.metric-caption { font-size:14px; color:#44474d; }\n.chart-title h2 { font-size:16px; font-weight:500; }\n.chart-title>div>span { display:none; }\n.legend { font-size:14px; color:#44474d; }\n.secondary-chart h2,.diagnostic-heading h2 { font-size:14px; }\n.diagnostic-grid span { font-size:14px; color:#6a6d73; }\n.diagnostic-grid b { font-size:14px; color:#44474d; }\n.mobile-auth { display:none; }\n.technical-tag { display:none; }\n.primary kbd { display:none; }\n.configuration-heading h2 { font-size:17px; font-weight:500; color:#303236; }\n.preparation-dot { width:6px; height:6px; background:#93958f; border-radius:50%; }\n.beginner-tag { font-size:14px; color:#44474d; padding:4px 7px; border:1px solid #f6f5f2; border-radius:6px; }\n.basic-data { padding:22px; }\n.sample-button { width:100%; min-height:44px; margin-top:14px; justify-content:flex-start; color:#454b54; background:#fff; font-size:15px; border-radius:8px; }\n.sample-button .icon { width:13px; height:13px; color:#44474d; }\n.sample-button .icon:last-child { margin-left:auto; width:12px; height:12px; }\n.data-help { display:none; }\n.recommended-scheme { display:none; }\n.scheme-icon { display:grid; place-items:center; width:30px; height:32px; background:#f0f7f4; border:1px solid #e9f2ee; color:#44474d; border-radius:10px; }\n.scheme-icon .icon { width:16px; height:16px; }\n.recommended-scheme>div { display:flex; flex-direction:column; gap:7px; }\n.recommended-scheme>div>span { color:#44474d; font-size:14px; }\n.recommended-scheme strong { color:#44474d; font-size:15px; font-weight:500; }\n.recommended-scheme small { color:#44474d; font-size:14px; }\n.expert-settings>summary { display:flex; align-items:center; gap:10px; min-height:58px; padding:0 22px; color:#4c535d; font-size:15px; border-top:1px solid #e3e4e0; }\n.expert-settings>summary>.icon:first-child { width:16px; height:16px; color:#44474d; }\n.expert-settings[open]>summary { border-bottom:1px solid #f6f5f2; }\n.expert-settings>.expert-content { background:#fbfcfe66; }\n.expert-content h3 { font-size:14px; font-weight:500; }\n.advanced-task { padding:20px 24px 2px; border-bottom:1px solid #f6f5f2; }\n.advanced-task label { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; font-size:14px; color:#44474d; }\n.advanced-project { padding:16px 24px; }\n.advanced-project button { font-size:14px; color:#44474d; }\n.analysis-details>summary { display:flex; align-items:center; gap:10px; min-height:56px; padding:0 24px; border-top:1px solid #dfdfdb; background:#fafbfd; color:#44474d; font-size:14px; }\n.analysis-details>summary>.icon:first-child { color:#44474d; width:17px; height:17px; }\n.details-hint { font-size:14px; color:#6a6d73; margin-left:auto; }\n.analysis-details .chevron { margin-left:8px; }\n.analysis-details-body { display:flex; flex-direction:column; gap:16px; padding:20px; background:#f8fafc; border-top:1px solid #dfdfdb; }\n.project-menu { position:relative; }\n.project-menu>summary { display:flex; align-items:center; gap:7px; min-height:40px; padding:0 13px; font-size:14px; color:#44474d; }\n.project-menu>summary .icon { width:15px; height:15px; }\n.menu-popover { position:absolute; top:48px; right:0; z-index:40; width:210px; padding:7px; background:#fffffff5; border:1px solid #fff; border-radius:14px; box-shadow:0 12px 45px #44474d18; backdrop-filter:blur(24px); }\n.menu-popover button { justify-content:flex-start; width:100%; border:0; background:transparent; font-size:14px; }\n.menu-popover button:hover { background:#f6f5f2; }\n@media (min-width:701px) and (max-width:1050px) {\n  .sidebar { width:80px; padding:24px 10px; align-items:center; }\n  .brand { margin:0 0 38px; width:35px; }\n  .brand>span,.rail-status>span,.version { display:none; }\n  .nav { flex-direction:column; justify-content:center; min-height:60px; padding:8px 0; gap:6px; font-size:14px; }\n  .sidebar-bottom { justify-items:center; }\n  .rail-status { padding:0; }\n  .shell { margin-left:80px; }\n}\n@media (max-width:700px) {\n  h1 { font-size:28px; }\n  .page-heading p { font-size:14px; }\n  .project-menu>summary { padding:0 7px; font-size:14px; min-height:34px; }\n  .project-menu>summary .icon { display:none; }\n  .top-actions>.project-menu { flex:none; }\n  .basic-data { padding:20px; }\n  .recommended-scheme { margin:0 20px; }\n  .configuration-note { display:none; }\n  .details-hint { font-size:14px; }\n  .analysis-details>summary { padding:0 17px; gap:8px; }\n  .chart-title h2 { font-size:15px; }\n}\n\n/* A single analysis canvas keeps attention on data instead of decorative cards. */\n.signal-grid { display:block; }\n.metric-label .icon,.status-indicator { display:none; }\n.configuration-foot>.mono,.configuration-note,.chart-title>div>span { display:none; }\n.chart-title h2 { font-size:14px; }\n.legend { font-size:14px; color:#44474d; }\n.plot-hint { font-size:14px; color:#6a6d73; }\n.analysis .plot:not(.small) { height:340px; }\n.analysis-details .panel { border-radius:9px; box-shadow:none; }\n.analysis-details-body .plot.small { height:165px; }\n@media(max-width:700px) {\n  .analysis .plot:not(.small) { height:280px; }\n  .metrics { row-gap:23px; }\n  .metric { padding:0 18px; }\n  .metric:nth-child(2) { border-right:0; }\n  .configuration-note { display:none; }\n  .chart-panel { padding:20px 14px 16px; }\n}\n\n\n/* Readability: dark neutral text, with color reserved for the plotted series. */\nbutton,input,select { font-size:16px; }\ninput:not([type=checkbox]),select { height:44px; color:#3f454e; background:#fbfbf9; border-color:#d9dcd8; }\ninput[type=number] { font-size:14px; }\n.control-body label,dialog label,.advanced-task label { color:#505762; font-size:14px; }\n.metric-label { color:#555b64; font-size:14px; }\n.metric-caption { color:#626975; font-size:14px; line-height:1.5; }\n.chart-title h2 { color:#454c57; font-size:16px; }\n.legend { color:#56606e; font-size:14px; }\n.plot-hint { color:#6e7682; font-size:13px; }\n.analysis-details>summary { color:#505a67; font-size:15px; }\n.details-hint { color:#68727f; font-size:14px; }\n.diagnostic-grid span { color:#5d6774; font-size:14px; }\n.diagnostic-grid b { color:#454f5e; font-size:14px; }\n@media(max-width:700px) {\n  .top-actions button { font-size:14px; }\n  .project-menu>summary { font-size:14px; }\n  .page-heading h1 { font-size:30px; }\n  .page-heading p { font-size:15px; }\n  .details-hint { display:none; }\n}\n\n\n/* Both scientific panes use identical header, plotting, and legend dimensions. */\n.signal-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0; }\n.chart-panel { display:grid; grid-template-rows:38px 340px 32px; row-gap:16px; padding:24px 22px 20px; }\n.chart-panel+.chart-panel { border-left:1px solid #e3e4e0; }\n.chart-panel .panel-heading { height:38px; min-height:38px; margin:0; }\n.chart-panel .plot { height:340px; min-height:0; }\n.chart-bottom { height:32px; min-height:32px; }\n.chart-bottom .legend { min-height:32px; }\n@media(max-width:1250px) {\n  .signal-grid { grid-template-columns:minmax(0,1fr); }\n  .chart-panel+.chart-panel { border-left:0; border-top:0; box-shadow:inset 0 1px #e3e4e0; }\n}\n@media(max-width:700px) {\n  .chart-panel { grid-template-rows:38px 280px 32px; padding:20px 14px 16px; }\n  .chart-panel .plot { height:280px; }\n}\n\n\n/* The data tools and the analysis canvas belong to one full-height workspace. */\n@media(min-width:1001px) {\n:host { overflow:hidden; }\n  .shell { height:100dvh; min-height:0; }\n  main { flex:1; min-height:0; padding:20px 24px; overflow:hidden; }\n  .view { height:100%; overflow:auto; }\n  #workspace { overflow:visible; }\n  .work-grid { height:100%; min-height:0; grid-template-columns:280px minmax(0,1fr); gap:0; align-items:stretch; background:#fff; border:1px solid #d8dad6; border-radius:12px; overflow:hidden; }\n  .configuration-panel { height:100%; min-height:0; display:flex; flex-direction:column; border:0; border-right:1px solid #e0e2de; border-radius:0; box-shadow:none; overflow:hidden; }\n  .configuration-heading { flex:none; }\n  .controls { flex:1; min-height:0; overflow:auto; }\n  .configuration-foot { flex:none; min-height:56px; margin-top:auto; border-top:1px solid #e2e4e0; }\n  .analysis { height:100%; min-height:0; border:0; border-radius:0; overflow:auto; gap:0; }\n  .metrics { flex:none; }\n  .signal-grid { flex:1; min-height:390px; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); align-items:stretch; }\n  .chart-panel { height:100%; min-height:0; grid-template-rows:38px minmax(0,1fr) 32px; }\n  .analysis .chart-panel .plot { height:100%; }\n  .chart-panel+.chart-panel { border-left:1px solid #e3e4e0; border-top:0; box-shadow:none; }\n  .analysis-details { flex:none; }\n  .analysis-details-body { max-height:330px; overflow:auto; }\n  footer { flex:none; padding:0 24px 16px; min-height:30px; }\n}\n.metric strong { font-family:inherit; font-size:29px; font-weight:500; font-variant-numeric:tabular-nums; letter-spacing:-.4px; }\n\n\n/* DEMS data and reference spectra use the same quiet, neutral application chrome. */\n.ms-setup { border-top:1px solid #e2e4e0; padding:18px 22px; }\n.ms-data-summary { font-size:13px; line-height:1.8; color:#626975; margin-bottom:16px; }\n.ms-section-title { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:14px; color:#444a53; margin-bottom:9px; }\n.ms-section-title button { font-size:13px; }\n.species-list { display:grid; gap:4px; }\n.species-row { display:flex; align-items:center; justify-content:space-between; gap:6px; min-height:30px; color:#505762; font-size:14px; }\n.species-row>span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.species-row .icon-button { width:24px; min-height:24px; font-size:18px; color:#8b929c; }\n.ms-response-hint { font-size:13px; color:#737b87; line-height:1.7; margin:9px 0 4px; }\n.ms-setup>.plain { font-size:13px; }\n.chart-tools .compact select { width:auto; min-width:62px; max-width:155px; height:30px; font-size:14px; }\n.heat-scale i { background:linear-gradient(to top,#f9f7f4,#43474d); }\n#importDialog { width:min(930px,94vw); }\n#importDialog .panel-heading { align-items:flex-start; margin-bottom:16px; }\n#importSummary { font-size:14px; margin:7px 0 0; }\n.import-preview { max-height:290px; border:1px solid #e2e4e0; border-radius:8px; }\n.import-preview th,.import-preview td { font-size:13px; padding:10px 12px; white-space:nowrap; }\n.import-mapping { margin-top:18px; border-top:1px solid #e6e7e2; padding-top:15px; }\n.import-mapping>summary { display:flex; align-items:center; gap:10px; color:#5f6875; font-size:14px; }\n.mapping-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 18px; padding-top:18px; }\n.mapping-signals { grid-column:1/-1; color:#596372; font-size:14px; margin-bottom:16px; }\n.import-signals { display:flex; flex-wrap:wrap; gap:7px 18px; max-height:130px; overflow:auto; margin-top:10px; }\n.import-signals label { display:flex; flex-direction:row; align-items:center; gap:7px; margin:0; font-size:13px; }\n.import-signals input { accent-color:#43474d; width:15px; height:15px; }\n.library-shell { height:100%; min-height:0; display:flex; flex-direction:column; padding:22px 24px; border:1px solid #d8dad6; border-radius:12px; background:#fff; overflow:hidden; }\n.library-shell>.panel-heading { flex:none; align-items:flex-start; margin-bottom:20px; }\n.library-shell h2 { font-size:21px; font-weight:600; color:#30343a; }\n.library-shell .dialog-description { font-size:14px; margin:6px 0 0; color:#737b87; }\n.spectrum-search { display:flex; gap:10px; flex:none; padding-bottom:20px; }\n.spectrum-search input { flex:1; min-width:0; font-size:15px; }\n.spectrum-search button { flex:none; font-size:14px; }\n.library-grid { display:grid; grid-template-columns:270px minmax(0,1fr); flex:1; min-height:0; gap:24px; border-top:1px solid #e4e6e0; padding-top:20px; }\n.catalog-pane { min-height:0; display:flex; flex-direction:column; border-right:1px solid #e5e7e1; padding-right:18px; }\n.catalog-filters { display:grid; grid-template-columns:1fr 1fr; gap:6px; flex:none; margin-bottom:12px; }\n.catalog-filters button { min-height:34px; padding:0 8px; font-size:13px; border:0; color:#6c7582; background:#f6f6f3; border-radius:6px; }\n.catalog-filters button.selected { color:#30343a; background:#e8e9e3; }\n.compound-catalog { min-height:0; overflow:auto; }\n.compound-entry { width:100%; min-height:58px; display:grid; grid-template-columns:82px minmax(0,1fr); gap:4px 8px; justify-content:flex-start; padding:9px 6px; text-align:left; border:0; border-bottom:1px solid #eff0ec; border-radius:0; background:transparent; }\n.compound-entry strong { color:#3f4752; font-size:16px; font-weight:500; }\n.compound-entry>span { white-space:normal; color:#67717f; font-size:13px; }\n.compound-entry>small { grid-column:2; font-size:12px; color:#858d98; }\n.reference-pane { min-width:0; min-height:0; display:flex; flex-direction:column; }\n.spectrum-status { flex:none; font-size:16px; color:#444c58; line-height:1.5; margin:5px 0 12px; }\n.spectrum-choices { display:flex; flex-wrap:wrap; gap:7px; max-height:120px; overflow:auto; }\n.spectrum-choices button { font-size:14px; }\n.reference-plot { flex:1; min-height:280px; max-height:480px; position:relative; }\n.reference-plot>svg { display:block; width:100%; height:100%; }\n.spectrum-source { flex:none; font-size:13px; color:#6c7583; line-height:1.7; padding-top:14px; }\n.spectrum-source>a { margin-left:18px; color:#4a607b; text-underline-offset:3px; }\n.spectrum-source p { margin:7px 0; }\n.reference-pane .dialog-actions { flex:none; margin-top:10px; padding-top:12px; border-top:1px solid #e4e6e0; }\n.reference-pane .dialog-actions button { font-size:14px; }\n@media(max-width:1000px) {\n  .library-shell { min-height:750px; height:auto; }\n  .library-grid { grid-template-columns:220px minmax(0,1fr); }\n  .reference-plot { height:340px; flex:none; }\n}\n@media(max-width:700px) {\n  .sidebar nav { grid-template-columns:repeat(3,1fr); }\n  .library-shell { padding:17px 14px; }\n  .spectrum-search { flex-wrap:wrap; }\n  .spectrum-search input { flex-basis:100%; }\n  .spectrum-search button { flex:1; }\n  .library-grid { grid-template-columns:1fr; gap:20px; }\n  .catalog-pane { max-height:260px; padding:0 0 12px; border:0; border-bottom:1px solid #e5e7e1; }\n  .catalog-filters { grid-template-columns:repeat(3,minmax(0,1fr)); }\n  .catalog-filters button { font-size:12px; padding:0 3px; }\n  .compound-catalog { display:grid; grid-template-columns:1fr 1fr; }\n  .compound-entry { grid-template-columns:1fr; align-content:start; min-height:80px; }\n  .compound-entry>small { grid-column:1; }\n  .mapping-grid { grid-template-columns:1fr; }\n  .ms-data-summary { font-size:14px; }\n}\n\n.analysis-tabs { display:flex; flex:none; gap:26px; padding:0 24px; border-bottom:1px solid #e1e3de; }\n.analysis-tabs button { min-height:47px; padding:0; border:0; border-radius:0; background:none; color:#62666d; font-size:15px; border-bottom:2px solid transparent; }\n.analysis-tabs button[aria-selected=\"true\"] { border-bottom-color:#34373b; color:#25272b; font-weight:600; }\n.dems-view { min-height:0; flex:1; padding:22px 24px; overflow:auto; color:#30343a; }\n.dems-heading { display:flex; align-items:center; justify-content:space-between; gap:14px; margin:0 0 12px; }\n.dems-heading h2 { font-size:19px; font-weight:600; }\n.dems-heading h3 { font-size:16px; font-weight:600; margin:0; }\n.dems-heading>span { font-size:13px; color:#50545b; }\n.dems-heading>strong { font-size:17px; font-weight:500; white-space:nowrap; }\n.dems-heading>.plain { font-size:14px; }\n.dems-note { font-size:14px; line-height:1.7; color:#555b64; margin:8px 0 16px; overflow-wrap:anywhere; }\n.dems-workflow { font-size:14px; line-height:1.8; color:#50545b; padding-bottom:13px; border-bottom:1px solid #e5e6e1; margin:0 0 12px; }\n.spectrum-name-label { display:flex; align-items:center; gap:12px; font-size:14px; color:#454b54; padding-top:10px; flex:none; }\n.spectrum-name-label input { flex:1; min-width:0; height:36px; font-size:15px; }\n.dems-controls { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:2px 14px; }\n.dems-controls label,.dems-query label { color:#42474f; font-size:14px; min-width:0; }\n.dems-controls input,.dems-controls select,.dems-query input,.dems-query select { font-size:15px; min-height:40px; width:100%; }\n#demsForm > .dems-controls { row-gap:16px; margin-bottom:18px; }\n#demsForm > .dems-controls > label,.dems-query label { display:flex; flex-direction:column; gap:7px; margin:0; }\n.dems-query { display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap; margin-bottom:18px; }\n.dems-query label { flex:1; min-width:125px; }\n.dems-query>button { height:44px; min-height:44px; margin:0; }\n.dems-advanced { margin:3px 0 16px; padding:14px 0; border-top:1px solid #e4e5e1; border-bottom:1px solid #e4e5e1; }\n.dems-advanced>summary { display:flex; gap:10px; align-items:center; font-size:14px; color:#454b54; }\n.dems-advanced>summary>.icon { margin-left:auto; }\n.dems-advanced>.dems-controls { padding-top:20px; }\n.dems-advanced .check { font-size:14px; line-height:1.6; margin-bottom:10px; }\n.dems-calibration { margin-top:20px; padding-top:16px; border-top:1px solid #e4e5e1; }\n.dems-calibration>summary { font-size:15px; font-weight:500; }\n.dems-calibration>button { font-size:14px; }\n.dems-charge-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); padding:18px 0; margin:0 0 22px; border-bottom:1px solid #e0e2dd; gap:20px; }\n.dems-charge-metrics>div { display:flex; flex-direction:column; gap:8px; min-width:0; }\n.dems-charge-metrics span { font-size:14px; color:#4d535c; }\n.dems-charge-metrics strong { font-size:25px; font-weight:500; letter-spacing:-.4px; }\n.dems-charge-metrics small { font-size:13px; line-height:1.6; color:#555b64; }\n.dems-plots { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:24px; margin-bottom:24px; }\n.dems-plots>section { min-width:0; }\n.dems-plots .dems-heading { flex-wrap:wrap; min-height:41px; }\n.dems-plot { height:250px; position:relative; }\n.dems-plot>svg { display:block; width:100%; height:100%; }\n#demsResults>.table-scroll { margin-bottom:24px; }\n#demsResults th,#demsResults td { font-size:14px; padding:11px 10px; white-space:nowrap; }\n.dems-warnings { font-size:13px; line-height:1.8; color:#555b64; padding-left:18px; }\n.dems-export { display:flex; justify-content:flex-end; gap:10px; padding:16px 0 4px; }\n.dems-export button { font-size:14px; }\n.dems-error { color:#77463b; font-size:14px; line-height:1.7; }\n.ms-data-summary,.ms-response-hint,.ms-setup>.plain,.ms-section-title button { font-size:14px; color:#555c66; }\n.catalog-filters button,.compound-entry>span,.spectrum-source { font-size:14px; color:#535b66; }\n.spectrum-source>a { color:#454b52; }\n@media(max-width:1300px) { .dems-controls { grid-template-columns:repeat(2,minmax(0,1fr)); } .dems-plots { grid-template-columns:1fr; } }\n@media(max-width:700px) {\n  .analysis-tabs { padding:0 16px; gap:20px; }\n  .dems-view { padding:20px 14px; }\n  .dems-charge-metrics { gap:10px; }\n  .dems-charge-metrics strong { font-size:21px; }\n  .dems-charge-metrics small { font-size:12px; }\n  .dems-query>button { flex:1; }\n  .dems-heading { flex-wrap:wrap; }\n  .dems-export { flex-wrap:wrap; }\n}\n@media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; transition:none!important; } }\n\n\n/* ---- DSH panel adaptations: the original page had no outer chrome. ---- */\n:host {\n  display: block;\n  position: relative;\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n  container-type: inline-size;\n  color-scheme: light;\n  background: #f4f3f0;\n  color: #25272b;\n  --canvas: #f4f3f0;\n  --surface: #ffffff;\n  --ink: #25272b;\n  --muted: #50545b;\n  --line: #dedfdb;\n  --accent: #303236;\n  --accent-hover: #191b1e;\n  --accent-soft: #eeece9;\n}\n/* The original workbench keeps its paper canvas; the DSH chrome above it\n   follows the host theme. Replacing a light document with a half-dark\n   approximation would make scientific labels unreadable. */\n.sidebar { display: none; }\n.shell { margin-left: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; }\n.topbar { height: 52px; padding: 0 18px; flex: none; justify-content: flex-end; background: #f8f7f5; border-bottom: 1px solid var(--line); overflow-x: auto; }\n.product-title { display: none; }\nmain { flex: 1; min-height: 0; overflow: auto; padding: 18px 20px 14px; }\nfooter { flex: none; padding: 0 20px 10px; }\n.skip-link, #authButton, #mobileAuth { display: none !important; }\n@media (max-width: 700px) {\n  .topbar { padding: 0 10px; }\n  main { padding: 12px 10px 10px; }\n}\n@container (max-width: 980px) {\n  .work-grid { grid-template-columns: minmax(220px, 260px) minmax(0, 1fr); gap: 16px; }\n  .top-actions { gap: 6px; }\n  .top-actions button { padding: 0 10px; font-size: 14px; }\n}\n@container (max-width: 780px) {\n  .work-grid { grid-template-columns: 1fr; }\n  .configuration-panel { max-height: none; }\n}\n@container (max-width: 520px) {\n  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  .metric:nth-child(2) { border-right: 0; }\n}\n\n/* ---- micro-interactions: subtle motion, depth and focus feedback ---- */\n:host { --cvx-ease: cubic-bezier(.22, 1, .36, 1); }\n/* The spectrum library's right pane is taller than the panel at native\n   scale. Keep its own vertical scroll track inside the library shell. */\n.reference-pane {\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  scrollbar-gutter: stable;\n  padding-right: 4px;\n}\n.reference-pane .reference-plot {\n  flex: 0 0 auto;\n  height: clamp(300px, 46vh, 480px);\n  max-height: none;\n}\n.panel, .analysis, .metric, .chart-panel, .dems-view {\n  transition: transform .28s var(--cvx-ease), box-shadow .28s ease, border-color .28s ease;\n}\n.panel:hover, .chart-panel:hover {\n  transform: translateY(-1px);\n  box-shadow: 0 12px 28px rgba(37, 39, 43, .08);\n  border-color: #d2d3ce;\n}\n.metric { transition: background .2s ease; }\n.metric:hover { background: #fafbfd; }\nbutton {\n  transition: background .18s ease, border-color .18s ease, color .18s ease,\n    transform .16s var(--cvx-ease), box-shadow .2s ease;\n}\nbutton:hover:not(:disabled) { transform: translateY(-1px); }\nbutton:active:not(:disabled) { transform: translateY(0) scale(.985); }\nbutton.primary:hover:not(:disabled) { box-shadow: 0 8px 20px rgba(48, 50, 54, .18); }\n.file-drop { transition: background .2s ease, border-color .2s ease, transform .22s var(--cvx-ease), box-shadow .22s ease; }\n.file-drop:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(37, 39, 43, .06); }\n.file-drop.dragging { animation: cvx-pulse-border 1.2s ease-in-out infinite; }\n.nav { transition: background .18s ease, color .18s ease, transform .16s var(--cvx-ease); }\n.view { animation: cvx-view-in .32s var(--cvx-ease) both; }\n.table-scroll tbody tr { transition: background .15s ease; }\n.table-scroll tbody tr:hover { background: #fafbfd; }\ndialog[open] { animation: cvx-dialog-in .24s var(--cvx-ease) both; }\n.toast:not(.hidden) { animation: cvx-toast-in .3s var(--cvx-ease) both; }\n@keyframes cvx-view-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }\n@keyframes cvx-dialog-in { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }\n@keyframes cvx-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }\n@keyframes cvx-pulse-border { 0%, 100% { border-color: #dfdfdb; } 50% { border-color: #6a6d73; } }\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }\n}\n";
    const MARKUP = "<svg class=\"icon-definitions\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\"><defs>\n  <symbol id=\"i-brand\" viewBox=\"0 0 36 32\"><path d=\"M2 25c5 0 5-18 11-18s6 18 12 18\"/><path d=\"M12 25c5 0 5-18 11-18s6 18 11 18\" opacity=\".45\"/></symbol>\n  <symbol id=\"i-wave\" viewBox=\"0 0 24 24\"><path d=\"M2 12h3l3-8 4 16 4-12 3 4h3\"/></symbol>\n  <symbol id=\"i-grid\" viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/></symbol>\n  <symbol id=\"i-layers\" viewBox=\"0 0 24 24\"><path d=\"m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5\"/></symbol>\n  <symbol id=\"i-chart\" viewBox=\"0 0 24 24\"><path d=\"M4 3v17h17M8 14l4-5 4 3 5-7\"/></symbol>\n  <symbol id=\"i-clock\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></symbol>\n  <symbol id=\"i-key\" viewBox=\"0 0 24 24\"><circle cx=\"8\" cy=\"8\" r=\"5\"/><path d=\"m12 12 9 9m-4-4 3-3m-6 0 3-3\"/></symbol>\n  <symbol id=\"i-upload\" viewBox=\"0 0 24 24\"><path d=\"M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4\"/></symbol>\n  <symbol id=\"i-download\" viewBox=\"0 0 24 24\"><path d=\"M12 3v13m-5-5 5 5 5-5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3\"/></symbol>\n  <symbol id=\"i-save\" viewBox=\"0 0 24 24\"><path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8\"/></symbol>\n  <symbol id=\"i-play\" viewBox=\"0 0 24 24\"><path d=\"m8 5 11 7-11 7V5Z\"/></symbol>\n  <symbol id=\"i-stop\" viewBox=\"0 0 24 24\"><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1\"/></symbol>\n  <symbol id=\"i-sliders\" viewBox=\"0 0 24 24\"><path d=\"M4 7h4m4 0h8M4 17h8m4 0h4\"/><circle cx=\"10\" cy=\"7\" r=\"2\"/><circle cx=\"14\" cy=\"17\" r=\"2\"/></symbol>\n  <symbol id=\"i-code\" viewBox=\"0 0 24 24\"><path d=\"m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20\"/></symbol>\n  <symbol id=\"i-file\" viewBox=\"0 0 24 24\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h5\"/></symbol>\n  <symbol id=\"i-chevron\" viewBox=\"0 0 24 24\"><path d=\"m9 5 7 7-7 7\"/></symbol>\n  <symbol id=\"i-refresh\" viewBox=\"0 0 24 24\"><path d=\"M20 7V3m0 4h-4M4 17v4m0-4h4M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3\"/></symbol>\n  <symbol id=\"i-check\" viewBox=\"0 0 24 24\"><path d=\"m5 12 4 4L19 6\"/></symbol>\n  <symbol id=\"i-close\" viewBox=\"0 0 24 24\"><path d=\"m6 6 12 12M6 18 18 6\"/></symbol>\n  <symbol id=\"i-info\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6M12 7h.01\"/></symbol>\n</defs></svg>\n\n<aside class=\"sidebar\">\n  <a class=\"brand\" href=\"/\" aria-label=\"Convolvex 首页\" title=\"Convolvex\"><svg class=\"icon\"><use href=\"#i-brand\"/></svg><span>Convolvex</span></a>\n  <nav aria-label=\"工作区导航\">\n    <button class=\"nav active\" data-view=\"workspace\" aria-current=\"page\" title=\"工作台\"><svg class=\"icon\"><use href=\"#i-grid\"/></svg><span>工作台</span></button>\n    <button class=\"nav\" data-view=\"spectra\" title=\"NIST 标准谱与本地图谱\"><svg class=\"icon\"><use href=\"#i-layers\"/></svg><span>标准图谱库</span></button>\n    <button class=\"nav\" data-view=\"records\" title=\"计算记录\"><svg class=\"icon\"><use href=\"#i-clock\"/></svg><span>记录</span></button>\n  </nav>\n  <div class=\"sidebar-bottom\">\n    <button id=\"authButton\" class=\"nav\" title=\"设置访问令牌\" aria-label=\"设置访问令牌\"><svg class=\"icon\"><use href=\"#i-key\"/></svg><span>令牌</span></button>\n    <div class=\"rail-status\" title=\"连接状态\"><i id=\"onlineDot\"></i><span id=\"onlineStatus\">连接中</span></div>\n    <span class=\"version\">v1.1.0</span>\n  </div>\n</aside>\n<div class=\"shell\">\n  <header class=\"topbar\">\n    <div class=\"product-title\">Convolvex 工作台<span class=\"product-divider\"></span><div class=\"breadcrumb\"><b id=\"viewLabel\">工作台</b></div><button id=\"mobileAuth\" class=\"icon-button mobile-auth\" aria-label=\"设置访问令牌\"><svg class=\"icon\"><use href=\"#i-key\"/></svg></button></div>\n    <div class=\"top-actions\">\n      <button id=\"importButton\"><svg class=\"icon\"><use href=\"#i-upload\"/></svg><span>导入数据</span></button>\n      <details class=\"project-menu\" id=\"projectMenu\"><summary title=\"项目选项\"><svg class=\"icon\"><use href=\"#i-code\"/></svg><span>项目</span></summary><div class=\"menu-popover\"><button id=\"exportProject\" disabled><svg class=\"icon\"><use href=\"#i-save\"/></svg>保存项目 JSON</button><button id=\"openProjectEditor\"><svg class=\"icon\"><use href=\"#i-code\"/></svg>编辑项目 JSON</button></div></details>\n      <button id=\"exportResult\" disabled><svg class=\"icon\"><use href=\"#i-download\"/></svg><span>导出结果</span></button>\n      <span class=\"action-divider\"></span>\n      <button id=\"cancelButton\" class=\"danger hidden\"><svg class=\"icon\"><use href=\"#i-stop\"/></svg><span>停止计算</span></button>\n      <button id=\"runButton\" class=\"primary\" disabled title=\"开始分析（Ctrl / ⌘ + Enter）\"><svg class=\"icon\"><use href=\"#i-play\"/></svg><span id=\"runLabel\">开始分析</span><kbd>⌘ ↵</kbd></button>\n    </div>\n  </header>\n  <main>\n    <section id=\"workspace\" class=\"view\" tabindex=\"-1\">\n      <div class=\"work-grid\">\n        <aside class=\"configuration-panel panel\">\n          <div class=\"configuration-heading\"><div><h2>数据</h2></div></div>\n          <fieldset id=\"configuration\" class=\"controls\"><legend class=\"sr-only\">数据与分析设置</legend>\n            <div class=\"basic-data\">\n              <button class=\"file-drop\" id=\"dropZone\" type=\"button\" aria-label=\"导入 JSON 或 CSV 数据\">\n                <span class=\"file-icon\"><svg class=\"icon\"><use href=\"#i-upload\"/></svg></span>\n                <span class=\"file-description\"><b>导入你的数据</b><span id=\"fileName\">拖入文件，或点击选择</span></span>\n                <span class=\"file-type\">CSV · Excel · JSON</span>\n              </button>\n              <button id=\"tryDemo\" class=\"sample-button\" type=\"button\"><svg class=\"icon\"><use href=\"#i-play\"/></svg>载入示例<svg class=\"icon\"><use href=\"#i-chevron\"/></svg></button>\n              <p id=\"dataHelp\" class=\"data-help\">示例已就绪，点击「开始分析」即可体验。</p>\n            </div>\n            <section id=\"msSetup\" class=\"ms-setup hidden\"><div id=\"msDataSummary\" class=\"ms-data-summary\"></div><div class=\"ms-section-title\"><span>候选组分</span><button id=\"openLibrary\" class=\"plain\" type=\"button\">从谱库添加</button></div><div id=\"speciesList\" class=\"species-list\"></div><p id=\"msResponseHint\" class=\"ms-response-hint\"></p><button id=\"importResponse\" class=\"plain\" type=\"button\">导入响应矩阵</button></section>\n            <div class=\"recommended-scheme\"><span class=\"scheme-icon\"><svg class=\"icon\"><use href=\"#i-check\"/></svg></span><div><span id=\"schemeLabel\">当前分析方案</span><strong id=\"recommendedMethod\">FISTA</strong><small>参数已预设，可直接开始</small></div></div>\n            <details id=\"advancedSettings\" class=\"expert-settings\">\n              <summary><svg class=\"icon\"><use href=\"#i-sliders\"/></svg><span>高级设置</span><svg class=\"icon chevron\"><use href=\"#i-chevron\"/></svg></summary>\n              <div class=\"expert-content\">\n                <div class=\"advanced-task\"><label>分析任务<select id=\"task\"><option value=\"inverse\">反卷积</option><option value=\"forward\">正向卷积</option><option value=\"kernel\">核估计</option><option value=\"blind\">盲反卷积</option><option value=\"gcv\">GCV</option><option value=\"bootstrap\">Bootstrap</option></select></label><label>更多示例<div class=\"input-action\"><select id=\"demo\" aria-label=\"示例实验\"><option value=\"dems\" selected>DEMS 多通道与传输</option><option value=\"signal\">一维瞬态信号</option><option value=\"image\">二维图像恢复</option><option value=\"volume\">三维体数据</option><option value=\"baseline\">信号与背景分离</option><option value=\"poisson\">泊松计数</option></select><button id=\"loadDemo\" title=\"载入选中的示例实验\" type=\"button\">载入</button></div></label></div>\n            <details class=\"control-section\" id=\"modelSection\">\n              <summary><span class=\"step\">02</span><h3>前向模型</h3><span class=\"section-meta\" id=\"modelSummary\">Causal · FFT</span><svg class=\"icon chevron\"><use href=\"#i-chevron\"/></svg></summary>\n              <div class=\"control-body\">\n                <div class=\"ms-only hidden\"><label>DEMS 模型<select id=\"msModel\"><option value=\"spectral\">谱分离（保留传输响应）</option><option value=\"spectrotemporal\">谱–时间联合反演</option></select></label><label>传输核约定<select id=\"msKernelConvention\"><option value=\"discrete\">离散权重</option><option value=\"density\">连续响应密度 × Δt</option></select></label><label class=\"check\"><input id=\"msBlankEnabled\" type=\"checkbox\"><span>按空白区间逐通道扣背景</span></label><div class=\"two-col\"><label>空白起点 / s<input id=\"msBlankStart\" type=\"number\" step=\"any\" placeholder=\"可选\"></label><label>空白终点 / s<input id=\"msBlankStop\" type=\"number\" step=\"any\" placeholder=\"可选\"></label></div><label>空白背景模型<select id=\"msBlankModel\"><option value=\"constant\">常数背景</option><option value=\"linear\">线性漂移</option></select></label></div>\n                <div class=\"legacy-only\">\n                <label>输出支撑<select id=\"mode\"><option value=\"causal\">Causal</option><option value=\"full\">Full</option><option value=\"same\">Same</option><option value=\"valid\">Valid</option><option value=\"circular\">Circular</option></select></label>\n                <div class=\"two-col\"><label>边界<select id=\"boundary\"><option value=\"zero\">Zero</option><option value=\"reflect\">Reflect</option></select></label><label>计算引擎<select id=\"engine\"><option value=\"fft\">FFT · CPU</option><option value=\"cpp\">C++ · CPU</option><option value=\"direct\">Direct</option><option value=\"overlap_add\">Overlap-add</option></select></label></div>\n                <label>采样体积<input id=\"sampleVolume\" type=\"number\" value=\"1\" step=\"any\" min=\"0.00000001\" required></label>\n                </div>\n                <div class=\"kernel-box\"><div class=\"mini-heading\"><span>响应核 <i>h(t)</i></span><button id=\"editKernel\" type=\"button\" class=\"plain\">编辑核函数</button></div><svg id=\"kernelPlot\" aria-label=\"核函数图\" role=\"img\" viewBox=\"0 0 260 80\"></svg></div>\n              </div>\n            </details>\n\n            <details class=\"control-section\" open>\n              <summary><span class=\"step\">03</span><h3>求解设置</h3><svg class=\"icon chevron\"><use href=\"#i-chevron\"/></svg></summary>\n              <div class=\"control-body\">\n                <label>求解方法<select id=\"method\"><option value=\"fista\">FISTA</option><option value=\"tikhonov\">Tikhonov · LSMR</option><option value=\"tv\">TV · PDHG</option><option value=\"channel_pars\">逐通道背景 · PARS</option><option value=\"pars\">PARS</option><option value=\"richardson_lucy\">Richardson–Lucy</option><option value=\"wiener\">Wiener</option><option value=\"gpu_fista\">FISTA · GPU</option></select></label>\n                <div class=\"two-col\"><label id=\"alphaLabel\"><span id=\"alphaName\">λ₂ 正则化</span><input id=\"alpha\" type=\"number\" value=\"0.003\" min=\"0\" step=\"any\" required></label><label>λ₁ 稀疏约束<input id=\"l1\" type=\"number\" value=\"0.0008\" min=\"0\" step=\"any\" required></label></div>\n                <label class=\"check\"><input id=\"nonnegative\" type=\"checkbox\" checked><span>非负约束</span><span class=\"field-hint\">x ≥ 0</span></label>\n                <label id=\"msTVLabel\" class=\"hidden\">TV 权重<input id=\"msTVWeight\" type=\"number\" min=\"0\" step=\"any\" value=\"0.01\"></label>\n                <details class=\"advanced-settings\"><summary>高级参数<svg class=\"icon chevron\"><use href=\"#i-chevron\"/></svg></summary><div class=\"advanced-body\">\n                  <div class=\"two-col\"><label>差分阶数<select id=\"order\"><option value=\"0\">0</option><option value=\"1\" selected>1</option><option value=\"2\">2</option></select></label><label>迭代上限<input id=\"iterations\" type=\"number\" value=\"1500\" min=\"1\" max=\"5000\" step=\"1\" required></label></div>\n                  <div class=\"two-col\"><label>损失函数<select id=\"loss\"><option value=\"gaussian\">Gaussian</option><option value=\"huber\">Huber</option></select></label><label>收敛容差<input id=\"tolerance\" type=\"number\" value=\"0.000001\" min=\"0.000000000000001\" step=\"any\" required></label></div>\n                </div></details>\n              </div>\n            </details>\n\n                <div class=\"advanced-project\"><button id=\"editProject\" class=\"plain\" type=\"button\"><svg class=\"icon\"><use href=\"#i-code\"/></svg>编辑完整项目 JSON</button></div>\n              </div>\n            </details>\n          </fieldset>\n          <div class=\"configuration-foot\"><span id=\"configState\"><i></i>等待载入数据</span><span class=\"mono\">FLOAT64</span></div>\n          <div class=\"configuration-note\"><svg class=\"icon\"><use href=\"#i-info\"/></svg><span>首次使用可直接试用示例。专业参数保留在高级设置中。</span></div>\n        </aside>\n        <div class=\"analysis\" id=\"analysisArea\">\n          <div class=\"metrics\" aria-label=\"求解概览\" aria-live=\"polite\">\n            <section class=\"metric\"><div class=\"metric-label\">拟合误差<svg class=\"icon\"><use href=\"#i-wave\"/></svg></div><strong id=\"residualMetric\">—</strong><span class=\"metric-caption\">观测与拟合的相对偏差</span></section>\n            <section class=\"metric\"><div class=\"metric-label\">迭代次数<svg class=\"icon\"><use href=\"#i-layers\"/></svg></div><strong id=\"iterationMetric\">—</strong><span class=\"metric-caption\" id=\"iterationLimit\">上限 1,500 次</span></section>\n            <section class=\"metric\"><div class=\"metric-label\">计算时间<svg class=\"icon\"><use href=\"#i-clock\"/></svg></div><strong id=\"timeMetric\">—</strong><span class=\"metric-caption\">求解器耗时</span></section>\n            <section class=\"metric status-metric\"><div class=\"metric-label\">求解状态<span class=\"status-indicator\"></span></div><strong class=\"status-value\" id=\"statusMetric\" data-state=\"idle\">待运行</strong><span class=\"metric-caption\" id=\"statusCaption\">点击开始分析查看结果</span></section>\n          </div>\n          <div id=\"analysisTabs\" class=\"analysis-tabs hidden\" role=\"tablist\" aria-label=\"分析视图\"><button id=\"fitTab\" role=\"tab\" aria-selected=\"true\" aria-controls=\"observedPanel\" type=\"button\">信号与拟合</button><button id=\"demsTab\" role=\"tab\" aria-selected=\"false\" aria-controls=\"demsView\" type=\"button\">DEMS 快速处理</button></div>\n          <section id=\"demsView\" class=\"dems-view hidden\" aria-label=\"DEMS 快速处理\">\n            <form id=\"demsForm\">\n              <div class=\"dems-heading\"><h2>DEMS 与 LSV 联合分析</h2><button id=\"attachEC\" class=\"plain\" type=\"button\">导入 LSV / EC</button></div>\n              <p class=\"dems-workflow\">导入数据与 LSV → 空白与时间对齐 → 候选谱分离 → 标定与极化曲线</p>\n              <p id=\"demsDataStatus\" class=\"dems-note\"></p>\n              <div class=\"dems-controls\"><label>MS 起始时间 / s<input id=\"demsStart\" type=\"number\" step=\"any\" required></label><label>MS 结束时间 / s<input id=\"demsStop\" type=\"number\" step=\"any\" required></label><label>质荷比<select id=\"demsMz\"></select></label><label>分析组分<select id=\"demsSpecies\"></select></label></div>\n              <div class=\"dems-query\"><label>查询方式<select id=\"demsLookup\"><option value=\"time\">按时间 / s</option><option value=\"potential\">按电位 / V</option><option value=\"current\">按电化学电流 / A</option></select></label><label><span id=\"demsValueLabel\">目标时间 / s</span><input id=\"demsValue\" type=\"number\" step=\"any\" required></label><label id=\"demsToleranceLabel\" class=\"hidden\">允许偏差<input id=\"demsTolerance\" type=\"number\" min=\"0\" step=\"any\" value=\"0.01\"></label><button id=\"processDEMS\" class=\"primary\" type=\"submit\">更新分析</button></div>\n              <details class=\"dems-advanced\"><summary>电位校正与定量设置<svg class=\"icon chevron\"><use href=\"#i-chevron\"/></svg></summary><div class=\"dems-controls\">\n                <label>电位参比<input id=\"demsReference\" placeholder=\"例如 RHE、Ag/AgCl\"></label><label>平衡电位 / V<input id=\"demsEquilibrium\" type=\"number\" step=\"any\" placeholder=\"可选，用于过电位\"></label><label>未补偿电阻 / Ω<input id=\"demsResistance\" type=\"number\" min=\"0\" step=\"any\" value=\"0\"></label><label>电极面积 / cm²<input id=\"demsArea\" type=\"number\" min=\"0\" step=\"any\" placeholder=\"可选\"></label>\n                <label>EC 时钟偏移 / s<input id=\"demsOffset\" type=\"number\" step=\"any\" value=\"0\"></label><label>传输纯延迟 / s<input id=\"demsDelay\" type=\"number\" min=\"0\" step=\"any\" value=\"0\"></label><label>附加信号基线<input id=\"demsBaseline\" type=\"number\" step=\"any\" value=\"0\"></label><label>离子信号极性<select id=\"demsPolarity\"><option value=\"1\">正信号</option><option value=\"-1\">负信号（反向）</option></select></label><label>Tafel 信号来源<select id=\"demsBasis\"><option value=\"species\">所选分离组分</option><option value=\"channel\">原始 m/z 通道</option></select></label>\n                <label>Tafel 电位下限 / V<input id=\"demsMinPotential\" type=\"number\" step=\"any\" placeholder=\"可选\"></label><label>Tafel 电位上限 / V<input id=\"demsMaxPotential\" type=\"number\" step=\"any\" placeholder=\"可选\"></label><label>电位分箱数<input id=\"demsBins\" type=\"number\" min=\"3\" max=\"80\" value=\"10\"></label><label>反应方向<select id=\"demsDirection\"><option value=\"cathodic\">还原（阴极）</option><option value=\"anodic\">氧化（阳极）</option></select></label>\n              </div><p class=\"dems-note\">纯延迟用于谱分离曲线的 t<sub>EC</sub> = t<sub>MS</sub> − τ 对齐；已用传输核联合反演时不重复施加。空白区间扣背景在左侧高级设置中配置，修改后需重新分析。</p><label class=\"check\"><input id=\"demsSteady\" type=\"checkbox\"><span>所选 Tafel 区间满足稳态／准稳态、单向扫描及动力学控制条件</span></label><label class=\"check\"><input id=\"demsComplete\" type=\"checkbox\"><span>已确认所选积分窗口完整，或传输校正适用于此区间</span></label>\n              <details class=\"dems-calibration\"><summary>所选组分的本机标定</summary><p class=\"dems-note\">灵敏度对应当前响应列的参考通道，须包含收集效率。切换组分可分别保存标定。</p><div class=\"dems-controls\">\n                <label>有效灵敏度 / C·mol⁻¹<input id=\"demsSensitivity\" type=\"number\" min=\"0\" step=\"any\" placeholder=\"标准实验提供\"></label><label>反应电子数<input id=\"demsElectrons\" type=\"number\" min=\"1\" max=\"64\" step=\"1\" placeholder=\"取决于反应路径\"></label><label>参考 m/z<select id=\"demsReferenceMz\"></select></label><label>标定记录名称<input id=\"demsCalibrationId\" placeholder=\"例如 CO-standard-01\"></label><label>仪器标识<input id=\"demsInstrument\" placeholder=\"与本机标准实验一致\"></label><label>实验条件标识<input id=\"demsConditions\" placeholder=\"与标定条件一致\"></label>\n              </div><label class=\"check\"><input id=\"demsCalibrationConfirmed\" type=\"checkbox\"><span>该标定来自本机标准实验，已包含收集效率，适用于当前响应模型</span></label><p id=\"demsCalibrationState\" class=\"dems-note\"></p><button id=\"saveDEMSCalibration\" type=\"button\">保存组分标定</button></details></details>\n            </form>\n            <p id=\"demsError\" class=\"dems-error\" role=\"alert\"></p>\n            <div id=\"demsResults\" class=\"hidden\" aria-live=\"polite\">\n              <p id=\"lsvSummary\" class=\"dems-note\"></p>\n              <div class=\"dems-charge-metrics\"><div><span>电化学总电荷</span><strong id=\"demsECCharge\">—</strong><small id=\"demsECDirection\">原始 EC 时间轴积分</small></div><div><span>物质转化电荷</span><strong id=\"demsProductCharge\">—</strong><small id=\"demsAmount\">需要本机标定</small></div><div><span>法拉第效率</span><strong id=\"demsFE\">—</strong><small>相对于所选方向总电荷</small></div></div>\n              <div class=\"dems-plots\"><section><div class=\"dems-heading\"><h3>LSV 总电流</h3><span id=\"lsvCurrentUnit\"></span></div><div id=\"lsvPlot\" class=\"dems-plot\" role=\"img\" aria-label=\"原始 LSV 电流与电位曲线\"></div></section><section><div class=\"dems-heading\"><h3 id=\"productPolarizationTitle\">组分极化曲线</h3></div><div id=\"productPolarizationPlot\" class=\"dems-plot\" role=\"img\" aria-label=\"分离组分的极化曲线\"></div><p id=\"productPolarizationNote\" class=\"dems-note\"></p></section></div>\n              <div class=\"dems-plots\"><section><div class=\"dems-heading\"><h3>质谱伏安曲线</h3><span id=\"demsSignalSlope\"></span></div><div id=\"demsPotentialPlot\" class=\"dems-plot\" role=\"img\" aria-label=\"电位与质谱信号关联图\"></div></section><section><div class=\"dems-heading\"><h3 id=\"demsTafelTitle\">Tafel 分析</h3><strong id=\"demsTafelSlope\">—</strong></div><div id=\"demsTafelPlot\" class=\"dems-plot\" role=\"img\" aria-label=\"电位与电流对数及线性拟合\"></div><p id=\"demsTafelQuality\" class=\"dems-note\"></p></section></div>\n              <div class=\"dems-heading\"><h3>查询结果</h3><span id=\"demsLookupSummary\"></span></div><div id=\"demsLookupTable\" class=\"table-scroll\"></div>\n              <div class=\"dems-heading\"><h3>该 m/z 下的候选组分贡献</h3><span id=\"demsIonIntegral\"></span></div><div id=\"demsComponents\" class=\"table-scroll\"></div>\n              <p id=\"demsQuantificationNote\" class=\"dems-note\"></p><ul id=\"demsWarnings\" class=\"dems-warnings\"></ul><div class=\"dems-export\"><button id=\"exportLSV\" type=\"button\">导出原始 LSV CSV</button><button id=\"exportDEMSCSV\" type=\"button\">导出联合数据 CSV</button><button id=\"exportDEMS\" type=\"button\">导出分析报告 JSON</button></div>\n            </div>\n            <p id=\"demsEmpty\" class=\"dems-note\">选择时间区间后更新分析。电位、电流和 m/z 会按记录的时间关联。</p>\n          </section>\n          <div class=\"signal-grid\">\n            <section class=\"panel chart-panel chart-main\" id=\"observedPanel\"><div class=\"panel-heading\"><div class=\"chart-title\"><span class=\"chart-icon\"><svg class=\"icon\"><use href=\"#i-wave\"/></svg></span><div><h2 id=\"observedTitle\">观测信号</h2><span>OBSERVATION & FIT</span></div></div><div class=\"chart-tools\"><select id=\"imageLayer\" class=\"hidden\" aria-label=\"图像显示\"><option value=\"observed\">观测</option><option value=\"predicted\">重构</option></select><label class=\"compact\">通道<select id=\"channel\"><option value=\"0\">1</option></select></label><button id=\"resetZoom\" class=\"icon-button\" title=\"重置图表缩放\" aria-label=\"重置图表缩放\"><svg class=\"icon\"><use href=\"#i-refresh\"/></svg></button></div></div><div id=\"observedPlot\" class=\"plot\" role=\"img\" aria-label=\"观测与重构曲线\"></div><div class=\"chart-bottom\"><div id=\"observedLegend\" class=\"legend\"></div><span class=\"plot-hint\">滚轮缩放</span></div></section>\n            <section class=\"panel chart-panel source-panel\" id=\"sourcePanel\"><div class=\"panel-heading\"><div class=\"chart-title\"><span class=\"chart-icon warm\"><svg class=\"icon\"><use href=\"#i-chart\"/></svg></span><div><h2 id=\"sourceTitle\">还原结果</h2><span>SOURCE RECOVERY</span></div></div><div class=\"chart-tools\"><select id=\"sourceLayer\" class=\"hidden\" aria-label=\"源图像显示\"><option value=\"estimate\">恢复</option><option value=\"truth\">真值</option></select><label class=\"compact\">分量<select id=\"sourceChannel\"><option value=\"0\">1</option></select></label></div></div><div id=\"sourcePlot\" class=\"plot\" role=\"img\" aria-label=\"源信号恢复曲线\"></div><div class=\"chart-bottom\"><div id=\"sourceLegend\" class=\"legend\"></div><span class=\"plot-hint\">滚轮缩放</span></div></section>\n          </div>\n          <details class=\"analysis-details\" id=\"analysisDetails\"><summary><svg class=\"icon\"><use href=\"#i-chart\"/></svg><span>分析详情</span><span class=\"details-hint\">残差、收敛与数值诊断</span><svg class=\"icon chevron\"><use href=\"#i-chevron\"/></svg></summary><div class=\"analysis-details-body\">\n          <div class=\"lower-grid\">\n            <section class=\"panel secondary-chart\"><div class=\"panel-heading\"><h2><span class=\"chart-dot\"></span>残差分布</h2><span class=\"notation\">y − Ax</span></div><div id=\"residualPlot\" class=\"plot small\" role=\"img\" aria-label=\"残差曲线\"></div></section>\n            <section class=\"panel secondary-chart\"><div class=\"panel-heading\"><h2><span class=\"chart-dot amber\"></span>收敛过程</h2><span class=\"notation\">Φ(x)</span></div><div id=\"historyPlot\" class=\"plot small\" role=\"img\" aria-label=\"目标函数收敛曲线\"></div></section>\n          </div>\n          <section class=\"panel diagnostic\"><div class=\"diagnostic-heading\"><svg class=\"icon\"><use href=\"#i-check\"/></svg><h2>求解诊断</h2></div><div class=\"diagnostic-grid\"><div><span>伴随误差</span><b id=\"adjointMetric\">—</b></div><div><span>驻点残差</span><b id=\"stationarityMetric\">—</b></div><div><span>数据来源</span><b id=\"hashMetric\">—</b></div></div><div id=\"warningBox\" class=\"hidden\" role=\"status\"></div></section>\n          </div></details>\n        </div>\n      </div>\n    </section>\n    <section id=\"records\" class=\"view hidden\"><div class=\"page-heading\"><div><div class=\"eyebrow\">RUN HISTORY</div><h1>计算记录</h1><p>打开已完成的分析，继续查看结果。</p></div><button id=\"refreshRecords\"><svg class=\"icon\"><use href=\"#i-refresh\"/></svg>刷新记录</button></div><section class=\"panel table-panel\"><div id=\"recordsTable\" class=\"table-scroll\"></div></section></section>\n<section id=\"spectra\" class=\"view hidden\" aria-labelledby=\"spectrumTitle\"><div class=\"library-shell\">\n  <div class=\"panel-heading\"><div><h2 id=\"spectrumTitle\">标准图谱库</h2><p class=\"dialog-description\">NIST WebBook 公开 EI 图谱 · 支持导入本地 JCAMP-DX</p></div><button id=\"closeSpectrum\" class=\"icon-button\" type=\"button\" aria-label=\"返回工作台\"><svg class=\"icon\"><use href=\"#i-close\"/></svg></button></div>\n  <div class=\"spectrum-search\"><input id=\"spectrumQuery\" type=\"search\" placeholder=\"物质名、分子式或 CAS，例如 CO2、ethanol\" aria-label=\"物质名或 CAS\"><button id=\"searchSpectrum\" type=\"button\">调取图谱</button><button id=\"localSpectrum\" type=\"button\">导入本地谱</button></div>\n  <div class=\"library-grid\"><aside class=\"catalog-pane\"><div id=\"catalogFilters\" class=\"catalog-filters\"></div><div id=\"compoundCatalog\" class=\"compound-catalog\"></div></aside><div class=\"reference-pane\">\n  <p id=\"spectrumStatus\" role=\"status\" class=\"spectrum-status\">选择物质后调取图谱。</p>\n  <div id=\"spectrumChoices\" class=\"spectrum-choices hidden\"></div>\n  <div id=\"referencePlot\" class=\"reference-plot\" role=\"img\" aria-label=\"参考质谱棒图\"></div>\n  <div id=\"spectrumSource\" class=\"spectrum-source\"></div>\n  <label class=\"spectrum-name-label\">候选组分名称<input id=\"spectrumName\" maxlength=\"96\" placeholder=\"从谱文件读取；可填写明确的物质名称\" disabled></label>\n  <div class=\"dialog-actions\"><span id=\"spectrumError\" role=\"alert\"></span><button id=\"downloadSpectrum\" type=\"button\" disabled>导出谱数据</button><button id=\"addSpectrum\" type=\"button\" class=\"primary\" disabled>添加候选组分</button></div>\n  </div></div>\n</div></section>\n  </main>\n  <footer><span class=\"footer-state\"><i></i><span id=\"footerStatus\" role=\"status\">CONNECTING</span></span><span class=\"footer-help\">快捷运行 <kbd id=\"shortcutHint\">⌘ Enter</kbd><span class=\"footer-divider\"></span>Convolvex 工作台<span class=\"footer-divider\"></span>FLOAT64</span></footer>\n</div>\n<dialog id=\"editor\" aria-labelledby=\"editorTitle\"><form method=\"dialog\"><div class=\"panel-heading\"><div><div class=\"eyebrow\">PROJECT EDITOR</div><h2 id=\"editorTitle\">项目</h2></div><button class=\"icon-button\" value=\"cancel\" aria-label=\"关闭编辑器\"><svg class=\"icon\"><use href=\"#i-close\"/></svg></button></div><textarea id=\"editorText\" spellcheck=\"false\" aria-label=\"JSON 编辑器\"></textarea><div class=\"dialog-actions\"><span id=\"editorError\" role=\"alert\"></span><button value=\"cancel\">取消</button><button id=\"applyEditor\" type=\"button\" class=\"primary\">应用配置</button></div></form></dialog>\n<dialog id=\"csvDialog\" aria-labelledby=\"csvTitle\"><form method=\"dialog\"><div class=\"panel-heading\"><div><div class=\"eyebrow\">IMPORT DATA</div><h2 id=\"csvTitle\">映射 CSV 数据列</h2></div><button class=\"icon-button\" aria-label=\"关闭导入\"><svg class=\"icon\"><use href=\"#i-close\"/></svg></button></div><p class=\"dialog-description\">选择观测和时间列，响应核也可以在导入后编辑。</p><label>观测列<select id=\"csvY\"></select></label><label>时间列<select id=\"csvTime\"></select></label><label>响应核<select id=\"csvKernel\"></select></label><div class=\"dialog-actions\"><button value=\"cancel\">取消</button><button id=\"applyCSV\" class=\"primary\" type=\"button\">导入数据</button></div></form></dialog>\n<input type=\"file\" id=\"fileInput\" accept=\".json,.csv,.tsv,.txt,.xlsx,.jdx,.dx,.jcamp\" hidden>\n<input type=\"file\" id=\"responseInput\" accept=\".json,.csv\" hidden>\n<input type=\"file\" id=\"spectrumInput\" accept=\".json,.jdx,.dx,.jcamp,.csv,.tsv,.txt\" hidden>\n<input type=\"file\" id=\"ecInput\" accept=\".csv,.tsv,.txt,.xlsx\" hidden>\n\n<dialog id=\"importDialog\" aria-labelledby=\"importTitle\"><form method=\"dialog\">\n  <div class=\"panel-heading\"><div><h2 id=\"importTitle\">导入数据</h2><p id=\"importSummary\" class=\"dialog-description\"></p></div><button class=\"icon-button\" aria-label=\"关闭数据导入\"><svg class=\"icon\"><use href=\"#i-close\"/></svg></button></div>\n  <div id=\"sheetRow\" class=\"hidden\"><label>工作表<select id=\"importSheet\"></select></label></div>\n  <div id=\"importPreview\" class=\"table-scroll import-preview\"></div>\n  <div id=\"lsvTimingFields\" class=\"mapping-grid hidden\"><label>LSV 扫描速率 / mV·s⁻¹<input id=\"importScanRate\" type=\"number\" min=\"0\" step=\"any\" placeholder=\"无时间列时必填\"></label><label>LSV 起始时刻 / s<input id=\"importLSVStart\" type=\"number\" step=\"any\" value=\"0\"></label><p class=\"dems-note\">仅对恒定速率、严格单向扫描重建时间；与 MS 使用共同起点。</p></div>\n  <label id=\"spectrumImportNameRow\" class=\"hidden\">标准谱的物质名称<input id=\"importSpeciesName\" maxlength=\"96\" placeholder=\"例如：二氧化碳 (CO₂)\"></label>\n  <details class=\"import-mapping\"><summary>检查列映射与单位<svg class=\"icon chevron\"><use href=\"#i-chevron\"/></svg></summary><div class=\"mapping-grid\">\n    <label>数据类型<select id=\"importMode\"><option value=\"dems\">DEMS 多通道时间序列</option><option value=\"electrochemistry\">补充电位／电流记录</option><option value=\"series\">一维时间信号</option><option value=\"spectrum\">m/z–强度参考图谱</option></select></label>\n    <label>时间列<select id=\"importTime\"></select></label>\n    <label>时间单位<select id=\"importTimeUnit\"><option value=\"s\">秒 / s</option><option value=\"ms\">毫秒 / ms</option><option value=\"min\">分钟 / min</option></select></label>\n    <label>信号单位<select id=\"importUnit\"><option value=\"auto\">按各列单位识别</option><option value=\"a.u.\">相对值 / a.u.</option><option value=\"A\">A</option><option value=\"mA\">mA</option><option value=\"uA\">µA</option><option value=\"nA\">nA</option><option value=\"pA\">pA</option><option value=\"counts\">counts</option><option value=\"Pa\">Pa</option><option value=\"mbar\">mbar</option></select></label>\n    <div class=\"mapping-signals\"><span>信号列</span><div id=\"importSignals\" class=\"import-signals\"></div></div>\n    <label>m/z（按选中列顺序）<input id=\"importMasses\" type=\"text\" placeholder=\"2, 28, 44\"></label>\n    <label>电位列<select id=\"importPotential\"></select></label><label>电位单位<select id=\"importPotentialUnit\"><option value=\"V\">V</option><option value=\"mV\">mV</option></select></label><label>电化学电流列<select id=\"importCurrent\"></select></label><label>电化学电流单位<select id=\"importCurrentUnit\"><option value=\"A\">A</option><option value=\"mA\">mA</option><option value=\"uA\">µA</option><option value=\"nA\">nA</option><option value=\"pA\">pA</option><option value=\"A/cm2\">A/cm²</option><option value=\"mA/cm2\">mA/cm²</option></select></label><label>电极面积 / cm²<input id=\"importArea\" type=\"number\" min=\"0\" step=\"any\" placeholder=\"电流密度导入时必填\"></label>\n    <label class=\"check\"><input id=\"importSynthetic\" type=\"checkbox\"><span>该文件为合成／示例数据</span></label>\n  </div></details>\n  <div class=\"dialog-actions\"><span id=\"importError\" role=\"alert\"></span><button value=\"cancel\">取消</button><button id=\"confirmImport\" class=\"primary\" type=\"button\">导入数据</button></div>\n</form></dialog>\n\n\n<div id=\"toast\" role=\"status\" class=\"toast hidden\"><span id=\"toastText\"></span><button id=\"dismissToast\" class=\"icon-button\" aria-label=\"关闭提示\"><svg class=\"icon\"><use href=\"#i-close\"/></svg></button></div>";
    const BOOT = (function bootWorkbench(shadow, bridge) {
  'use strict';

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

'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const scrollFadeTimers=new WeakMap();
document.addEventListener('scroll',event=>{
  const pane=event.target===document?document.documentElement:event.target;
  if(!(pane instanceof Element))return;
  pane.classList.add('is-scrolling');
  clearTimeout(scrollFadeTimers.get(pane));
  scrollFadeTimers.set(pane,setTimeout(()=>{pane.classList.remove('is-scrolling');scrollFadeTimers.delete(pane);},800));
},true);
const colors = ['#43474d', '#92969c', '#686d75', '#b1b4b9'];
let problem = null, truth = null, axis = null, layout = 'series', result = null;
let activeJob = null, editorMode = 'project', csvData = null, view = 'workspace';
let busy = false, dirty = false, toastTimer, resizeTimer;
let msProject = null, capabilityInfo = null;
let msResultJobId = null;
let token = '';
try { token = sessionStorage.getItem('convolvexToken') || ''; } catch (_) {}

function toast(message) {
  clearTimeout(toastTimer);
  $('toastText').textContent = message;
  $('toast').classList.remove('hidden');
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 6500);
}

async function api(path, options = {}) {
  const response = await fetch('/api/v1' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: response.statusText }));
    const error = new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function elt(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function fmt(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value !== 0 && (Math.abs(value) < .001 || Math.abs(value) > 1e4)) return value.toExponential(2);
  return Number(value.toPrecision(4)).toString();
}

function emptyPlot(container, message) {
  container.replaceChildren();
  const state = document.createElement('div');
  state.className = 'empty-state';
  const icon = elt('svg', { class: 'icon', 'aria-hidden': 'true' });
  icon.appendChild(elt('use', { href: '#i-wave' }));
  const label = document.createElement('span');
  label.textContent = message;
  state.append(icon, label);
  container.appendChild(state);
}

function plot(container, series, { height = 220, mini = false, xvalues = null, log = false } = {}) {
  container.replaceChildren();
  if (!series.length || !series[0].data?.length) {
    if (!mini) emptyPlot(container, container.id === 'residualPlot' ? '运行分析后查看残差分布' : container.id === 'historyPlot' ? '运行分析后查看收敛过程' : '等待输入或计算结果');
    return;
  }
  const width = mini ? 260 : Math.max(container.clientWidth, 220);
  const h = mini ? 80 : Math.max(height, 120);
  const pad = mini ? { l: 2, r: 2, t: 8, b: 8 } : { l: 59, r: 20, t: 16, b: 33 };
  const svg = elt('svg', { viewBox: '0 0 ' + width + ' ' + h, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  container.appendChild(svg);
  const count = Math.max(...series.map(s => s.data.length));
  let start = 0, end = count - 1;
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip hidden';
  if (!mini) container.appendChild(tooltip);

  function draw() {
    svg.replaceChildren();
    const values = series.flatMap(s => s.data.slice(start, end + 1)).filter(Number.isFinite);
    if (!values.length) return;
    const transform = value => log ? Math.log10(Math.max(value, 1e-20)) : value;
    let min = values.reduce((a, v) => Math.min(a, transform(v)), Infinity);
    let max = values.reduce((a, v) => Math.max(a, transform(v)), -Infinity);
    const range = max - min || Math.max(Math.abs(max), 1) * .2;
    min -= range * .08;
    max += range * .08;
    const px = i => pad.l + (i - start) / Math.max(end - start, 1) * (width - pad.l - pad.r);
    const py = value => h - pad.b - (transform(value) - min) / (max - min) * (h - pad.t - pad.b);
    if (!mini) {
      for (let i = 0; i < 5; i++) {
        const y = pad.t + i * (h - pad.t - pad.b) / 4;
        svg.appendChild(elt('line', { x1: pad.l, x2: width - pad.r, y1: y, y2: y, stroke: '#edf0f5', 'stroke-width': 1, 'stroke-dasharray': i === 4 ? 'none' : '3 4' }));
        const label = elt('text', { x: pad.l - 9, y: y + 4, 'text-anchor': 'end', fill: '#626b79', 'font-size': 12, 'font-family': 'ui-monospace, monospace' });
        const value = max - i * (max - min) / 4;
        label.textContent = log ? '10^' + value.toFixed(1) : fmt(value);
        svg.appendChild(label);
      }
      const ticks = width < 400 ? 4 : 5;
      for (let j = 0; j <= ticks; j++) {
        const i = Math.round(start + (end - start) * j / ticks);
        const label = elt('text', { x: px(i), y: h - 7, 'text-anchor': 'middle', fill: '#626b79', 'font-size': 12, 'font-family': 'ui-monospace, monospace' });
        label.textContent = fmt(xvalues?.[i] ?? i);
        svg.appendChild(label);
      }
    }
    series.forEach((s, index) => {
      const segments = [[]];
      const stride = Math.max(1, Math.floor((end - start) / 1500));
      for (let i = start; i <= Math.min(end, s.data.length - 1); i += stride) {
        if (!Number.isFinite(s.data[i])) { if (segments[segments.length-1].length) segments.push([]); continue; }
        segments[segments.length-1].push(px(i).toFixed(2) + ',' + py(s.data[i]).toFixed(2));
      }
      for (const points of segments) if(points.length) svg.appendChild(elt('polyline', { points: points.join(' '), fill: 'none', stroke: s.color || colors[index % colors.length], 'stroke-width': s.width || 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...(s.dash ? { 'stroke-dasharray': '5 4' } : {}) }));
    });
    svg.onmousemove = event => {
      if (mini) return;
      const rect = svg.getBoundingClientRect();
      const x = (event.clientX - rect.left) * width / rect.width;
      const i = Math.max(start, Math.min(end, Math.round(start + (x - pad.l) / (width - pad.l - pad.r) * (end - start))));
      tooltip.textContent = (xvalues ? 't = ' : 'i = ') + fmt(xvalues?.[i] ?? i) + '  ' + series.map(s => s.name + ': ' + fmt(s.data[i])).join('  ');
      tooltip.style.left = Math.max(8, Math.min(event.clientX - rect.left + 12, container.clientWidth - 220)) + 'px';
      tooltip.style.top = '8px';
      tooltip.classList.remove('hidden');
    };
    svg.onmouseleave = () => tooltip.classList.add('hidden');
  }

  svg.addEventListener('wheel', event => {
    if (mini || count < 2) return;
    event.preventDefault();
    const span = end - start;
    if (event.deltaY < 0 && span > 20) { start += Math.round(span * .1); end -= Math.round(span * .1); }
    else if (event.deltaY > 0) { start = Math.max(0, start - Math.round(span * .15) - 1); end = Math.min(count - 1, end + Math.round(span * .15) + 1); }
    draw();
  }, { passive: false });
  draw();
}

function heatmap(container, data, range = null) {
  if (!data?.length || !Array.isArray(data[0])) { emptyPlot(container, '等待图像数据'); return; }
  container.replaceChildren();
  const canvas = document.createElement('canvas');
  canvas.width = data[0].length;
  canvas.height = data.length;
  const context = canvas.getContext('2d');
  const values = data.flat(), [lo, hi] = range || dataRange(data);
  const image = context.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < values.length; i++) {
    const value = Math.max(0, Math.min(1, (values[i] - lo) / (hi - lo || 1)));
    image.data[i * 4] = Math.round(249 - value * 182);
    image.data[i * 4 + 1] = Math.round(247 - value * 176);
    image.data[i * 4 + 2] = Math.round(244 - value * 167);
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  container.appendChild(canvas);
  const scale = document.createElement('div');
  scale.className = 'heat-scale';
  const low = document.createElement('span'), ramp = document.createElement('i'), high = document.createElement('span');
  low.textContent = fmt(lo); high.textContent = fmt(hi);
  scale.append(low, ramp, high); container.appendChild(scale);
  const tip = document.createElement('div');
  tip.className = 'tooltip hidden'; container.appendChild(tip);
  canvas.onmousemove = event => {
    const rect = canvas.getBoundingClientRect();
    const row = Math.max(0, Math.min(data.length - 1, Math.floor((event.clientY - rect.top) / rect.height * data.length)));
    const column = Math.max(0, Math.min(data[0].length - 1, Math.floor((event.clientX - rect.left) / rect.width * data[0].length)));
    tip.textContent = '[' + row + ', ' + column + '] = ' + fmt(data[row][column]);
    tip.style.left = '12px'; tip.style.top = '8px'; tip.classList.remove('hidden');
  };
  canvas.onmouseleave = () => tip.classList.add('hidden');
}

function dataRange(...arrays){let lo=Infinity,hi=-Infinity;function visit(a){if(Array.isArray(a)){a.forEach(visit)}else if(Number.isFinite(a)){lo=Math.min(lo,a);hi=Math.max(hi,a)}}arrays.forEach(visit);return Number.isFinite(lo)?[lo,hi]:[0,1]}

function legend(id,series){$(id).replaceChildren();series.forEach((s,i)=>{let span=document.createElement('span'),line=document.createElement('i');line.style.borderColor=s.color||colors[i%colors.length];if(s.dash)line.className='dash';span.append(line,document.createTextNode(s.name));$(id).appendChild(span)})}

function inferLayout(p){let a=p.observed||p.source;return Array.isArray(a?.[0]?.[0])?'volume':Array.isArray(a?.[0])?(p.operator.kind==='convolution'?'image':'channels'):'series'}

function seriesArray(data,index=0){return Array.isArray(data?.[0])?data[index]||data[0]:data||[]}

function channelOptions(id, data) {
  const select = $(id), old = Number(select.value) || 0;
  const count = Array.isArray(data?.[0]) ? data.length : 1;
  select.replaceChildren();
  for (let i = 0; i < count; i++) select.add(new Option(String(i + 1), String(i)));
  select.value = String(Math.min(old, count - 1));
  select.disabled = count === 1 || layout === 'image';
  select.closest('.compact')?.classList.toggle('hidden', select.disabled);
}

function getProblem(){if(msProject)return getMSProblem();let p=structuredClone(problem),m=$('method').value;p.task=$('task').value;p.method=m;
  if(p.operator.kind==='convolution'){p.operator.mode=$('mode').value;p.operator.boundary=$('boundary').value;p.operator.engine=$('engine').value;p.operator.sample_volume=Number($('sampleVolume').value)}
  const common={max_iter:Number($('iterations').value),tol:Number($('tolerance').value)},alpha=Number($('alpha').value),nonnegative=$('nonnegative').checked;
  if(p.task==='gcv'){p.parameters={order:Number($('order').value),...(p.parameters.alphas?{alphas:p.parameters.alphas}:{})};return p}
  if(p.task==='bootstrap'){p.parameters={repeats:p.parameters.repeats||30,sigma:p.parameters.sigma||.01,seed:p.parameters.seed||7,level:p.parameters.level||.95,solver_kwargs:p.parameters.solver_kwargs||{alpha,order:Number($('order').value)}};return p}
  if(p.task==='kernel'){p.source=p.source||truth;if(!p.source)throw Error('核估计需要已知输入，请在 JSON 中提供 source');p.parameters={kernel_shape:p.operator.kernel?.length?[p.operator.kernel.length]:[20],mode:p.operator.mode||'causal',alpha,max_iter:common.max_iter,tol:common.tol,nonnegative};return p}
  if(p.task==='blind'){p.parameters={kernel_size:p.operator.kernel?.length||20,input_size:p.operator.input_shape?.[0],mode:p.operator.mode||'causal',restarts:3,outer_iter:15,inner_iter:Math.min(common.max_iter,500)};return p}
  if(p.task==='forward'){p.source=p.source||truth;if(!p.source)throw Error('正向卷积需要 source');p.parameters={};return p}
  if(['fista','pars'].includes(m))p.parameters={...common,l2:alpha,l1:Number($('l1').value),order:Number($('order').value),nonnegative,loss:$('loss').value,huber_delta:p.parameters.huber_delta||1};
  else if(m==='tikhonov')p.parameters={...common,alpha,order:Number($('order').value),nonnegative};
  else if(m==='tv')p.parameters={...common,alpha,nonnegative};
  else if(m==='wiener')p.parameters={alpha};else if(m==='richardson_lucy')p.parameters=common;
  else if(m==='gpu_fista')p.parameters={...common,l2:alpha,l1:Number($('l1').value),nonnegative};return p;
}

function parseCSV(text){const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);const split=s=>s.split(/[,;\t]/).map(v=>v.trim());let first=split(lines[0]),header=first.some(v=>v===''||!Number.isFinite(Number(v)));let names=header?first:first.map((_,i)=>'Column '+(i+1));let rows=lines.slice(header?1:0).map(split).map(r=>r.map(v=>v===''?NaN:Number(v)));if(rows.length<2||rows.some(r=>r.length!==names.length))throw Error('CSV 需要一致的数值列；不支持引号包围的字段');return{names,rows}}

function setStatus(label, state = 'idle', caption = '点击开始分析查看结果') {
  $('statusMetric').textContent = label;
  $('statusMetric').dataset.state = state;
  $('statusCaption').textContent = caption;
}

function setConfigState(label) {
  const dot = document.createElement('i');
  $('configState').replaceChildren(dot, document.createTextNode(label));
}

function syncInterface() {
  $('exportResult').disabled = !result || dirty || busy;
  $('exportProject').disabled = !problem || busy;
  $('editProject').disabled = !problem || busy;
  $('runButton').disabled = !problem || busy || view !== 'workspace';
  $('iterationLimit').textContent = '上限 ' + Number($('iterations').value).toLocaleString() + ' 次';
  if (problem) {
    $('recommendedMethod').textContent = $('task').value === 'inverse' ? $('method').selectedOptions[0]?.textContent || 'FISTA' : $('task').selectedOptions[0].textContent;
    $('dataHelp').textContent = problem.metadata?.synthetic ? '示例已就绪，点击「开始分析」即可体验。' : '数据已载入，点击「开始分析」查看结果。';
    $('modelSummary').textContent = problem.operator.kind === 'convolution'
      ? $('mode').selectedOptions[0].textContent + ' · ' + $('engine').selectedOptions[0].textContent.replace(' · CPU', '')
      : problem.operator.kind;
  }
  document.querySelectorAll('.plot-hint').forEach(node => { node.textContent = layout === 'image' || layout === 'volume' ? '悬停查看像素' : '滚轮缩放'; });
  if (typeof syncMSInterface === 'function') syncMSInterface();
}

function setBusy(mode = null) {
  busy = !!mode;
  $('configuration').disabled = busy;
  $('importButton').disabled = busy;
  $('analysisArea').setAttribute('aria-busy', String(busy));
  $('runLabel').textContent = mode === 'running' ? '正在分析…' : mode === 'loading' ? '准备中…' : '开始分析';
  const icon = $('runButton').querySelector('use');
  icon.setAttribute('href', mode ? '#i-refresh' : '#i-play');
  $('runButton').querySelector('svg').classList.toggle('busy-icon', busy);
  $('cancelButton').classList.toggle('hidden', mode !== 'running');
  $('cancelButton').disabled = !activeJob;
  syncInterface();
}

function resetMetrics() {
  for (const id of ['residualMetric', 'iterationMetric', 'timeMetric', 'adjointMetric', 'stationarityMetric', 'hashMetric']) $(id).textContent = '—';
  setStatus('待运行');
  $('warningBox').classList.add('hidden');
  $('warningBox').textContent = '';
  dirty = false;
  setConfigState('配置就绪');
  syncInterface();
}

function render() {
  if (!problem) {
    for (const id of ['observedPlot', 'sourcePlot', 'residualPlot', 'historyPlot']) emptyPlot($(id), '等待载入数据');
    return;
  }
  channelOptions('channel', problem.observed);
  channelOptions('sourceChannel', result?.estimate || truth || problem.source);
  const channel = Number($('channel').value), sourceChannel = Number($('sourceChannel').value);
  const imaging = layout === 'image' || layout === 'volume';
  $('imageLayer').classList.toggle('hidden', !imaging);
  $('sourceLayer').classList.toggle('hidden', !imaging);
  $('imageLayer').options[1].disabled = !result?.predicted;
  $('sourceLayer').options[1].disabled = !truth;
  if (imaging) {
    const slice = (data, index) => layout === 'volume' ? data?.[Math.min(index, data.length - 1)] : data;
    const predicted = $('imageLayer').value === 'predicted' && result?.predicted;
    const sourceTruth = $('sourceLayer').value === 'truth' && truth;
    const observed = predicted || problem.observed || result?.predicted;
    const source = sourceTruth || result?.estimate || truth || problem.source || problem.observed;
    heatmap($('observedPlot'), slice(observed, channel), dataRange(problem.observed, result?.predicted));
    heatmap($('sourcePlot'), slice(source, sourceChannel), dataRange(result?.estimate, truth, problem.source, source));
    if (result?.residual) heatmap($('residualPlot'), slice(result.residual, channel), dataRange(result.residual));
    else emptyPlot($('residualPlot'), '运行分析后查看残差分布');
    legend('observedLegend', [{ name: (predicted ? '重构' : '观测') + (layout === 'volume' ? ' · 切片 ' + (channel + 1) : '') }]);
    legend('sourceLegend', [{ name: (sourceTruth || !result && truth ? '真值参考' : result ? '恢复' : '输入') + (layout === 'volume' ? ' · 切片 ' + (sourceChannel + 1) : '') }]);
  } else {
    const observedValues=seriesArray(problem.observed, channel);
    const visibleObserved=msProject?.dataset.valid ? observedValues.map((v,i)=>msProject.dataset.valid[channel][i] ? v : NaN) : observedValues;
    const observed = [{ name: '观测', data: visibleObserved, color: '#7c828c', width: 1.4 }];
    if (result?.predicted) observed.push({ name: '重构', data: seriesArray(result.predicted, channel), color: colors[0] });
    plot($('observedPlot'), observed, { height: $('observedPlot').clientHeight, xvalues: axis });
    legend('observedLegend', observed);
    const source = [];
    if (truth) source.push({ name: '真值参考', data: seriesArray(truth, sourceChannel), color: colors[1], dash: true });
    if (result?.estimate) source.push({ name: msProject?(msProject.analysis?.species[sourceChannel] || result.species?.[sourceChannel] || '分离组分'):'恢复', data: seriesArray(result.estimate, sourceChannel), color: colors[0] });
    else if (problem.source) source.push({ name: '输入', data: seriesArray(problem.source, sourceChannel), color: colors[0] });
    plot($('sourcePlot'), source, { height: $('sourcePlot').clientHeight, xvalues: axis });
    legend('sourceLegend', source);
    plot($('residualPlot'), result?.residual ? [{ name: '残差', data: seriesArray(result.residual, channel) }] : [], { height: $('residualPlot').clientHeight, xvalues: axis });
  }
  if (!result && problem.task === 'inverse') {
    emptyPlot($('sourcePlot'), '点击「开始分析」，查看还原结果');
    legend('sourceLegend', []);
  }
  if (result?.curve) {
    plot($('sourcePlot'), [{ name: 'GCV', data: result.curve.map(row => row.gcv) }], { height: $('sourcePlot').clientHeight, xvalues: result.curve.map(row => row.alpha), log: true });
    legend('sourceLegend', [{ name: 'GCV' }]);
  }
  if (result?.lower && layout === 'series') {
    const bands = [{ name: '下界', data: result.lower, dash: true }, { name: '估计', data: result.estimate }, { name: '上界', data: result.upper, dash: true }];
    plot($('sourcePlot'), bands, { height: $('sourcePlot').clientHeight, xvalues: axis });
    legend('sourceLegend', bands);
  }
  plot($('historyPlot'), result?.history?.length ? [{ name: '目标函数', data: result.history.map(row => row.objective), color: '#686d75' }] : [], { height: $('historyPlot').clientHeight, xvalues: result?.history?.map(row => row.iteration) });
  if (result && !result.history?.length) emptyPlot($('historyPlot'), '当前任务未提供迭代历史');
  let kernel = problem.operator.kernel || problem.operator.kernels?.[0] || [];
  while (Array.isArray(kernel[0])) kernel = kernel[Math.floor(kernel.length / 2)];
  const holder = document.createElement('div');
  plot(holder, [{ name: 'h', data: kernel }], { mini: true });
  $('kernelPlot').replaceChildren(...holder.querySelector('svg')?.childNodes || []);
  if (result) {
    $('residualMetric').textContent = fmt(result.relative_residual);
    $('iterationMetric').textContent = result.iterations ?? '—';
    $('timeMetric').textContent = Number.isFinite(result.elapsed_s) ? fmt(result.elapsed_s) + ' s' : '—';
    const statistical = !!(result.curve || result.lower);
    const completed = statistical || result.converged !== false;
    setStatus(statistical ? '统计完成' : completed ? '分析完成' : '未收敛', completed ? 'success' : 'warning', completed ? '结果已更新，可导出查看' : '请展开分析详情查看诊断');
    $('adjointMetric').textContent = fmt(result.diagnostics?.adjoint_relative_error ?? result.audit?.adjoint_relative_error);
    $('stationarityMetric').textContent = fmt(result.diagnostics?.stationarity ?? result.diagnostics?.fixed_point_residual ?? result.diagnostics?.normal_residual);
    $('hashMetric').textContent = result.audit?.source || problem.metadata?.name || '本地数据';
    $('warningBox').textContent = (result.warnings || []).join(' ');
    $('warningBox').classList.toggle('hidden', !result.warnings?.length);
  }
  if (dirty) setStatus('待重算', 'warning', '参数已修改，图表保留上次结果');
  syncInterface();
}

function fillControls() {
  const parameters = problem.parameters || {}, operator = problem.operator;
  $('task').value = problem.task;
  $('method').value = problem.method;
  $('mode').value = operator.mode || 'causal';
  $('boundary').value = operator.boundary || 'zero';
  $('engine').value = operator.engine || 'fft';
  $('sampleVolume').value = operator.sample_volume ?? 1;
  $('alpha').value = parameters.l2 ?? parameters.alpha ?? .003;
  $('l1').value = parameters.l1 ?? 0;
  $('iterations').value = parameters.max_iter ?? 1000;
  $('order').value = parameters.order ?? 1;
  $('tolerance').value = parameters.tol ?? 1e-6;
  $('nonnegative').checked = parameters.nonnegative !== false;
  $('loss').value = parameters.loss || 'gaussian';
  for (const id of ['mode', 'boundary', 'engine', 'sampleVolume']) $(id).disabled = operator.kind !== 'convolution';
  $('fileName').textContent = (problem.metadata?.name || 'project') + '.json';
  $('fileName').title = $('fileName').textContent;
  updateDisabled();
  render();
}

function updateDisabled() {
  const method = $('method').value, task = $('task').value;
  for (const id of ['l1', 'order', 'loss', 'nonnegative', 'iterations', 'tolerance', 'alpha', 'method']) $(id).disabled = false;
  $('l1').disabled = !['fista', 'pars', 'gpu_fista'].includes(method);
  $('order').disabled = !['fista', 'tikhonov', 'pars'].includes(method);
  $('loss').disabled = method !== 'fista';
  if (method === 'pars') $('loss').value = 'gaussian';
  $('nonnegative').disabled = ['wiener', 'richardson_lucy'].includes(method);
  if (method === 'wiener') { $('iterations').disabled = true; $('tolerance').disabled = true; }
  if (method === 'richardson_lucy') $('alpha').disabled = true;
  $('alphaName').textContent = ['fista', 'pars', 'gpu_fista'].includes(method) ? 'λ₂ 正则化' : method === 'tv' ? 'λTV 正则化' : 'α 正则化';
  if (task !== 'inverse') {
    for (const id of ['method', 'l1', 'order', 'loss', 'nonnegative', 'iterations', 'tolerance', 'alpha']) $(id).disabled = true;
    if (task === 'gcv') $('order').disabled = false;
    if (task === 'bootstrap') for (const id of ['alpha', 'order']) $(id).disabled = false;
    if (task === 'kernel') for (const id of ['alpha', 'iterations', 'tolerance', 'nonnegative']) $(id).disabled = false;
    if (task === 'blind') $('iterations').disabled = false;
  }
  if (typeof updateMSControls === 'function') updateMSControls();
  syncInterface();
}

function markDirty() {
  if (!problem || busy) return;
  updateDisabled();
  if (result) { dirty = true; setStatus('待重算', 'warning', '参数已修改，图表保留上次结果'); }
  else setStatus('待运行', 'idle', '参数已更新，准备好后运行分析');
  setConfigState('参数已修改');
  syncInterface();
}

function validateControls() {
  const invalid = [...$('configuration').querySelectorAll('input, select')].find(node => !node.disabled && !node.checkValidity());
  if (!invalid) return true;
  for (let ancestor = invalid.parentElement; ancestor && ancestor !== $('configuration'); ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS') ancestor.open = true;
  }
  invalid.reportValidity();
  invalid.focus();
  return false;
}

async function loadDemo() {
  if (busy) return;
  if ($('demo').value === 'dems' && typeof loadMSDemo === 'function') return loadMSDemo();
  setBusy('loading');
  try {
    const data = await api('/demo/' + $('demo').value);
    msProject = null;
    problem = data.problem; truth = data.truth; axis = data.axis || null; layout = data.layout;
    result = null; msResultJobId = null; dirty = false;
    $('imageLayer').value = 'observed'; $('sourceLayer').value = 'estimate';
    fillControls(); resetMetrics();
    $('footerStatus').textContent = 'READY';
  } catch (error) { toast(error.message); }
  finally { setBusy(); }
}

async function run() {
  if (!problem || busy || activeJob || !validateControls()) return;
  try {
    const submittedProblem = getProblem();
    if (msProject) msProject = submittedProblem; else problem = submittedProblem;
    result = null; msResultJobId = null; invalidateDEMSReport(); dirty = false;
    resetMetrics(); render(); setBusy('running');
    setStatus('计算中', 'running', '正在等待求解器返回结果');
    setConfigState('正在求解');
    $('footerStatus').textContent = 'RUNNING';
    const submitted = await api('/jobs', { method: 'POST', body: JSON.stringify(submittedProblem) });
    activeJob = submitted.id; $('cancelButton').disabled = false;
    while (activeJob) {
      await new Promise(resolve => setTimeout(resolve, 180));
      const state = await api('/jobs/' + submitted.id);
      if (state.progress) {
        $('iterationMetric').textContent = state.progress.iteration;
        $('footerStatus').textContent = 'ITERATION ' + state.progress.iteration;
      }
      if (state.status === 'completed') {
        result = await api('/jobs/' + submitted.id + '/result');
        msResultJobId = msProject ? submitted.id : null;
        render(); setConfigState('计算完成');
        $('footerStatus').textContent = 'COMPLETED';
        break;
      }
      if (['failed', 'cancelled', 'interrupted'].includes(state.status)) {
        if (state.status === 'cancelled') {
          setStatus('已取消', 'idle', '可调整参数后重新运行');
          setConfigState('计算已取消'); $('footerStatus').textContent = 'CANCELLED';
          break;
        }
        throw new Error(state.error || state.status);
      }
    }
  } catch (error) {
    toast(error.message);
    setStatus('计算失败', 'error', '请检查参数或查看错误提示');
    setConfigState('请检查配置');
    $('footerStatus').textContent = 'FAILED';
  } finally { activeJob = null; setBusy(); }
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function openEditor(mode) {
  if (!problem || busy) return;
  editorMode = mode;
  $('editorTitle').textContent = mode === 'kernel' ? '编辑响应核' : '编辑项目配置';
  $('editorError').textContent = '';
  $('editorText').value = JSON.stringify(mode === 'kernel' ? (msProject ? msProject.analysis?.kernels || [] : problem.operator.kernel || problem.operator.kernels) : msProject || getProblem(), null, 2);
  $('editor').showModal();
}

function adoptProject(data) {
  if (data.schema_version === 'web-ms-1.0' || data.dataset?.schema_version === 'ms-1.0') return adoptMSProject(data);
  if (data.schema_version === 'ms-1.0') return adoptMSProject({dataset:data,analysis:null});
  const next = data.problem || data;
  if (!next || !next.operator) throw new Error('项目缺少 operator，请导入有效的项目 JSON');
  msProject = null;
  msResultJobId = null;
  problem = next; truth = data.truth || null; axis = data.axis || next.metadata?.axis || null;
  layout = data.layout || inferLayout(next); result = null; dirty = false;
  $('imageLayer').value = 'observed'; $('sourceLayer').value = 'estimate';
  fillControls(); resetMetrics(); $('footerStatus').textContent = 'READY';
}

function applyEditor() {
  try {
    const value = JSON.parse($('editorText').value);
    if (editorMode === 'kernel') {
      if (!Array.isArray(value) || !value.length) throw new Error('响应核应为非空数值数组');
      if (msProject) {
        if (!msProject.analysis) throw new Error('请先添加候选组分或导入响应矩阵');
        msProject.analysis.kernels = value; msProject.analysis.model = 'spectrotemporal';
        adoptMSProject(msProject);
      } else if (problem.operator.kind === 'spectrotemporal') problem.operator.kernels = value;
      else problem.operator.kernel = value;
      result = null; dirty = false; fillControls(); resetMetrics();
    } else adoptProject(value);
    $('editor').close();
    toast('配置已应用');
  } catch (error) { $('editorError').textContent = error.message; }
}

async function importFile(file) {
  if (typeof importWorkbenchFile === 'function') return importWorkbenchFile(file);
  if (busy) return;
  setBusy('loading');
  try {
    if (file.size > 32e6) throw new Error('文件超过 32 MB');
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.csv')) {
      csvData = parseCSV(text);
      for (const id of ['csvY', 'csvTime', 'csvKernel']) {
        $(id).replaceChildren();
        if (id !== 'csvY') $(id).add(new Option('无', '-1'));
        csvData.names.forEach((name, index) => $(id).add(new Option(name, index)));
      }
      $('csvDialog').showModal();
    } else if (file.name.toLowerCase().endsWith('.json')) {
      adoptProject(JSON.parse(text));
      $('fileName').textContent = file.name; $('fileName').title = file.name;
      toast('项目已导入');
    } else throw new Error('请选择 JSON 或 CSV 文件');
  } catch (error) { toast(error.message); }
  finally { setBusy(); }
}

function applyCSV() {
  try {
    const yi = Number($('csvY').value), ti = Number($('csvTime').value), ki = Number($('csvKernel').value);
    const observed = csvData.rows.map(row => row[yi]);
    if (observed.some(value => !Number.isFinite(value))) throw new Error('观测列包含缺失值或非数值');
    const time = ti < 0 ? null : csvData.rows.map(row => row[ti]);
    if (time) {
      const delta = time[1] - time[0];
      if (delta <= 0 || time.some((value, i) => !Number.isFinite(value) || (i && Math.abs(value - time[i - 1] - delta) > 1e-5 * Math.abs(delta)))) throw new Error('时间列不是均匀递增网格；请使用 nonuniform 算子 JSON');
    }
    const kernel = ki < 0 ? [1] : csvData.rows.map(row => row[ki]).filter(Number.isFinite);
    adoptProject({ operator: { kind: 'convolution', kernel, input_shape: [observed.length], mode: 'causal', engine: 'fft' }, schema_version: '1.0', task: 'inverse', observed, method: 'fista', parameters: { l2: .003, max_iter: 1500, tol: 1e-6, nonnegative: true }, metadata: { synthetic: false, name: 'imported', kernel_identity: ki < 0, axis: time } });
    $('csvDialog').close();
    toast(ki < 0 ? '已导入。当前使用单位核，请按需编辑响应核。' : 'CSV 数据已导入');
  } catch (error) { toast(error.message); }
}

async function changeView(name) {
  if (name === 'model') { openEditor('project'); return; }
  view = name;
  document.querySelectorAll('.view').forEach(node => node.classList.toggle('hidden', node.id !== name));
  document.querySelectorAll('.nav[data-view]').forEach(node => {
    const selected = node.dataset.view === name;
    node.classList.toggle('active', selected);
    if (selected) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  $('viewLabel').textContent = { workspace: '工作台', spectra: '标准图谱库', records: '记录' }[name];
  if (name === 'spectra') await initializeLibrary();
  if (name === 'records') await loadRecords();
  if (name === 'workspace') render();
  syncInterface();
}

function table(container, headers, rows) {
  const node = document.createElement('table'), head = document.createElement('thead'), header = document.createElement('tr');
  headers.forEach(value => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = value; header.appendChild(cell); });
  head.appendChild(header); node.appendChild(head);
  const body = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(value => { const cell = document.createElement('td'); if (value instanceof Node) cell.appendChild(value); else cell.textContent = value; tr.appendChild(cell); });
    body.appendChild(tr);
  });
  node.appendChild(body); container.replaceChildren(node);
}

function tableMessage(container, message) {
  const node = document.createElement('p');
  node.className = 'dialog-description'; node.textContent = message;
  container.replaceChildren(node);
}

async function loadBenchmarks() {
  tableMessage($('benchmarkTable'), '正在载入参考记录…');
  try {
    const data = await api('/benchmarks');
    if (!data.cases) { tableMessage($('benchmarkTable'), '暂无基准记录'); return; }
    const rows = [];
    for (const item of data.cases) for (const [engine, timing] of Object.entries(item.timings)) rows.push([item.name, engine, fmt(timing.median_ms) + ' ms', fmt(timing.p10_ms) + '–' + fmt(timing.p90_ms), timing.relative_error == null ? '—' : fmt(timing.relative_error)]);
    table($('benchmarkTable'), ['规模', '引擎', '中位数', 'P10–P90 / ms', '相对误差'], rows);
    $('benchmarkHardware').textContent = data.environment.cpu_model || 'CPU';
    $('benchmarkEnvironment').textContent = JSON.stringify({ environment: data.environment, protocol: data.protocol, gpu: data.gpu }, null, 2);
  } catch (error) { tableMessage($('benchmarkTable'), '无法读取基准记录，请稍后重试。'); toast(error.message); }
}

async function loadRecords() {
  tableMessage($('recordsTable'), '正在读取计算记录…');
  try {
    const records = await api('/jobs');
    if (!records.length) { tableMessage($('recordsTable'), '还没有计算记录。运行一次分析后，可在这里重新打开。'); return; }
    const labels = { completed: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断', running: '计算中', queued: '排队中' };
    table($('recordsTable'), ['时间', '方法', '状态', '操作'], records.map(record => {
      const status = document.createElement('span');
      status.className = 'record-status ' + record.status; status.textContent = labels[record.status] || record.status;
      const button = document.createElement('button');
      button.textContent = '打开结果'; button.disabled = record.status !== 'completed' || busy;
      button.onclick = async () => {
        if (busy) return;
        setBusy('loading'); button.disabled = true;
        try {
          const [input, output] = await Promise.all([api('/jobs/' + record.id + '/input'), api('/jobs/' + record.id + '/result')]);
          adoptProject(input); result = output; msResultJobId = msProject ? record.id : null;
          fillControls(); setConfigState('已载入历史结果');
          await changeView('workspace'); $('footerStatus').textContent = 'COMPLETED';
        } catch (error) { toast(error.message); }
        finally { setBusy(); button.disabled = false; }
      };
      return [new Date(record.created * 1000).toLocaleString(), record.method.toUpperCase(), status, button];
    }));
  } catch (error) { tableMessage($('recordsTable'), '无法读取计算记录，请刷新重试。'); toast(error.message); }
}

async function initialize() {
  try {
    const capability = await api('/capabilities');
    capabilityInfo = capability;
    $('onlineDot').classList.add('online'); $('onlineStatus').textContent = 'Convolvex 已连接';
    $('onlineDot').parentElement.title = 'Convolvex 已连接';
    [...$('method').options].find(option => option.value === 'gpu_fista').disabled = !capability.gpu.available;
    [...$('engine').options].find(option => option.value === 'cpp').disabled = !capability.cpp;
    await loadDemo();
  } catch (error) {
    $('onlineDot').classList.remove('online'); $('onlineStatus').textContent = '连接失败';
    $('onlineDot').parentElement.title = '连接失败';
    $('footerStatus').textContent = 'DISCONNECTED';
    setStatus('未连接', 'error', '检查 Convolvex Python 服务是否可用');
    toast(error.message);
  }
}

$('runButton').onclick = run;
$('loadDemo').onclick = loadDemo;
$('tryDemo').onclick = () => { $('demo').value = 'dems'; loadDemo(); };
$('openProjectEditor').onclick = () => { $('projectMenu').open = false; openEditor('project'); };
$('configuration').addEventListener('input', event => { if (event.target.id !== 'demo') markDirty(); });
$('configuration').addEventListener('change', event => { if (event.target.id !== 'demo') markDirty(); });
$('applyEditor').onclick = applyEditor;
$('editProject').onclick = () => openEditor('project');
$('editKernel').onclick = () => openEditor('kernel');
$('importButton').onclick = () => { $('fileInput').value = ''; $('fileInput').click(); };
$('dropZone').onclick = () => $('importButton').click();
$('fileInput').onchange = event => { if (event.target.files[0]) importFile(event.target.files[0]); };
$('dropZone').ondragover = event => { event.preventDefault(); if (!busy) $('dropZone').classList.add('dragging'); };
$('dropZone').ondragleave = () => $('dropZone').classList.remove('dragging');
$('dropZone').ondrop = event => { event.preventDefault(); $('dropZone').classList.remove('dragging'); if (event.dataTransfer.files[0]) importFile(event.dataTransfer.files[0]); };
$('applyCSV').onclick = applyCSV;
$('exportProject').onclick = () => { try { download('convolvex-project.json', msProject && !msProject.analysis ? msProject.dataset : getProblem()); } catch (error) { toast(error.message); } };
$('exportResult').onclick = () => { if (result && !dirty) download('convolvex-result.json', result); };
for (const id of ['imageLayer', 'sourceLayer', 'channel', 'sourceChannel']) $(id).onchange = render;
$('resetZoom').onclick = render;
$('refreshRecords').onclick = loadRecords;
$('cancelButton').onclick = async () => {
  if (!activeJob) return;
  $('cancelButton').disabled = true;
  try { await api('/jobs/' + activeJob + '/cancel', { method: 'POST' }); }
  catch (error) { toast(error.message); $('cancelButton').disabled = false; }
};
document.querySelectorAll('.nav[data-view]').forEach(button => { button.onclick = () => changeView(button.dataset.view); });
$('authButton').onclick = () => {
  if (busy) return;
  const value = prompt('访问令牌（仅保存在当前浏览器会话）', token);
  if (value !== null) { token = value.trim(); try { sessionStorage.setItem('convolvexToken', token); } catch (_) {} initialize(); }
};
$('mobileAuth').onclick = () => $('authButton').click();
$('dismissToast').onclick = () => { clearTimeout(toastTimer); $('toast').classList.add('hidden'); };
document.addEventListener('click', event => { if (!$('projectMenu').contains(event.target)) $('projectMenu').open = false; });
$('analysisDetails').addEventListener('toggle', () => { if ($('analysisDetails').open && view === 'workspace') render(); });
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
$('runButton').querySelector('kbd').textContent = mac ? '⌘ ↵' : 'Ctrl ↵';
$('shortcutHint').textContent = mac ? '⌘ Enter' : 'Ctrl Enter';
window.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !document.querySelector('dialog[open]')) { event.preventDefault(); run(); }
});
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (view === 'workspace') render(); }, 160);
});
render();

'use strict';
let demsReport = null, demsMode = false, demsProcessing = false, demsSequence = 0;
const demsFields = {
  start_s:'demsStart',stop_s:'demsStop',mz:'demsMz',species_index:'demsSpecies',lookup:'demsLookup',lookup_value:'demsValue',lookup_tolerance:'demsTolerance',
  potential_reference:'demsReference',equilibrium_potential_V:'demsEquilibrium',uncompensated_resistance_ohm:'demsResistance',electrode_area_cm2:'demsArea',
  ec_time_offset_s:'demsOffset',transport_delay_s:'demsDelay',baseline:'demsBaseline',ion_polarity:'demsPolarity',tafel_basis:'demsBasis',tafel_min_V:'demsMinPotential',tafel_max_V:'demsMaxPotential',
  tafel_bins:'demsBins',direction:'demsDirection',steady_state_confirmed:'demsSteady',complete_window_confirmed:'demsComplete'
};
const demsStringFields = new Set(['lookup','potential_reference','tafel_basis','direction']);
const demsBooleanFields = new Set(['steady_state_confirmed','complete_window_confirmed']);

function invalidateDEMSReport() {
  demsSequence++;demsReport=null;$('demsResults').classList.add('hidden');$('demsEmpty').classList.remove('hidden');
  $('demsError').textContent='';
}

function loadDEMSSettings() {
  invalidateDEMSReport();
  if(!msProject)return;
  const d=msProject.dataset;
  const defaults={start_s:d.time_s[0],stop_s:d.time_s.at(-1),mz:d.mz[0],species_index:0,lookup:'time',lookup_value:(d.time_s[0]+d.time_s.at(-1))/2,
    lookup_tolerance:.01,potential_reference:d.metadata?.potential_reference || 'as imported',equilibrium_potential_V:null,
    uncompensated_resistance_ohm:0,electrode_area_cm2:null,ec_time_offset_s:0,transport_delay_s:0,baseline:0,ion_polarity:1,tafel_basis:'species',
    tafel_min_V:null,tafel_max_V:null,tafel_bins:10,direction:'cathodic',steady_state_confirmed:false,complete_window_confirmed:false};
  const s={...defaults,...(msProject.dems || {})};
  $('demsMz').replaceChildren(...d.mz.map(m=>new Option('m/z '+m,String(m))));
  $('demsReferenceMz').replaceChildren(...d.mz.map(m=>new Option('m/z '+m,String(m))));
  $('demsSpecies').replaceChildren(...(msProject.analysis?.species || ['待完成组分分离']).map((name,i)=>new Option(name,String(i))));
  for(const [key,id] of Object.entries(demsFields)) {
    if(demsBooleanFields.has(key))$(id).checked=!!s[key];else $(id).value=s[key] ?? '';
  }
  if(!$('demsMz').value)$('demsMz').selectedIndex=0;
  if(!$('demsSpecies').value)$('demsSpecies').selectedIndex=0;
  updateDEMSLookup();loadSpeciesCalibration();
}

function readDEMSSettings() {
  const s={calibrations:msProject?.dems?.calibrations || []};
  for(const [key,id] of Object.entries(demsFields)) {
    const v=$(id).value;
    s[key]=demsBooleanFields.has(key)?$(id).checked:demsStringFields.has(key)?v:v===''?null:Number(v);
  }
  return s;
}

function syncDEMSControls() {
  const isMS=!!msProject;
  $('analysisTabs').classList.toggle('hidden',!isMS);
  if(!isMS)demsMode=false;
  $('demsView').classList.toggle('hidden',!isMS || !demsMode);
  document.querySelector('.signal-grid').classList.toggle('hidden',isMS && demsMode);
  $('analysisDetails').classList.toggle('hidden',isMS && demsMode);
  $('fitTab').setAttribute('aria-selected',String(!demsMode));$('demsTab').setAttribute('aria-selected',String(demsMode));
  $('processDEMS').disabled=busy || demsProcessing || !isMS;
  $('attachEC').disabled=busy || !isMS;
  $('saveDEMSCalibration').disabled=busy || !msProject?.analysis;
  if(!isMS)return;
  const d=msProject.dataset;
  $('demsDataStatus').textContent=(d.potential_V?'已载入电位':'缺少电位')+' · '+(d.current_A?'已载入电化学电流':'缺少电化学电流')+' · '+(result && !dirty?'组分结果可用':'可先处理原始通道；分离组分请运行分析');
  if(dirty && demsReport?.job_id)invalidateDEMSReport();
}

async function switchDEMSView(quick) {
  demsMode=quick;syncDEMSControls();
  if(quick && !demsReport)await updateDEMSReport();else if(quick)renderDEMSReport();else render();
}

function updateDEMSLookup() {
  const mode=$('demsLookup').value;
  $('demsValueLabel').textContent={time:'目标时间 / s',potential:'目标电位 / V',current:'目标电流 / A'}[mode];
  $('demsToleranceLabel').classList.toggle('hidden',mode==='time');
}

function demsRequest(tracePoints=3000) {
  const s=readDEMSSettings();msProject.dems=s;
  return {dataset:msProject.dataset,settings:s,job_id:result && !dirty?msResultJobId:null,trace_points:tracePoints};
}

async function updateDEMSReport(event) {
  event?.preventDefault();
  if(!msProject || busy || demsProcessing || !$('demsForm').reportValidity())return;
  const sequence=++demsSequence;demsProcessing=true;syncDEMSControls();$('demsError').textContent='';
  try {
    const report=await api('/ms/process',{method:'POST',body:JSON.stringify(demsRequest())});
    if(sequence!==demsSequence)return;
    demsReport=report;renderDEMSReport();
  }catch(error){if(sequence===demsSequence){$('demsError').textContent=error.message;$('demsResults').classList.add('hidden');}}
  finally{demsProcessing=false;syncDEMSControls();}
}

function drawDEMSXY(container, datasets, xLabel, yLabel) {
  container.replaceChildren();
  const pairs=datasets.flatMap(s=>s.x.map((x,i)=>[x,s.y[i]]).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)));
  if(pairs.length<2){emptyPlot(container,'需要对应电位与有效信号');return;}
  const w=Math.max(container.clientWidth,240),h=250,p={l:68,r:18,t:26,b:48};
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  pairs.forEach(([x,y])=>{xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);});
  if(xmin===xmax){xmin-=.01;xmax+=.01;}
  const yr=ymax-ymin || Math.abs(ymax)*.2 || 1;ymin-=yr*.07;ymax+=yr*.07;
  const px=x=>p.l+(x-xmin)/(xmax-xmin)*(w-p.l-p.r),py=y=>h-p.b-(y-ymin)/(ymax-ymin)*(h-p.t-p.b);
  const svg=elt('svg',{viewBox:`0 0 ${w} ${h}`,'aria-hidden':'true'});container.appendChild(svg);
  const label=(x,y,text,anchor='start')=>{const n=elt('text',{x,y,fill:'#50545b','font-size':12,'text-anchor':anchor});n.textContent=text;svg.appendChild(n);};
  for(let i=0;i<=4;i++){
    const y=p.t+(h-p.t-p.b)*i/4;
    svg.appendChild(elt('line',{x1:p.l,x2:w-p.r,y1:y,y2:y,stroke:'#e9eae6'}));label(p.l-9,y+4,fmt(ymax-(ymax-ymin)*i/4),'end');
    label(p.l+(w-p.l-p.r)*i/4,h-p.b+21,fmt(xmin+(xmax-xmin)*i/4),'middle');
  }
  label(p.l,15,yLabel);label(w-p.r,h-3,xLabel,'end');
  datasets.forEach((s,k)=>{
    if(s.points){s.x.forEach((x,i)=>{if(!Number.isFinite(x)||!Number.isFinite(s.y[i]))return;const dot=elt('circle',{cx:px(x),cy:py(s.y[i]),r:3.7,fill:'#43474d'});const title=elt('title');title.textContent=`${fmt(x)}, ${fmt(s.y[i])}`;dot.appendChild(title);svg.appendChild(dot);});}
    else {
      let path='';s.x.forEach((x,i)=>{path+=Number.isFinite(x)&&Number.isFinite(s.y[i])?`${i && Number.isFinite(s.x[i-1])&&Number.isFinite(s.y[i-1])?'L':'M'}${px(x)},${py(s.y[i])} `:'';});
      svg.appendChild(elt('path',{d:path,fill:'none',stroke:k?'#888d93':'#43474d','stroke-width':1.7,...(s.dash?{'stroke-dasharray':'5 4'}:{})}));
    }
  });
}

function renderDEMSReport() {
  if(!demsReport)return;
  const r=demsReport,q=r.quantification,ec=r.electrochemistry_charge,tf=r.tafel,s=msProject.dems;
  $('demsResults').classList.remove('hidden');$('demsEmpty').classList.add('hidden');
  renderLSV(r,s);
  $('demsECCharge').textContent=ec.available?fmt(ec[s.direction+'_C'])+' C':'—';
  $('demsECDirection').textContent=ec.available?(s.direction==='cathodic'?'阴极':'阳极')+'积分 · 净电荷 '+fmt(ec.net_C)+' C':ec.reason;
  $('demsProductCharge').textContent=q.available?fmt(q.product_charge_C)+' C':'—';
  $('demsAmount').textContent=q.available?fmt(q.amount_mol)+' mol · '+(q.synthetic?'合成标定':'本机标定'):'需要有效标定与完整窗口';
  $('demsFE').textContent=q.available && q.faradaic_efficiency!==null?fmt(q.faradaic_efficiency*100)+' %':'—';
  $('demsSignalSlope').textContent='dI/dt = '+fmt(r.signal.slope_per_s)+' '+r.signal.slope_unit;
  drawDEMSXY($('demsPotentialPlot'),[{x:r.trace.potential_V,y:r.trace.signal}],'E / V · '+s.potential_reference,'m/z '+r.mz+' · '+r.trace.signal_unit);
  $('demsTafelTitle').textContent=tf.kind==='product_tafel'?'产物 Tafel 曲线':'信号–电位表观斜率';
  $('demsTafelSlope').textContent=tf.available?fmt(tf.slope_mV_dec)+' mV/dec':'—';
  if(tf.available){
    const order=tf.log_current.map((v,i)=>i).sort((a,b)=>tf.log_current[a]-tf.log_current[b]);
    drawDEMSXY($('demsTafelPlot'),[{x:tf.log_current,y:tf.potential_V,points:true},{x:order.map(i=>tf.log_current[i]),y:order.map(i=>tf.fitted_V[i]),dash:true}],
      'log₁₀(I / '+tf.current_unit+')',(tf.potential_axis==='overpotential'?'η':'E')+' / V');
    $('demsTafelQuality').textContent='R² '+fmt(tf.r_squared)+' · '+tf.points+' 个电位分箱 · 标准误 '+fmt(tf.standard_error_mV_dec)+' mV/dec';
  }else{emptyPlot($('demsTafelPlot'),tf.reason);$('demsTafelQuality').textContent='Tafel 拟合：电位对 log₁₀ 电流；dI/dt 单独显示。';}
  $('demsLookupSummary').textContent=r.lookup.matches+' 个匹配点 · '+r.lookup.segments.length+' 段记录';
  if(r.lookup.segments.length)table($('demsLookupTable'),['时间段 / s','电位 / V','EC 电流 / A','MS 信号 / '+r.trace.signal_unit,'点数'],r.lookup.segments.map(g=>[fmt(g.start_s)+'–'+fmt(g.stop_s),fmt(g.mean_potential_V),fmt(g.mean_current_A),fmt(g.mean_signal),g.samples]));
  else tableMessage($('demsLookupTable'),'该区间没有匹配记录，可调整目标值或允许偏差。');
  $('demsIonIntegral').textContent='通道积分 '+fmt(r.signal.integral)+' '+r.signal.integral_unit+' · 覆盖 '+fmt(r.signal.coverage_fraction*100)+' %';
  if(r.components.length)table($('demsComponents'),['候选物质','相对响应','该通道拟合贡献','分离信号'],r.components.filter(c=>c.matches_mz).map(c=>[c.species,fmt(c.response_coefficient),fmt(c.channel_contribution_mean),fmt(c.source_mean)]));
  else tableMessage($('demsComponents'),'从标准谱库添加候选组分并运行分析后，显示复杂体系的组分贡献。');
  $('demsQuantificationNote').textContent=q.available?'物质转化电荷 Q = nF·∫r(t)dt；电化学分母使用原始时间轴的所选方向总电荷。':q.reason;
  $('demsWarnings').replaceChildren(...[...r.warnings,...(tf.warnings || [])].map(message=>{const li=document.createElement('li');li.textContent=message;return li;}));
}

function renderLSV(r,s){
  const lsv=r.lsv;
  $('exportLSV').disabled=!lsv?.available;
  const eLabel='E / V · '+s.potential_reference;
  $('productPolarizationTitle').textContent=(r.selected_species || '所选组分')+' · 极化曲线';
  if(!lsv?.available){
    $('lsvSummary').textContent=lsv?.reason || '导入 LSV 后显示联合曲线';
    emptyPlot($('lsvPlot'),'导入 LSV / EC 记录');
    emptyPlot($('productPolarizationPlot'),'需要组分分离结果与电位记录');$('productPolarizationNote').textContent='';return;
  }
  const raw=lsv.raw_lsv,area=lsv.area_cm2;
  const unit=area?'mA/cm²':'mA';
  $('lsvCurrentUnit').textContent=unit+' · 原始 EC 网格';
  const label={increasing:'阳向单向扫描',decreasing:'阴向单向扫描',mixed:'包含往返扫描',hold:'恒电位',insufficient:'区间点数不足'}[lsv.direction];
  $('lsvSummary').textContent=label+' · 扫描速率 '+fmt(lsv.median_scan_rate_mV_s)+' mV/s · '+
    (lsv.time_source.startsWith('reconstructed')?'时间由扫描速率重建':'保留原始时间')+' · 传输纯延迟 '+fmt(lsv.transport_delay_applied_s)+' s · EC 积分区间 '+lsv.interval_electrochemistry_s.map(fmt).join('–')+' s';
  drawDEMSXY($('lsvPlot'),[{x:raw.corrected_potential_V,y:(raw.current_density_A_cm2 || raw.current_A).map(v=>v*1000)}],eLabel,area?'j_EC / mA·cm⁻²':'I_EC / mA');
  const product=lsv.product_current_density_A_cm2 || lsv.product_current_A;
  const y=product?product.map(v=>v===null?null:v*1000):lsv.source_signal;
  if(y)drawDEMSXY($('productPolarizationPlot'),[{x:lsv.potential_V,y}],eLabel,product?(area?'j_product / mA·cm⁻²':'I_product / mA'):'分离信号 / '+r.trace.signal_unit);
  else emptyPlot($('productPolarizationPlot'),'完成候选组分分离后显示');
  $('productPolarizationNote').textContent=lsv.polarization_scope==='transport_corrected'?'标定后的传输校正分电流；与 LSV 共用电位坐标。':lsv.polarization_scope==='transport_filtered'?'标定后的等效分电流仍含传输滤波，纯延迟平移不能替代传输反卷积。':'未标定：显示按所选标准谱分离的组分信号。';
}

function loadSpeciesCalibration() {
  const index=Number($('demsSpecies').value),a=msProject?.analysis,d=msProject?.dataset;
  const c=msProject?.dems?.calibrations?.find(c=>c.species===a?.species[index]);
  $('demsSensitivity').value=c?.sensitivity_C_per_mol ?? '';$('demsElectrons').value=c?.electrons ?? '';
  const reference=c?.reference_mz ?? (a?d.mz[a.response.map(row=>row[index]).indexOf(Math.max(...a.response.map(row=>row[index])))]:d?.mz[0]);
  $('demsReferenceMz').value=String(reference);
  $('demsCalibrationId').value=c?.record_id || '';$('demsInstrument').value=c?.instrument_id || (d?.instrument_id==='unspecified'?'':d?.instrument_id || '');
  $('demsConditions').value=c?.conditions_id || (d?.conditions_id==='unspecified'?'':d?.conditions_id || '');
  $('demsCalibrationConfirmed').checked=!!c?.confirmed;
  $('demsCalibrationState').textContent=c?'已保存 '+c.species+' 的标定；计算时核对响应及传输模型。':'未配置标定。信号积分和原始电化学电荷仍可查看。';
}

function saveSpeciesCalibration() {
  if(!msProject?.analysis || busy)return;
  const a=getMSProblem().analysis,d=msProject.dataset,i=Number($('demsSpecies').value);
  const sensitivity=Number($('demsSensitivity').value),electrons=Number($('demsElectrons').value);
  const record=$('demsCalibrationId').value.trim(),instrument=$('demsInstrument').value.trim(),conditions=$('demsConditions').value.trim();
  if(!(sensitivity>0)||!Number.isInteger(electrons)||electrons<1||electrons>64||!record||!instrument||!conditions||!$('demsCalibrationConfirmed').checked){
    $('demsCalibrationState').textContent='请填写正灵敏度、整数电子数、记录名称、仪器和实验条件，并确认标定来源。';return;
  }
  const c={species:a.species[i],record_id:record,sensitivity_C_per_mol:sensitivity,electrons,reference_mz:Number($('demsReferenceMz').value),
    instrument_id:instrument,conditions_id:conditions,confirmed:true,includes_collection:true,synthetic:d.synthetic,
    mz:[...d.mz],response_column:a.response.map(row=>row[i]),model:a.model,kernel:a.kernels?.[i] || null,kernel_convention:a.kernel_convention};
  d.instrument_id=instrument;d.conditions_id=conditions;
  const s=readDEMSSettings();s.calibrations=s.calibrations.filter(other=>other.species!==c.species);s.calibrations.push(c);msProject.dems=s;
  invalidateDEMSReport();loadSpeciesCalibration();toast('组分标定已保存；更新分析后计算物质转化电荷。');
}

async function exportDEMS(csv) {
  if(!demsReport || demsProcessing || busy)return;
  try {
    const r=demsReport.trace.stride>1?await api('/ms/process',{method:'POST',body:JSON.stringify(demsRequest(200000))}):demsReport;
    if(!csv){download('dems-analysis.json',{...r,settings:msProject.dems});return;}
    const t=r.trace,columns=['time_MS_s','time_electrode_s','potential_V','current_A','raw_mz_'+r.mz+'_'+t.signal_unit,'blank_background_'+t.signal_unit,'corrected_mz_'+r.mz+'_'+t.signal_unit,
      'species_signal:'+r.selected_species+' ['+t.signal_unit+']',t.rate_scope==='transport_filtered'?'transport_filtered_rate_mol_s':'rate_mol_s','product_current_A','instantaneous_FE','in_selected_interval'];
    const rows=t.time_s.map((time,i)=>[time,t.electrode_time_s[i],t.potential_V[i],t.current_A[i],t.raw_signal[i],t.background[i],t.signal[i],t.source?.[i],t.rate_mol_s?.[i],r.lsv?.product_current_A?.[i],r.lsv?.instantaneous_FE?.[i],time>=r.interval_s[0]&&time<=r.interval_s[1]]);
    downloadCSV('dems-lsv-processed.csv',columns,rows);
  }catch(error){toast(error.message);}
}

function downloadCSV(name,columns,rows){
  const cell=value=>'"'+String(value ?? '').replaceAll('"','""')+'"';
  const text=[columns,...rows].map(row=>row.map(cell).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

function exportRawLSV(){
  const d=msProject?.dataset;if(!d?.potential_V||!d.current_A)return;
  downloadCSV('lsv-original.csv',['ec_time_s','potential_recorded_V','current_recorded_A','time_source'],d.ec_time_s.map((t,i)=>[t,d.potential_V[i],d.current_A[i],d.metadata.ec_time_source || 'recorded time']));
}

$('fitTab').onclick=()=>switchDEMSView(false);$('demsTab').onclick=()=>switchDEMSView(true);
$('demsForm').onsubmit=updateDEMSReport;
$('demsForm').addEventListener('input',invalidateDEMSReport);
$('demsForm').addEventListener('change',()=>{if(msProject)msProject.dems=readDEMSSettings();});
$('demsLookup').onchange=()=>{updateDEMSLookup();$('demsValue').value='';$('demsTolerance').value=$('demsLookup').value==='current'?.0001:.01;};
$('demsSpecies').onchange=loadSpeciesCalibration;
$('saveDEMSCalibration').onclick=()=>{try{saveSpeciesCalibration();}catch(error){$('demsCalibrationState').textContent=error.message;}};
$('attachEC').onclick=()=>{$('ecInput').value='';$('ecInput').click();};
$('ecInput').onchange=event=>{if(event.target.files[0])importWorkbenchFile(event.target.files[0]);};
$('exportDEMS').onclick=()=>exportDEMS(false);$('exportDEMSCSV').onclick=()=>exportDEMS(true);
$('exportLSV').onclick=exportRawLSV;
window.addEventListener('resize',()=>{if(demsMode && demsReport)renderDEMSReport();});

'use strict';
let msSummary = null, importPayload = null, importInfo = null;
let activeSpectrum = null, catalog = null, catalogGroup = 'co2rr', spectrumRequest = 0;
const spectrumAvailability = new Map();

function defaultMSAnalysis(response, species) {
  return {response,species,model:'spectral',kernels:null,kernel_convention:'discrete',method:'fista',
    l2:.003,l1:0,tv_weight:.01,order:1,nonnegative:true,loss:'gaussian',huber_delta:1,
    noise_std:null,background_degree:1,max_iter:1500,tol:1e-6};
}

function adoptMSProject(value, knownTruth = null, summary = null) {
  const project = structuredClone(value.project || value);
  const dataset = project.dataset;
  if (!dataset?.time_s?.length || !dataset.mz?.length || !dataset.signal?.length) throw new Error('DEMS 项目需要 time_s、mz 和 signal');
  if (project.analysis) delete project.analysis.dataset_id;
  msProject = {schema_version:'web-ms-1.0',dataset,analysis:project.analysis || null,dems:project.dems || null};
  msResultJobId = null;
  msSummary = summary;
  const config = msProject.analysis;
  problem = {schema_version:'1.0',task:'inverse',method:config?.method || 'fista',observed:dataset.signal,
    operator:{kind:config?.model === 'spectrotemporal' ? 'spectrotemporal' : 'mixing',
      response:config?.response || [],kernels:config?.kernels || [],samples:dataset.time_s.length},
    parameters:{l2:config?.l2 ?? .003,l1:config?.l1 ?? 0,max_iter:config?.max_iter ?? 1500,
      tol:config?.tol ?? 1e-6,order:config?.order ?? 1,nonnegative:config?.nonnegative !== false,loss:config?.loss || 'gaussian'},
    metadata:{...dataset.metadata,name:dataset.metadata?.name || 'DEMS',synthetic:dataset.synthetic,units:dataset.signal_unit}};
  truth = knownTruth; axis = dataset.time_s; layout = 'channels'; result = null; dirty = false;
  $('msModel').value = config?.model || 'spectral';
  $('msKernelConvention').value = config?.kernel_convention || 'discrete';
  $('msTVWeight').value = config?.tv_weight ?? .01;
  $('msBlankEnabled').checked=!!config?.blank_windows_s?.length;
  $('msBlankStart').value=config?.blank_windows_s?.[0]?.[0] ?? '';
  $('msBlankStop').value=config?.blank_windows_s?.[0]?.[1] ?? '';
  $('msBlankModel').value=config?.blank_model || 'constant';
  loadDEMSSettings();fillControls(); resetMetrics();
  $('footerStatus').textContent = 'READY';
}

function getMSProblem() {
  if (!msProject.analysis) throw new Error('请从标准谱库添加候选组分，或导入响应矩阵');
  const project = structuredClone(msProject), config = project.analysis, method = $('method').value;
  Object.assign(config,{method,model:$('msModel').value,kernel_convention:$('msKernelConvention').value,
    l2:Number($('alpha').value),l1:['fista','channel_pars'].includes(method) ? Number($('l1').value) : 0,
    tv_weight:Number($('msTVWeight').value),order:Number($('order').value),nonnegative:$('nonnegative').checked,
    loss:method === 'fista' ? $('loss').value : 'gaussian',max_iter:Number($('iterations').value),tol:Number($('tolerance').value)});
  if($('msBlankEnabled').checked && (!$('msBlankStart').value || !$('msBlankStop').value))throw new Error('空白背景校正需要填写起止时间');
  config.blank_windows_s=$('msBlankEnabled').checked?[[Number($('msBlankStart').value),Number($('msBlankStop').value)]]:[];
  config.blank_model=$('msBlankModel').value;
  if (config.model === 'spectral') config.kernels = null;
  else if (!config.kernels?.length || config.kernels.length !== config.species.length) throw new Error('谱–时间反演需要为每个组分提供传输核，请在高级设置中编辑核函数');
  return project;
}

function updateMSControls() {
  const isMS = !!msProject, method = $('method').value;
  $('task').disabled = isMS;
  document.querySelectorAll('.ms-only').forEach(node => node.classList.toggle('hidden',!isMS));
  document.querySelectorAll('.legacy-only').forEach(node => node.classList.toggle('hidden',isMS));
  for (const option of $('method').options) {
    option.hidden = !isMS && option.value === 'channel_pars';
    option.disabled = isMS ? !['fista','tikhonov','tv','channel_pars'].includes(option.value) : option.value === 'gpu_fista' && !capabilityInfo?.gpu?.available;
  }
  $('msTVLabel').classList.toggle('hidden',!isMS || method !== 'tv');
  $('msTVWeight').disabled = !isMS || method !== 'tv';
  if (isMS) {
    $('l1').disabled = !['fista','channel_pars'].includes(method);
    $('order').disabled = method === 'tv';
    $('loss').disabled = method !== 'fista';
    $('nonnegative').disabled = false; $('iterations').disabled = false; $('tolerance').disabled = false; $('alpha').disabled = false;
    $('alphaName').textContent = 'λ₂ 正则化';
  }
}

function syncMSInterface() {
  const data = msProject?.dataset, config = msProject?.analysis;
  $('msSetup').classList.toggle('hidden',!data);
  $('observedTitle').textContent = data ? 'm/z 通道信号' : '观测信号';
  $('sourceTitle').textContent = !data ? '还原结果' : config?.model === 'spectrotemporal' ? '传输校正结果' : '谱分离结果';
  $('addSpectrum').disabled = !activeSpectrum || !data || busy;
  $('spectrumName').disabled = !activeSpectrum || busy;
  syncDEMSControls();
  if (!data) return;
  $('msDataSummary').textContent = data.mz.length+' 个通道 · '+data.time_s.length.toLocaleString()+' 个时间点 · '+data.signal_unit;
  $('modelSummary').textContent = $('msModel').value === 'spectrotemporal' ? '谱–时间联合' : '谱分离';
  [...$('channel').options].forEach((option,i) => { option.textContent = 'm/z '+data.mz[i]; });
  [...$('sourceChannel').options].forEach((option,i) => { option.textContent = config?.species[i] || '待配置'; });
  $('speciesList').replaceChildren();
  (config?.species || []).forEach((name,index) => {
    const row = document.createElement('div'); row.className = 'species-row';
    const label = document.createElement('span'); label.textContent = name;
    const remove = document.createElement('button'); remove.type='button'; remove.className='icon-button'; remove.textContent='×'; remove.setAttribute('aria-label','移除 '+name); remove.disabled=busy;
    remove.onclick = () => {
      const next=structuredClone(msProject), a=next.analysis;
      a.species.splice(index,1); a.response.forEach(r=>r.splice(index,1)); a.kernels?.splice(index,1);
      if (!a.species.length) next.analysis=null;
      next.dataset.metadata.spectrum_references=(next.dataset.metadata.spectrum_references || []).filter(ref=>(ref.display_name || ref.name)!==name);
      adoptMSProject(next);
    };
    row.append(label,remove); $('speciesList').appendChild(row);
  });
  const missingKernel = $('msModel').value === 'spectrotemporal' && !config?.kernels?.length;
  $('runButton').disabled = busy || !config || missingKernel || view !== 'workspace';
  $('msResponseHint').textContent = !config ? '添加候选组分后建立响应矩阵。' : missingKernel ? '联合反演需要导入传输核。' : config.model === 'spectral' ? '当前仅做谱分离，未校正传输。' : '使用给定响应矩阵与传输核。';
  if (!config && !busy) setStatus('待配置','idle','添加候选组分或导入响应矩阵');
  document.querySelectorAll('.plot-hint').forEach((node,index) => {node.textContent=index ? data.signal_unit+'（响应等效）' : '时间 / s · '+data.signal_unit;});
}

async function loadMSDemo() {
  if (busy) return;
  setBusy('loading');
  try {
    const data=await api('/ms/demo');
    adoptMSProject(data.project,data.truth,data.summary);
    $('fileName').textContent='dems.json';
  } catch(error) { toast(error.message); }
  finally { setBusy(); }
}

async function importWorkbenchFile(file) {
  if (busy) return;
  if (file.size>20_000_000) { toast('导入文件超过 20 MB'); return; }
  setBusy('loading');
  try {
    const extension=file.name.split('.').pop().toLowerCase();
    if (extension==='json') {
      const data=JSON.parse(await file.text());
      if (Array.isArray(data.mz) && Array.isArray(data.intensity)) {
        if(data.mz.length!==data.intensity.length)throw new Error('图谱的 m/z 与强度长度不一致');
        const text='##TITLE='+(data.name || file.name).replace(/[\r\n]/g,' ')+'\n##DATA TYPE=MASS SPECTRUM\n##PEAK TABLE=(XY..XY)\n'+data.mz.map((m,i)=>m+','+data.intensity[i]).join('\n')+'\n##END=';
        activeSpectrum=await api('/spectra/import',{method:'POST',body:JSON.stringify({filename:file.name,text,name:data.display_name || data.name || file.name,cas:data.cas || null,formula:data.formula || null})});
        activeSpectrum.source='local spectrum JSON';await changeView('spectra');drawReferenceSpectrum();
        return;
      } else if (data.schema_version==='web-ms-1.0' && data.analysis) {
        const checked=await api('/ms/project/validate',{method:'POST',body:JSON.stringify(data)});
        adoptMSProject(checked.project,null,checked.summary);
      } else if (data.schema_version==='ms-1.0' || data.time_s && data.mz && data.signal || data.dataset?.time_s) {
        const dataset=data.dataset || data;
        const checked=await api('/ms/dataset',{method:'POST',body:JSON.stringify(dataset)});
        adoptMSProject({dataset:checked.dataset,analysis:null},null,checked.summary);
      } else adoptProject(data);
      $('fileName').textContent=file.name; toast('数据已导入');
    } else if (['jdx','dx','jcamp'].includes(extension)) {
      spectrumRequest++;$('searchSpectrum').disabled=false;$('spectrumChoices').classList.add('hidden');
      activeSpectrum=await api('/spectra/import',{method:'POST',body:JSON.stringify({filename:file.name,text:await file.text()})});
      await changeView('spectra'); drawReferenceSpectrum();
    } else if (['csv','tsv','txt','xlsx'].includes(extension)) {
      importPayload={filename:file.name};
      if (extension==='xlsx') {
        const bytes=new Uint8Array(await file.arrayBuffer()); let binary='';
        for(let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
        importPayload.content_base64=btoa(binary);
      } else importPayload.text=await file.text();
      await showImportPreview(); $('importDialog').showModal();
    } else throw new Error('支持 CSV、TSV、TXT、XLSX、JSON 和 JCAMP-DX 质谱');
  } catch(error) { toast(error.message); }
  finally { setBusy(); }
}

async function showImportPreview() {
  importInfo=await api('/import/preview',{method:'POST',body:JSON.stringify(importPayload)});
  $('importError').textContent='';
  $('importSynthetic').checked=false;
  $('importSummary').textContent=importPayload.filename+' · '+importInfo.rows.toLocaleString()+' 行 · 时间 '+importInfo.time_unit+' · 信号 '+(importInfo.signal_unit==='auto'?'按列识别':importInfo.signal_unit);
  table($('importPreview'),importInfo.columns,importInfo.preview);
  $('importSheet').replaceChildren(...importInfo.sheets.map(name=>new Option(name,name)));
  if(importInfo.sheet) $('importSheet').value=importInfo.sheet;
  $('sheetRow').classList.toggle('hidden',importInfo.sheets.length<2);
  $('importTime').replaceChildren(new Option('无时间列（LSV 扫描速率重建）','-1'),...importInfo.columns.map((name,i)=>new Option(name,String(i))));
  $('importTime').value=String(importInfo.time_column);
  $('importMode').value=importInfo.kind; $('importTimeUnit').value=importInfo.time_unit;
  $('importUnit').value=importInfo.signal_unit==='µA'?'uA':importInfo.signal_unit;
  $('importSignals').replaceChildren();
  importInfo.columns.forEach((name,index)=>{
    const label=document.createElement('label'),input=document.createElement('input');
    input.type='checkbox'; input.value=index; input.checked=importInfo.signal_columns.includes(index);
    label.append(input,document.createTextNode(name)); $('importSignals').appendChild(label);
  });
  $('importMasses').value=importInfo.mz.join(', ');
  for(const [id,key] of [['importPotential','potential_column'],['importCurrent','current_column']]){
    $(id).replaceChildren(new Option('无','-1'),...importInfo.columns.map((name,i)=>new Option(name,String(i))));
    $(id).value=String(importInfo[key]);
  }
  $('importPotentialUnit').value=importInfo.potential_unit;$('importCurrentUnit').value=importInfo.current_unit==='µA'?'uA':importInfo.current_unit;
  $('importScanRate').value=importPayload.scan_rate_mV_s ?? '';$('importLSVStart').value=importPayload.lsv_start_s ?? 0;
  $('importArea').value=importPayload.electrode_area_cm2 ?? msProject?.dems?.electrode_area_cm2 ?? '';
  $('importSpeciesName').value='';updateImportExtras();
}

function updateImportExtras(){
  $('lsvTimingFields').classList.toggle('hidden',$('importTime').value!=='-1' || $('importMode').value!=='electrochemistry');
  $('spectrumImportNameRow').classList.toggle('hidden',$('importMode').value!=='spectrum');
}

async function confirmDataImport() {
  $('confirmImport').disabled=true; $('importError').textContent='';
  try {
    const payload={...importPayload,mode:$('importMode').value,time_column:Number($('importTime').value),
      signal_columns:[...document.querySelectorAll('#importSignals input:checked')].map(node=>Number(node.value)),
      time_unit:$('importTimeUnit').value,synthetic:$('importSynthetic').checked,
      potential_column:Number($('importPotential').value),current_column:Number($('importCurrent').value),
      potential_unit:$('importPotentialUnit').value,current_unit:$('importCurrentUnit').value};
    if($('importArea').value)payload.electrode_area_cm2=Number($('importArea').value);
    if(payload.time_column<0){payload.scan_rate_mV_s=Number($('importScanRate').value);payload.lsv_start_s=Number($('importLSVStart').value);}
    if(payload.mode==='spectrum'){
      payload.species_name=$('importSpeciesName').value.trim();
      if(!payload.species_name)throw new Error('请填写标准谱对应的物质名称');
    }
    if($('importUnit').value!=='auto')payload.signal_unit=$('importUnit').value;
    if(payload.mode==='dems') payload.mz=$('importMasses').value.split(/[,，;\s]+/).filter(Boolean).map(Number);
    const data=await api('/import/data',{method:'POST',body:JSON.stringify(payload)});
    if(data.kind==='electrochemistry') {
      if(!msProject)throw new Error('请先导入质谱数据，再补充电化学记录');
      if(data.synthetic!==msProject.dataset.synthetic)throw new Error('电化学记录与质谱的合成／实验数据标记不一致');
      const next=structuredClone(msProject);
      next.dataset.ec_time_s=data.ec_time_s;next.dataset.current_A=data.current_A || null;next.dataset.potential_V=data.potential_V || null;
      next.dataset.metadata.ec_source_file=data.source_file;
      next.dataset.metadata.ec_time_source=data.time_source;next.dataset.metadata.lsv_scan_rate_mV_s=data.scan_rate_mV_s;
      if(data.electrode_area_cm2)next.dems={...(next.dems || {}),electrode_area_cm2:data.electrode_area_cm2};
      const checked=await api('/ms/dataset',{method:'POST',body:JSON.stringify(next.dataset)});
      const oldResult=result,oldJob=msResultJobId;
      adoptMSProject(next,null,checked.summary);result=oldResult;msResultJobId=oldJob;render();
      if(oldResult){setConfigState('电化学记录已更新');$('footerStatus').textContent='COMPLETED';}
      toast(data.time_source?.startsWith('reconstructed')?'已按给定扫描速率重建 LSV 时间轴；请核对与 MS 的共同起点。':'LSV / EC 已导入并保留原始时间轴，时钟偏移与传输延迟可分别设置。');
    }
    else if(data.kind==='dems') adoptMSProject({dataset:data.dataset,analysis:null},null,data.summary);
    else if(data.kind==='spectrum') {activeSpectrum=data.spectrum; await changeView('spectra'); drawReferenceSpectrum();}
    else {adoptProject(data.project);axis=data.axis;render();if(data.warning)toast(data.warning);}
    if(data.kind!=='electrochemistry')$('fileName').textContent=importPayload.filename;
    $('importDialog').close();
  } catch(error) {$('importError').textContent=error.message;}
  finally {$('confirmImport').disabled=false;}
}

async function initializeLibrary() {
  if(!catalog) catalog=await api('/spectra/catalog');
  $('catalogFilters').replaceChildren();
  catalog.groups.forEach(group=>{
    const button=document.createElement('button');button.type='button';button.textContent=group.label;
    button.className=group.id===catalogGroup?'selected':'';
    button.onclick=()=>{catalogGroup=group.id;initializeLibrary();}; $('catalogFilters').appendChild(button);
  });
  $('compoundCatalog').replaceChildren();
  catalog.entries.filter(entry=>entry.group===catalogGroup).forEach(entry=>{
    const button=document.createElement('button');button.type='button';button.className='compound-entry';
    const formula=document.createElement('strong'),name=document.createElement('span'),state=document.createElement('small');
    formula.textContent=entry.formula;name.textContent=entry.name;
    state.textContent=spectrumAvailability.get(entry.query)==='missing'?'未公开':spectrumAvailability.get(entry.query)==='available'?'已调取':'';
    button.append(formula,name,state); button.onclick=()=>{$('spectrumQuery').value=entry.query;searchNIST();};
    $('compoundCatalog').appendChild(button);
  });
  drawReferenceSpectrum();
}

async function searchNIST() {
  const query=$('spectrumQuery').value.trim();if(!query)return;
  const sequence=++spectrumRequest;
  activeSpectrum=null;drawReferenceSpectrum();
  $('searchSpectrum').disabled=true;$('spectrumError').textContent='';$('spectrumStatus').textContent='正在连接 NIST WebBook…';
  try {
    const data=await api('/spectra/nist?query='+encodeURIComponent(query));
    if(sequence!==spectrumRequest)return;
    if(data.choices){
      $('spectrumChoices').replaceChildren();$('spectrumChoices').classList.remove('hidden');
      data.choices.forEach(choice=>{const button=document.createElement('button');button.type='button';button.textContent=choice.name;button.onclick=()=>{$('spectrumQuery').value=choice.id;searchNIST();};$('spectrumChoices').appendChild(button);});
      $('spectrumStatus').textContent='存在多个条目，请选择具体物质。';
    } else {
      activeSpectrum=data; spectrumAvailability.set(query,'available');$('spectrumChoices').classList.add('hidden');
      drawReferenceSpectrum();if(catalog)initializeLibrary();
    }
  } catch(error) {
    if(sequence!==spectrumRequest)return;
    $('spectrumStatus').textContent='未取得图谱';$('spectrumError').textContent=error.message;
    if(error.status===404){spectrumAvailability.set(query,'missing');if(catalog)initializeLibrary();}
  } finally {if(sequence===spectrumRequest)$('searchSpectrum').disabled=false;}
}

function drawReferenceSpectrum() {
  const container=$('referencePlot');container.replaceChildren();$('spectrumSource').replaceChildren();
  $('spectrumName').disabled=!activeSpectrum || busy;
  $('spectrumName').value=activeSpectrum?.display_name || activeSpectrum?.name || '';
  $('addSpectrum').disabled=!activeSpectrum || !msProject || busy;
  $('downloadSpectrum').disabled=!activeSpectrum;
  if(!activeSpectrum){emptyPlot(container,'从左侧选择物质，或搜索名称与 CAS');return;}
  const spectrum=activeSpectrum,width=Math.max(container.clientWidth,360),height=Math.max(container.clientHeight,320);
  $('spectrumError').textContent='';
  const svg=elt('svg',{viewBox:'0 0 '+width+' '+height,'aria-hidden':'true'});container.appendChild(svg);
  const pad={l:55,r:24,t:30,b:45},max=Math.max(...spectrum.mz)*1.06;
  for(let i=0;i<=5;i++){
    const y=height-pad.b-i*(height-pad.t-pad.b)/5;
    svg.appendChild(elt('line',{x1:pad.l,x2:width-pad.r,y1:y,y2:y,stroke:'#eceeeb','stroke-width':1}));
    const text=elt('text',{x:pad.l-10,y:y+4,'text-anchor':'end',fill:'#626975','font-size':12});text.textContent=i*20;svg.appendChild(text);
  }
  const step=max>150?50:max>50?20:10;
  for(let m=0;m<=max;m+=step){const text=elt('text',{x:pad.l+m/max*(width-pad.l-pad.r),y:height-20,'text-anchor':'middle',fill:'#626975','font-size':12});text.textContent=m;svg.appendChild(text);}
  spectrum.mz.forEach((m,i)=>{const x=pad.l+m/max*(width-pad.l-pad.r),y=height-pad.b-spectrum.intensity[i]/100*(height-pad.t-pad.b);const line=elt('line',{x1:x,x2:x,y1:height-pad.b,y2:y,stroke:'#43474d','stroke-width':1.8});const title=elt('title');title.textContent='m/z '+m+' · '+fmt(spectrum.intensity[i])+' %';line.appendChild(title);svg.appendChild(line);});
  const xtext=elt('text',{x:width-pad.r,y:height-2,'text-anchor':'end',fill:'#505762','font-size':13});xtext.textContent='m/z';svg.appendChild(xtext);
  const ytext=elt('text',{x:pad.l,y:17,fill:'#505762','font-size':13});ytext.textContent='相对强度 / %';svg.appendChild(ytext);
  $('spectrumStatus').textContent=(spectrum.display_name || spectrum.name)+(spectrum.cas?' · CAS '+spectrum.cas:'')+(spectrum.name!==spectrum.display_name?' · '+spectrum.name:'');
  const source=document.createElement('span');source.textContent=spectrum.source || '本地图谱';$('spectrumSource').appendChild(source);
  if(spectrum.source_url){const link=document.createElement('a');link.href=spectrum.source_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='NIST 原始条目';$('spectrumSource').appendChild(link);}
  const usage=document.createElement('p');usage.textContent='相对碎片谱用于建立候选响应，本机绝对定量仍需标准实验标定。';$('spectrumSource').appendChild(usage);
  const entry=catalog?.entries.find(entry=>entry.query===spectrum.cas);
  if(entry?.note){const note=document.createElement('p');note.textContent=entry.note;$('spectrumSource').appendChild(note);}
}

async function addReferenceComponent() {
  if(!msProject || !activeSpectrum || busy)return;
  $('addSpectrum').disabled=true;
  try {
    const data=await api('/ms/response',{method:'POST',body:JSON.stringify({mz:msProject.dataset.mz,spectra:[activeSpectrum]})});
    const next=structuredClone(msProject);
    let old=next.analysis;
    // Historical mathematical demos must not remain as unnamed co-candidates.
    if(next.dataset.synthetic && old?.species.every(name=>/^(?:示例组分\s*)?[ABC]$/.test(name))){
      old=null;next.dataset.metadata.spectrum_references=[];next.dems=null;
    }
    if(activeSpectrum.cas && next.dataset.metadata.spectrum_references?.some(ref=>ref.cas===activeSpectrum.cas))throw new Error('该物质已在候选组分中，请直接选择其名称');
    if(old?.species.includes(data.species[0]))throw new Error('该候选组分已添加');
    const response=old?old.response.map((row,i)=>[...row,data.response[i][0]]):data.response;
    const species=[...(old?.species || []),...data.species];
    next.analysis={...(old || defaultMSAnalysis(response,species)),response,species,model:'spectral',kernels:null};
    next.dataset.metadata.spectrum_references=[...(next.dataset.metadata.spectrum_references || []),...data.references];
    adoptMSProject(next);await changeView('workspace');
    toast('已添加候选组分；当前按谱分离计算，传输核可在高级设置补充。');
  } catch(error){$('spectrumError').textContent=error.message;}
  finally{$('addSpectrum').disabled=!activeSpectrum || !msProject || busy;}
}

async function importResponseFile(file) {
  if(!msProject || busy)return;
  try {
    let config;
    if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(await file.text());config=data.analysis || data;}
    else {
      const data=parseCSV(await file.text()),species=data.names.slice(1),map=new Map(data.rows.map(row=>[row[0],row.slice(1)]));
      if(map.size!==data.rows.length)throw new Error('响应矩阵包含重复 m/z');
      const response=msProject.dataset.mz.map(m=>{if(!map.has(m))throw new Error('响应矩阵缺少 m/z '+m);return map.get(m);});
      config=defaultMSAnalysis(response,species);
    }
    const checked=await api('/ms/project/validate',{method:'POST',body:JSON.stringify({schema_version:'web-ms-1.0',dataset:msProject.dataset,analysis:config})});
    adoptMSProject(checked.project,null,checked.summary);toast('响应矩阵已导入');
  }catch(error){toast(error.message);}
}

$('confirmImport').onclick=confirmDataImport;
$('importTime').onchange=updateImportExtras;$('importMode').onchange=updateImportExtras;
$('spectrumName').oninput=()=>{if(activeSpectrum)activeSpectrum.display_name=$('spectrumName').value.trim();};
$('importSheet').onchange=async()=>{importPayload.sheet=$('importSheet').value;try{await showImportPreview();}catch(error){$('importError').textContent=error.message;}};
$('openLibrary').onclick=()=>changeView('spectra');
$('closeSpectrum').onclick=()=>changeView('workspace');
$('searchSpectrum').onclick=searchNIST;
$('spectrumQuery').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();searchNIST();}};
$('localSpectrum').onclick=()=>{$('spectrumInput').value='';$('spectrumInput').click();};
$('spectrumInput').onchange=event=>{if(event.target.files[0])importWorkbenchFile(event.target.files[0]);};
$('addSpectrum').onclick=addReferenceComponent;
$('downloadSpectrum').onclick=()=>activeSpectrum && download('mass-spectrum.json',activeSpectrum);
$('importResponse').onclick=()=>{$('responseInput').value='';$('responseInput').click();};
$('responseInput').onchange=event=>{if(event.target.files[0])importResponseFile(event.target.files[0]);};
for(const id of ['msModel','msKernelConvention'])$(id).onchange=markDirty;
window.addEventListener('resize',()=>{if(view==='spectra')drawReferenceSpectrum();});
initialize();

  const __originalChangeView = changeView;
  changeView = async function (name) {
    const outcome = await __originalChangeView(name);
    try { if (bridge.onView) bridge.onView(name); } catch (error) { console.error(error); }
    return outcome;
  };
  return {
    dispose() {
      activeJob = null;
      try { demsSequence += 1; demsReport = null; demsProcessing = false; } catch (error) { console.error(error); }
      clearTimeout(toastTimer);
      clearTimeout(resizeTimer);
      while (cleanups.length) {
        try { cleanups.pop()(); } catch (error) { console.error(error); }
      }
    },
    changeView(name) { return changeView(name); },
    restoreProject(project) {
      adoptProject(project);
      if (view !== 'workspace') void changeView('workspace');
      render();
    },
    loadDemo(kind) {
      if (kind) $('demo').value = kind;
      return loadDemo();
    },
    state() {
      return { view, busy, dirty: Boolean(dirty), hasProject: Boolean(msProject), jobId: msResultJobId };
    },
  };
});
    const TOOLBAR_CSS = "\n.cvx-panel { box-sizing:border-box; display:flex; flex-direction:column; height:100%; min-height:0; min-width:0; padding-top:var(--dsh-frame-top-clearance, 0px); padding-left:var(--dsh-frame-leading-clearance, 0px); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); }\n.cvx-bar { flex:none; display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:58px; padding:8px 20px; background:var(--dsw-alias-bg-layer-1); border-bottom:1px solid var(--dsw-alias-border-l1); flex-wrap:wrap; }\n.cvx-bar-left, .cvx-bar-right { display:flex; align-items:center; gap:12px; min-width:0; flex-wrap:wrap; }\n.cvx-title { font-size:16px; font-weight:600; letter-spacing:.2px; white-space:nowrap; }\n.cvx-dot { width:8px; height:8px; border-radius:50%; background:var(--dsw-alias-state-idle-primary, #999); flex:none; }\n.cvx-dot[data-state=\"ready\"] { background:var(--dsw-alias-state-success-primary, #3f9b6d); }\n.cvx-dot[data-state=\"error\"] { background:var(--dsw-alias-state-error-primary, #c14b55); }\n.cvx-tabs { position:relative; display:flex; align-items:center; gap:4px; padding:0; border-radius:8px; background:transparent; }\n.cvx-tab { position:relative; z-index:1; height:32px; padding:0 13px; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--dsw-alias-label-secondary); font-size:14px; cursor:pointer; white-space:nowrap; }\n.cvx-tab:hover { color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-border-l1); }\n.cvx-tab[data-active=\"true\"] { color:var(--dsw-alias-label-primary); background:transparent; font-weight:600; box-shadow:none; }\n.cvx-tab-indicator {\n  position:absolute; z-index:0; top:0; left:0; height:32px; border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 38%, var(--dsw-alias-border-l2)); border-radius:7px;\n  background:color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent);\n  box-shadow:0 2px 8px rgb(0 0 0 / .04);\n  pointer-events:none;\n  transition: transform .34s var(--cvx-ease), width .34s var(--cvx-ease), opacity .2s ease;\n}\n.cvx-ws { display:flex; align-items:center; gap:8px; min-width:0; font-size:14px; color:var(--dsw-alias-label-secondary); }\n.cvx-ws select { min-width:180px; max-width:320px; height:34px; padding:0 10px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-size:14px; }\n.cvx-binding { max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; color:var(--dsw-alias-label-secondary); }\n.cvx-action { height:34px; padding:0 13px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary); font-size:14px; cursor:pointer; white-space:nowrap; }\n.cvx-action:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }\n.cvx-action:disabled { opacity:.45; cursor:not-allowed; }\n.cvx-notice { flex:none; padding:6px 18px; font-size:12px; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-2); border-bottom:1px solid var(--dsw-alias-border-l1); white-space:pre-wrap; }\n.cvx-host { flex:1; min-height:0; position:relative; }\n.cvx-error { flex:none; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin:8px 14px 0; padding:10px 12px; border:1px solid var(--dsw-alias-state-error-primary, #c14b55); border-radius:9px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font-size:12px; line-height:1.6; white-space:pre-wrap; }\n.cvx-error button { flex:none; height:27px; padding:0 10px; border-radius:7px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); cursor:pointer; }\n@media (max-width: 900px) {\n  .cvx-binding { display:none; }\n  .cvx-ws select { max-width:190px; }\n}\n\n/* ---- motion and micro UI ---- */\n.cvx-panel {\n  --cvx-ease: cubic-bezier(.22, 1, .36, 1);\n  background:\n    radial-gradient(900px 180px at 8% -45%, color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent), transparent 70%),\n    var(--dsw-alias-bg-base);\n}\n.cvx-bar {\n  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, var(--dsw-alias-brand-primary));\n  box-shadow: 0 1px 0 color-mix(in srgb, var(--dsw-alias-border-l1) 80%, transparent), 0 4px 18px rgb(0 0 0 / .035);\n  transition: background .3s ease, box-shadow .3s ease;\n}\n.cvx-title { display:flex; align-items:center; gap:8px; }\n.cvx-title::before {\n  content:''; width:3px; height:15px; border-radius:3px;\n  background: linear-gradient(180deg, var(--dsw-alias-brand-primary), color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent));\n  box-shadow: 0 0 10px color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent);\n}\n.cvx-tab {\n  position:relative; overflow:hidden;\n  transition: background .22s ease, color .22s ease, transform .18s var(--cvx-ease), box-shadow .22s ease;\n}\n.cvx-tab:hover { transform: translateY(-1px); }\n.cvx-tab:active { transform: translateY(0) scale(.97); }\n.cvx-tab[data-active=\"true\"] { box-shadow: 0 1px 2px rgb(0 0 0 / .12), inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }\n.cvx-ws select { transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }\n.cvx-ws select:hover { border-color: var(--dsw-alias-border-l2); }\n.cvx-ws select:focus { outline:none; border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }\n.cvx-action { transition: background .18s ease, color .18s ease, border-color .18s ease, transform .16s var(--cvx-ease), box-shadow .2s ease; }\n.cvx-action:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgb(0 0 0 / .07); }\n.cvx-action:active:not(:disabled) { transform: translateY(0) scale(.97); }\n.cvx-dot[data-state=\"ready\"] { animation: cvx-breathe 2.8s ease-in-out infinite; }\n.cvx-dot[data-state=\"error\"] { animation: cvx-alert 1.4s ease-in-out infinite; }\n.cvx-notice { animation: cvx-slide-down .25s var(--cvx-ease); }\n.cvx-error { animation: cvx-fade-in .28s var(--cvx-ease); }\n.cvx-stage { flex:1; min-height:0; position:relative; display:flex; }\n.cvx-host { flex:1; min-height:0; position:relative; }\n.cvx-loading {\n  position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; gap:15px;\n  padding:22px 24px; background:#f4f3f0; color:#50545b;\n}\n.cvx-loading-head { display:flex; align-items:center; justify-content:space-between; gap:16px; }\n.cvx-loading-label { font-size:13px; letter-spacing:.2px; color:#50545b; }\n.cvx-loading-grid { display:grid; grid-template-columns:240px minmax(0,1fr); gap:16px; flex:1; min-height:0; }\n.cvx-loading-main { display:flex; flex-direction:column; gap:14px; min-height:0; }\n.cvx-skel { position:relative; overflow:hidden; background:#e9e8e4; border-radius:9px; }\n.cvx-skel::after { content:''; position:absolute; inset:0; transform:translateX(-110%); background:linear-gradient(90deg, transparent, rgb(255 255 255 / .64), transparent); animation: cvx-shimmer 1.65s ease-in-out infinite; }\n.cvx-skel-title { width:190px; height:18px; }\n.cvx-skel-pill { width:128px; height:32px; border-radius:8px; }\n.cvx-skel-panel { min-height:190px; height:100%; }\n.cvx-skel-chart { flex:1; min-height:110px; }\n@keyframes cvx-breathe { 0%,100% { box-shadow:0 0 0 0 rgb(63 155 109 / .28); } 50% { box-shadow:0 0 0 5px rgb(63 155 109 / 0); } }\n@keyframes cvx-alert { 0%,100% { box-shadow:0 0 0 0 rgb(193 75 85 / .28); } 50% { box-shadow:0 0 0 5px rgb(193 75 85 / 0); } }\n@keyframes cvx-slide-down { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }\n@keyframes cvx-fade-in { from { opacity:0; } to { opacity:1; } }\n@keyframes cvx-shimmer { 0% { transform:translateX(-110%); } 100% { transform:translateX(110%); } }\n@media (prefers-reduced-motion: reduce) {\n  .cvx-dot, .cvx-notice, .cvx-error, .cvx-skel::after, .cvx-tab, .cvx-action { animation:none !important; transition:none !important; }\n}\n";
    const STRINGS = {"zh":{"title":"Convolvex-MS 质谱工作台","workspace":"工作区","loading":"正在连接 Convolvex 服务…","noWorkspace":"没有可用的 DSH 工作区","boundTo":"数据：{path}","restore":"恢复上次项目","copyAgent":"复制 Agent 说明","copied":"已复制 Agent 工作区说明，可粘贴到对话中。","noProject":"该工作区还没有保存过的项目。","restored":"已恢复上次提交的项目。","retry":"重试","connectionUnavailable":"DSH 连接服务不可用。","rpcFailed":"Convolvex 请求失败。","agentPrompt":"Convolvex-MS 工作台绑定在 DSH 工作区：{root}。数据目录：{dataDir}。请调用 convolvex_workbench 工具（action=status）查看该工作区的运行记录和结果。","viewWorkspace":"工作台","viewSpectra":"标准图谱库","viewRecords":"记录","viewsLabel":"工作台视图","switched":"已切换到工作区：{path}","switchBlocked":"当前任务仍在运行，请等待完成后再切换工作区。","switchConfirm":"当前配置尚未运行或保存，切换工作区会丢失界面中的改动。继续？","copyFailed":"复制失败，请手动复制以下内容：","serviceDown":"Convolvex 服务不可用，点击「重试」重新启动前端","serviceHint":"Convolvex 服务状态"},"en":{"title":"Convolvex-MS workbench","workspace":"Workspace","loading":"Connecting to the Convolvex service…","noWorkspace":"No DSH workspace available","boundTo":"Data: {path}","restore":"Restore last project","copyAgent":"Copy agent note","copied":"Agent workspace note copied to the clipboard.","noProject":"This workspace has no saved project yet.","restored":"Restored the last submitted project.","retry":"Retry","connectionUnavailable":"The DSH connection service is unavailable.","rpcFailed":"The Convolvex request failed.","agentPrompt":"The Convolvex-MS workbench is bound to the DSH workspace {root}. Data directory: {dataDir}. Call the convolvex_workbench tool with action=status to inspect this workspace's run records and results.","viewWorkspace":"Workbench","viewSpectra":"Spectrum library","viewRecords":"Records","viewsLabel":"Workbench views","switched":"Switched to workspace: {path}","switchBlocked":"A task is still running; wait for it to finish before switching workspaces.","switchConfirm":"The current configuration has not been run or saved. Switching workspaces will discard the on-screen changes. Continue?","copyFailed":"Copy failed; copy this text manually:","serviceDown":"Convolvex service unavailable; click Retry to restart the frontend","serviceHint":"Convolvex service status"}};

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
