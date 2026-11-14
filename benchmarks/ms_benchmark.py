"""Reproducible MS-only benchmark. No fabricated GPU timings.
Run with OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1.
Warm-call measurements exclude object construction; initialization is separate.
"""
from pathlib import Path
import json, platform, os, time, statistics
import numpy as np
import scipy
from scipy.linalg import block_diag
from convolvex.operators import SpectroTemporal, Convolution, Mixing
from convolvex.ms_operators import BatchedSpectroTemporal, ChannelProjected, channel_pars
from convolvex.inference import ProjectedWeighted, pars
from convolvex.solvers import fista
from convolvex.native import available
from convolvex.gpu import capability

ROOT=Path(__file__).resolve().parents[1]

def timed(fn,repeats=9,warmups=2):
    for _ in range(warmups):fn()
    vals=[]
    for _ in range(repeats):
        t=time.perf_counter();fn();vals.append((time.perf_counter()-t)*1000)
    return {'median_ms':statistics.median(vals),'samples_ms':vals,'warmups':warmups,'repeats':repeats}

def main():
    rng=np.random.default_rng(1973);rows=[];setup=[]
    for channels,species,n,k in [(8,3,4096,129),(24,12,8192,257),(32,16,32768,513)]:
        S=rng.uniform(.05,1,(channels,species));S/=np.linalg.norm(S,axis=0)
        h=np.stack([np.exp(-np.arange(k)/(8+3*j)) for j in range(species)]);h/=h.sum(axis=1,keepdims=True)
        x=rng.normal(size=(species,n));y=rng.normal(size=(channels,n))
        old=SpectroTemporal(S,h,n);new=BatchedSpectroTemporal(S,h,n)
        setup.append({'shape':[channels,species,n,k], 'loop':timed(lambda:SpectroTemporal(S,h,n),5,1),
                      'batched':timed(lambda:BatchedSpectroTemporal(S,h,n),5,1)})
        for direction,data in [('forward',x),('adjoint',y)]:
            f=getattr(old,direction);g=getattr(new,direction)
            a=timed(lambda:f(data));b=timed(lambda:g(data))
            rows.append({'task':'spectrotemporal_'+direction,'shape':[channels,species,n,k],
                         'baseline':'per-species cached FFT','optimized':'batched cached FFT',
                         'baseline_timing':a,'optimized_timing':b,'speedup':a['median_ms']/b['median_ms'],
                         'max_absolute_error':float(np.max(abs(f(data)-g(data))))})
    # The same Gaussian nuisance projector, represented densely or by channel.
    c,j,n,p=24,4,2048,2
    S=rng.uniform(.05,1,(c,j));A=Mixing(S,n);w=np.ones((c,n));B=np.column_stack([np.ones(n),np.linspace(-1,1,n)])
    P=ChannelProjected(A,w,B);Q=block_diag(*[v[0] for v in P.factors]);dense=ProjectedWeighted(A,w,Q)
    y=rng.normal(size=(c,n))
    a=timed(lambda:dense.project(y));b=timed(lambda:P.project(y))
    storage=sum(v.nbytes for fac in P.factors for v in fac)
    rows.append({'task':'background_projection','shape':[c,j,n,p],'baseline':'dense block-orthogonal Q',
        'optimized':'channel factors','baseline_timing':a,'optimized_timing':b,'speedup':a['median_ms']/b['median_ms'],
        'max_absolute_error':float(np.max(abs(dense.project(y)-P.project(y)))),
        'dense_Q_bytes':int(Q.nbytes),'structured_factor_bytes':storage,'storage_ratio':Q.nbytes/storage})
    # Identical iteration budgets, not time-to-convergence; includes solve but excludes operator construction.
    c,j,n,k=12,6,2048,65;S=rng.uniform(.05,1,(c,j));h=np.tile(np.exp(-np.arange(k)/8),(j,1));h/=h.sum(axis=1,keepdims=True)
    old=SpectroTemporal(S,h,n);new=BatchedSpectroTemporal(S,h,n);y=old.forward(abs(rng.normal(size=(j,n))))
    kw=dict(max_iter=100,tol=1e-30,l2=.003)
    a=timed(lambda:fista(old,y,**kw),3,1);b=timed(lambda:fista(new,y,**kw),3,1)
    ro=fista(old,y,**kw);rn=fista(new,y,**kw)
    rows.append({'task':'fixed_100_iterations','shape':[c,j,n,k],'baseline':'per-species FFT FISTA',
        'optimized':'batched FFT FISTA','baseline_timing':a,'optimized_timing':b,'speedup':a['median_ms']/b['median_ms'],
        'max_absolute_error':float(np.max(abs(ro.estimate-rn.estimate))),
        'baseline_converged':ro.converged,'optimized_converged':rn.converged,'iterations':[ro.iterations,rn.iterations]})
    # 1D profiles / transfer responses, not image deblurring.
    for n,k in [(4096,31),(131072,1025)]:
        x=rng.normal(size=n);h=np.exp(-np.arange(k)/max(2,k/8));h/=h.sum()
        engines=['direct','fft','overlap_add']+(['cpp'] if available() else [])
        ops={e:Convolution(h,n,mode='causal',engine=e) for e in engines}
        timings={e:timed(lambda op=op:op.forward(x)) for e,op in ops.items()}
        rows.append({'task':'one_dimensional_convolution','shape':[n,k],
                     'timings':timings,'speedup_direct_over_fft':timings['direct']['median_ms']/timings['fft']['median_ms'],
                     'max_absolute_error':{e:float(np.max(abs(op.forward(x)-ops['direct'].forward(x)))) for e,op in ops.items()}})
    cpu='unknown'
    path=Path('/proc/cpuinfo')
    if path.exists():
        cpu=next((line.split(':',1)[1].strip() for line in path.read_text().splitlines() if line.startswith('model name')),cpu)
    data={'schema':'ms-benchmark-1.1','seed':1973,'environment':{'python':platform.python_version(),'numpy':np.__version__,
        'scipy':scipy.__version__,'platform':platform.platform(),'cpu':cpu,
        'threads':{key:os.environ.get(key) for key in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']},
        'gpu':capability(),'native_available':available()},'warm_call_excludes':'operator initialization / kernel FFT; separately measured below',
        'initialization':setup,'rows':rows,'not_measured':['GPU: no available CuPy/CUDA device','third-party MCP/LLM latency']}
    out=ROOT/'benchmarks/ms_results.json';out.write_text(json.dumps(data,indent=2,allow_nan=False))
    for r in rows:
        print(r['task'],r['shape'],round(r.get('speedup',r.get('speedup_direct_over_fft')),3))
    print(out)

if __name__=='__main__':main()
