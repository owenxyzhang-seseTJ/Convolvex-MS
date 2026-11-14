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
