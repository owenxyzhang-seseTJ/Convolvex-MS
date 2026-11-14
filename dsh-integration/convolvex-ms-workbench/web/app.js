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
    $('onlineDot').classList.add('online'); $('onlineStatus').textContent = '本地已连接';
    $('onlineDot').parentElement.title = '本地已连接';
    [...$('method').options].find(option => option.value === 'gpu_fista').disabled = !capability.gpu.available;
    [...$('engine').options].find(option => option.value === 'cpp').disabled = !capability.cpp;
    await loadDemo();
  } catch (error) {
    $('onlineDot').classList.remove('online'); $('onlineStatus').textContent = '连接失败';
    $('onlineDot').parentElement.title = '连接失败';
    $('footerStatus').textContent = 'DISCONNECTED';
    setStatus('未连接', 'error', '检查本地服务或设置访问令牌');
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
