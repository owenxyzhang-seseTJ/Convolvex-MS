import time
import numpy as np
import pytest
from fastapi.testclient import TestClient
from convolvex.physics import *
from convolvex.pipeline import Problem,execute,demo
from convolvex.service import create_app
from convolvex.gpu import capability,gpu_fista
from convolvex import Convolution,fista

def test_charge_zero_crossing_clipping():
    r=integrate_current([0,2],[-1,1]);assert r['net_C']==pytest.approx(0)
    assert r['cathodic_C']==pytest.approx(.5);assert r['anodic_C']==pytest.approx(.5)
    r=integrate_current([0,1,2],[0,1,0],.5,1.5);assert r['net_C']==pytest.approx(.75)
    with pytest.raises(ValueError):integrate_current([0,1],[1,2],-.1,1)

def test_physical_kernels_isotopes():
    t=np.linspace(0,100,10001);h=gamma_response(t,2,2)
    assert np.trapezoid(h,t)==pytest.approx(1,abs=1e-5)
    h=first_passage_response(t,1,1,.1);assert np.trapezoid(h,t)==pytest.approx(1,abs=1e-5)
    iso=co2_isotope_ratios();assert iso['45/44']==pytest.approx(.01158,abs=1e-5)
    assert iso['46/44']==pytest.approx(.004118,abs=1e-5)

def test_calibration_gate_and_background():
    c=Calibration('H2',2.,2,'cal-001',True,True)
    r=quantify([0,1],[2e-9,2e-9],c,.001,True);assert r['amount_mol']==pytest.approx(1e-9)
    with pytest.raises(ValueError):quantify([0,1],[1,1],c,1)
    c.verified=False
    with pytest.raises(ValueError):quantify([0,1],[1,1],c,1,True)
    t=np.arange(20.);B=np.column_stack([np.ones(20),t]);y=B@np.array([1,.1]);y[10:]-=.3
    r=fit_background(t,y,B,t<10);assert r['residual'][15]==pytest.approx(-.3)

@pytest.mark.parametrize('kind',['signal','image','dems','baseline','poisson'])
def test_demo_pipeline(kind):
    p=Problem.model_validate(demo(kind)['problem']);p.parameters['max_iter']=30
    r=execute(p);assert np.isfinite(r['estimate']).all();assert r['audit']['adjoint_relative_error']<1e-11

@pytest.mark.parametrize('payload',[{'operator':{},'observed':[float('nan')]},
    {'operator':{},'observed':[1],'parameters':{'max_iter':99999}},
    {'operator':{},'task':'forward'},{'operator':{},'observed':[1],'surprise':True}])
def test_schema_rejection(payload):
    with pytest.raises(ValueError):Problem.model_validate(payload)

def test_http_jobs(tmp_path):
    with TestClient(create_app(tmp_path)) as c:
        assert c.get('/').status_code==200
        assert c.get('/api/v1/health').json()['status']=='ok'
        p=demo('signal')['problem'];p['parameters']['max_iter']=40
        sub=c.post('/api/v1/jobs',json=p);assert sub.status_code==202
        id=sub.json()['id']
        for _ in range(100):
            status=c.get('/api/v1/jobs/'+id).json()['status']
            if status not in ('queued','running'):break
            time.sleep(.03)
        assert status=='completed'
        result=c.get('/api/v1/jobs/'+id+'/result');assert result.status_code==200
        assert len(result.json()['audit']['input_sha256'])==64
        assert c.get('/api/v1/jobs/'+id+'/input').status_code==200
        assert c.get('/api/v1/jobs/bad-id').status_code==404
        assert c.post('/api/v1/jobs',json={'operator':{},'observed':[1],'parameters':{'max_iter':6000}}).status_code==422
        assert c.get('/api/v1/jobs').json()[0]['id']==id
    with TestClient(create_app(tmp_path)) as c: assert c.get('/api/v1/jobs/'+id).json()['status']=='completed'

def test_auth(tmp_path,monkeypatch):
    monkeypatch.setenv('CONVOLVEX_TOKEN','test-token')
    with TestClient(create_app(tmp_path)) as c:
        assert c.get('/api/v1/health').status_code==401
        assert c.get('/api/v1/health',headers={'Authorization':'Bearer test-token'}).status_code==200

@pytest.mark.skipif(not capability()['available'],reason='No CUDA/CuPy device available')
def test_gpu_cpu_parity():
    A=Convolution([.6,.3,.1],100);x=np.zeros(100);x[20:40]=1;y=A.forward(x)
    gpu=gpu_fista(A,y,l2=.01,max_iter=1500,tol=1e-7)
    cpu=fista(A,y,l2=.01,order=0,max_iter=1500,tol=1e-7)
    np.testing.assert_allclose(gpu.estimate,cpu.estimate,atol=2e-5)
