"""MS/DEMS-only synthetic experiments and figures; never experimental evidence.
All pseudo-species response coefficients below are constructed, not NIST spectra.
"""
from pathlib import Path
import argparse, json, shutil
import numpy as np
from scipy.ndimage import gaussian_filter1d
from convolvex.massspec import MSDataset, AnalysisRequest, ProfileRequest, analyze, analyze_profile, background_diagnosis, response_diagnostics, digest
from convolvex.ms_operators import BatchedSpectroTemporal
from convolvex.operators import Convolution
from convolvex.plotting import configure, save
from convolvex.agent_runner import run_workflow

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'simulations'; FIG=ROOT/'docs/latex/figures'

def dump(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')

def main():
    p=argparse.ArgumentParser();p.add_argument('--allow-font-fallback',action='store_true');p.add_argument('--agent-workspace');a=p.parse_args()
    receipt=configure(a.allow_font_fallback)
    import matplotlib.pyplot as plt
    OUT.mkdir(exist_ok=True);FIG.mkdir(parents=True,exist_ok=True)
    dump(OUT/'font_receipt.json',receipt)
    rng=np.random.default_rng(20261114);metrics={'seed':20261114,'all_data_synthetic':True,'response_source':'constructed coefficients, not NIST','experiments':{}}
    def line(name,x,series,xlabel,ylabel):
        f,ax=plt.subplots(figsize=(7.1,3.65))
        for label,y,style in series:ax.plot(x,y,style,lw=1.35,label=label)
        ax.set(xlabel=xlabel,ylabel=ylabel);ax.legend(frameon=False);ax.grid(True,alpha=.16);save(f,FIG/name);plt.close(f)
    t=np.arange(600)*.5;n=len(t)
    S=np.array([[1,.03,.01],[.02,.1,.22],[.03,1,.3],[0,.03,1],[.02,.15,.05],[0,.01,.28],[0,.015,.14]])
    mz=[2,15,28,31,44,45,46]
    x=np.stack([gaussian_filter1d(((t>50)&(t<105)).astype(float),2),
                .7*np.exp(-.5*((t-145)/18)**2)+.35*np.exp(-.5*((t-215)/9)**2),
                .8*gaussian_filter1d(((t>95)&(t<185)).astype(float),3)])
    x[:,t<25]=0;x[:,t>270]=0
    lag=np.arange(81)*.5
    kernels=np.stack([np.exp(-lag/s) for s in (3.,6.,9.)]);kernels/=kernels.sum(axis=1,keepdims=True)
    A=BatchedSpectroTemporal(S,kernels,n)
    baseline=np.linspace(.06,.18,len(mz))[:,None]+np.linspace(-.02,.04,len(mz))[:,None]*(2*t/t[-1]-1)
    y=A.forward(x)+baseline+rng.normal(0,.006,A.output_shape)
    data=MSDataset(time_s=t.tolist(),mz=mz,signal=y.tolist(),signal_unit='a.u.',time_origin='synthetic zero',
        synthetic=True,instrument_id='simulation',conditions_id='linear-LTI',
        ec_time_s=(np.arange(3000)*.1).tolist(),current_A=(-.01*np.ones(3000)).tolist(),
        metadata={'response_source':'synthetic, not NIST','seed':20261114})
    req=AnalysisRequest(dataset_id=digest(data.model_dump()),response=S.tolist(),species=['A','B','C'],
        kernels=kernels.tolist(),method='channel_pars',l2=.018,l1=.0007,max_iter=2500,tol=1e-5)
    fit=analyze(data,req);naive=analyze(data,req.model_copy(update={'method':'fista'}))
    est=np.asarray(fit['estimate']);pred=np.asarray(fit['predicted']);bfit=np.asarray(fit['extras']['background'])
    metrics['experiments']['joint']={'rmse':float(np.sqrt(np.mean((est-x)**2))),
        'naive_rmse':float(np.sqrt(np.mean((np.asarray(naive['estimate'])-x)**2))),
        'converged':fit['converged'],'iterations':fit['iterations'],'naive_converged':naive['converged'],
        'relative_residual':fit['relative_residual'],'adjoint_error':fit['diagnostics']['adjoint_relative_error'],
        'response_diagnostics':response_diagnostics(S.tolist()),'stationarity':fit['diagnostics']['stationarity']}
    np.savez_compressed(OUT/'joint.npz',time=t,mz=mz,response=S,kernels=kernels,truth=x,observed=y,baseline=baseline,
                         estimate=est,predicted=pred,baseline_estimate=bfit,naive=np.asarray(naive['estimate']))
    dump(OUT/'joint_result.json',fit)
    dump(ROOT/'examples/mcp/synthetic_ms.json',data.model_dump())
    analysis=req.model_dump();analysis.pop('dataset_id')
    plan={'input':{'relative_path':'synthetic_ms.json','time_origin':'synthetic zero'},'analysis':analysis,
          'l2_factors':[.5,1.,2.],'max_jobs':3,'timeout_s':120}
    dump(ROOT/'examples/mcp/workflow.json',plan)
    f,ax=plt.subplots(figsize=(7.1,3.65));im=ax.imshow(y,aspect='auto',origin='lower',interpolation='nearest',extent=[t[0],t[-1],-.5,len(mz)-.5])
    ax.set(xlabel='Time / s',ylabel='Channel m/z (categorical)',yticks=range(len(mz)),yticklabels=[str(m) for m in mz]);f.colorbar(im,ax=ax,label='Ion signal / a.u.')
    save(f,FIG/'01_mass_time');plt.close(f)
    f,ax=plt.subplots(figsize=(5.1,3.8));im=ax.imshow(S,aspect='auto',origin='lower',interpolation='nearest');ax.set(xticks=range(3),xticklabels=['A','B','C'],yticks=range(7),yticklabels=mz,xlabel='Hypothesized component',ylabel='Channel m/z')
    f.colorbar(im,ax=ax,label='Relative response');save(f,FIG/'02_response');plt.close(f)
    line('03_kernels',lag,[(f'Component {c}',h,'-') for c,h in zip('ABC',kernels)],'Lag / s','Discrete kernel weight')
    for j,c in enumerate('ABC'):
        line('04_source_'+c,t,[('Truth',x[j],'--'),('Background-profiled',est[j],'-'),('Background ignored',naive['estimate'][j],':')],
             'Time / s',f'Component {c} / a.u.')
    line('05_residual',t,[('Measured minus reconstruction',(y-pred)[2],'-')],'Time / s','Signed residual, m/z 28 / a.u.')
    f,ax=plt.subplots(figsize=(7.1,3.65));ax.semilogy([h['iteration'] for h in fit['history']],[h['stationarity'] for h in fit['history']],'-o',ms=3)
    ax.axhline(req.tol,ls='--',label='Stopping threshold');ax.set(xlabel='Iteration',ylabel='Relative gradient-mapping norm');ax.legend(frameon=False);ax.grid(True,alpha=.16)
    save(f,FIG/'06_stationarity');plt.close(f)
    # Uniform 1D mass profile, no images.
    mass=np.linspace(44,46,501);true=np.exp(-.5*((mass-44.8)/.014)**2)+.7*np.exp(-.5*((mass-44.9)/.018)**2)+.55*np.exp(-.5*((mass-45.55)/.02)**2)
    hk=np.exp(-.5*(np.arange(-20,21)/4)**2);hk/=hk.sum();op=Convolution(hk,len(mass),mode='same')
    obs=op.forward(true)+rng.normal(0,.002,len(mass))
    preq=ProfileRequest(mz_grid=mass.tolist(),observed=obs.tolist(),line_shape=hk.tolist(),signal_unit='a.u.',l2=.002,l1=.0001,max_iter=3000,tol=1e-6)
    pf=analyze_profile(preq)
    metrics['experiments']['mass_profile']={'observed_rmse':float(np.sqrt(np.mean((obs-true)**2))),
        'recovered_rmse':float(np.sqrt(np.mean((np.asarray(pf['estimate'])-true)**2))),
        'converged':pf['converged'],'iterations':pf['iterations']}
    dump(ROOT/'examples/mcp/mass_profile.json',preq.model_dump())
    np.savez_compressed(OUT/'mass_profile.npz',mz=mass,truth=true,observed=obs,estimate=pf['estimate'],line_shape=hk)
    line('07_mass_profile',mass,[('Latent profile',true,'--'),('Measured profile',obs,':'),('Recovered profile',pf['estimate'],'-')],'m/z','Signal / a.u.')
    # Blank-fitted 44/45/46 example. Residual can be positive or negative.
    tb=np.arange(481)*.5
    y44=100-.12*tb+3*np.sin(tb/35)-9*((tb>60)&(tb<170))
    pressure=1e-6*(1+.001*tb+.08*np.sin(tb/13))
    u=.10*np.exp(-.5*((tb-100)/12)**2)-.05*np.exp(-.5*((tb-160)/10)**2)
    v=.025*np.exp(-.5*((tb-100)/12)**2)-.015*np.exp(-.5*((tb-160)/10)**2)
    y45=.0123*y44+.47*(pressure/1e-6-1)+.02+u+rng.normal(0,.004,len(tb))
    y46=.0047*y44+.19*(pressure/1e-6-1)+.008+v+rng.normal(0,.002,len(tb))
    db=MSDataset(time_s=tb.tolist(),mz=[44,45,46],signal=[y44.tolist(),y45.tolist(),y46.tolist()],signal_unit='a.u.',
                 time_origin='synthetic zero',pressure=pressure.tolist(),pressure_unit='mbar',synthetic=True)
    windows=[(0.,45.),(205.,240.)]
    plain,_=background_diagnosis(db,[45,46],[44],windows,False,True)
    assisted,_=background_diagnosis(db,[45,46],[44],windows,True,True)
    res=np.asarray(assisted['signed_residual']);simple=np.asarray(plain['signed_residual'])
    metrics['experiments']['background']={'pressure_assisted_rmse':float(np.sqrt(np.mean((res[0]-u)**2))),
        'reference_only_rmse':float(np.sqrt(np.mean((simple[0]-u)**2))),
        'blank_windows':windows,'negative_residual_count':int(np.sum(res[0]<0))}
    dump(ROOT/'examples/mcp/background_ms.json',db.model_dump())
    np.savez_compressed(OUT/'background.npz',time=tb,y44=y44,y45=y45,y46=y46,pressure=pressure,true45=u,true46=v,
                         residual=res,reference_only=simple,blank_mask=assisted['blank_mask'])
    line('08_background_raw',tb,[(f'm/z {m}',a/np.mean(a[tb<=45]),'-') for m,a in zip([44,45,46],[y44,y45,y46])],
         'Time / s','Signal / initial blank mean')
    for j,(m,truth) in enumerate([(45,u),(46,v)]):
        f,ax=plt.subplots(figsize=(7.1,3.65))
        ax.plot(tb,truth,'--',label='Injected residual');ax.plot(tb,simple[j],':',label='Reference-only model');ax.plot(tb,res[j],lw=1.2,label='Pressure-assisted model')
        ax.axvspan(0,45,alpha=.08);ax.axvspan(205,240,alpha=.08);ax.axhline(0,ls='--',lw=.5)
        ax.set(xlabel='Time / s',ylabel=f'Signed m/z {m} residual / a.u.');ax.legend(frameon=False);ax.grid(True,alpha=.16)
        save(f,FIG/f'09_residual_{m}');plt.close(f)
    # Response singular values / sensitivity: not a unique identity test.
    Sbad=S.copy();Sbad[:,2]=Sbad[:,1]+1e-5*Sbad[:,2]
    f,ax=plt.subplots(figsize=(6.8,3.5))
    for label,s in [('Separated columns',S),('Near-collinear columns',Sbad)]:
        singular=np.linalg.svd(s/np.linalg.norm(s,axis=0),compute_uv=False)
        ax.semilogy(np.arange(1,4),singular,'o-',label=label)
    ax.set(xlabel='Singular-value index',ylabel='Column-normalized singular value',xticks=[1,2,3]);ax.legend(frameon=False);ax.grid(True,alpha=.16)
    save(f,FIG/'10_identifiability');plt.close(f)
    metrics['experiments']['ill_conditioned']=response_diagnostics(Sbad.tolist())
    freq=np.fft.rfftfreq(2048,.5)
    f,ax=plt.subplots(figsize=(7.1,3.5))
    for c,h in zip('ABC',kernels):ax.semilogy(freq,abs(np.fft.rfft(h,2048)),label=f'Component {c}')
    ax.set(xlabel='Frequency / Hz',ylabel='Transfer magnitude');ax.legend(frameon=False);ax.grid(True,alpha=.16)
    save(f,FIG/'11_transfer_bandwidth');plt.close(f)
    # Benchmark plots preserve all tested warm-call cases.
    bench=json.loads((ROOT/'benchmarks/ms_results.json').read_text());selected=[r for r in bench['rows'] if 'speedup' in r]
    labels=[]
    for r in selected:
        if r['task'].startswith('spectro'):labels.append(('Forward' if r['task'].endswith('forward') else 'Adjoint')+f" J={r['shape'][1]}, T={r['shape'][2]}")
        elif r['task']=='background_projection':labels.append('Channel background projection')
        else:labels.append('100 FISTA iterations')
    f,ax=plt.subplots(figsize=(7.1,4.3));ax.barh(labels,[r['speedup'] for r in selected]);ax.axvline(1,ls='--',lw=1);ax.set(xlabel='Baseline time / optimized time');ax.invert_yaxis()
    save(f,FIG/'12_speedup');plt.close(f)
    channels=np.array([4,8,12,16,24,32]);T=2048;pdim=2
    dense_bytes=channels**2*T*pdim*8
    factor_bytes=channels*(T*pdim+pdim+pdim*pdim)*8
    line('13_background_memory',channels,[('Dense block Q',dense_bytes/2**20,'o-'),('Channel factors',factor_bytes/2**20,'s-')],
         'Number of channels','Projector storage / MiB')
    # Snapshot all simulated metrics before invoking a real subprocess agent.
    dump(OUT/'metrics.json',metrics)
    if a.agent_workspace:
        ws=Path(a.agent_workspace);(ws/'inbox').mkdir(parents=True,exist_ok=True)
        shutil.copy2(ROOT/'examples/mcp/synthetic_ms.json',ws/'inbox/synthetic_ms.json')
        trace=run_workflow(plan,ws,120)
        dump(ROOT/'validation/agent_trace.json',trace)
        metrics['agent']={'protocol':trace['protocol'],'jobs':len(trace['jobs']),
            'trace_steps':len(trace['trace']),'conclusion_status':trace['conclusion_status'],
            'runner':trace['runner'],'all_converged':all(j['summary']['converged'] for j in trace['jobs']),
            'quantification_status':trace['quantification_status']}
        dump(OUT/'metrics.json',metrics)
    print(json.dumps(metrics,indent=2));print('Font:',receipt)

if __name__=='__main__':main()
