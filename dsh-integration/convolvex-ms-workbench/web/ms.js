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
