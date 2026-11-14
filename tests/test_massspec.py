import json,time
import numpy as np
import pytest
from convolvex.operators import SpectroTemporal, Mixing, adjoint_error
from convolvex.ms_operators import BatchedSpectroTemporal,ChannelProjected,channel_pars
from convolvex.massspec import MSDataset,AnalysisRequest,ProfileRequest,audit_dataset,response_diagnostics,digest,analyze,analyze_profile,background_diagnosis
from convolvex.ms_workspace import MSWorkspace,write_json
from convolvex.inference import pars


@pytest.fixture
def dataset():
    n=90;t=np.arange(n,dtype=float); x=np.zeros((2,n));x[0,20:40]=1;x[1,48:66]=.7
    S=np.array([[1,.1],[.2,1.],[.3,.6]])
    h=[np.array([.6,.3,.1]),np.array([.5,.3,.2])]
    y=BatchedSpectroTemporal(S,h,n).forward(x)
    return MSDataset(time_s=t.tolist(),mz=[28,44,45],signal=y.tolist(),signal_unit="A",time_origin="simulation t=0",synthetic=True,
                     instrument_id="sim",conditions_id="sim-1",ec_time_s=t.tolist(),current_A=(-np.ones(n)*.1).tolist()),S,h,x


@pytest.mark.parametrize('mode',['causal','full'])
@pytest.mark.parametrize('species',[1,3,8])
def test_batched_matches_legacy(mode,species):
    rng=np.random.default_rng(3); S=rng.uniform(.1,1,(5,species)); hs=[rng.uniform(0,1,9) for _ in range(species)]
    a=SpectroTemporal(S,hs,73,mode,sample_volume=.3); b=BatchedSpectroTemporal(S,hs,73,mode,.3)
    x=rng.normal(size=a.input_shape);y=rng.normal(size=a.output_shape)
    np.testing.assert_allclose(a.forward(x),b.forward(x),atol=1e-12)
    np.testing.assert_allclose(a.adjoint(y),b.adjoint(y),atol=1e-12)
    assert adjoint_error(b)<1e-12


def test_ragged_kernel_causal():
    rng=np.random.default_rng(1);S=rng.random((4,3));hs=[[.4,.6],[.5,.3,.2],[1.]]
    a=SpectroTemporal(S,hs,80);b=BatchedSpectroTemporal(S,hs,80)
    np.testing.assert_allclose(a.forward(np.ones((3,80))),b.forward(np.ones((3,80))),atol=1e-12)
    assert adjoint_error(b)<1e-12
    with pytest.raises(ValueError):BatchedSpectroTemporal(S,hs,80,mode='full')


def test_structured_projection_equivalence():
    rng=np.random.default_rng(12); C,N,P=3,40,2
    A=Mixing([[1,.1],[.2,1.],[.4,.2]],N); t=np.linspace(0,1,N);B=np.column_stack([np.ones(N),t]);w=rng.uniform(.5,1.5,(C,N))
    X=rng.uniform(0,1,(2,N)); y=A.forward(X)+rng.normal(size=(C,2))@B.T
    dense=np.kron(np.eye(C),B)
    a=pars(A,y,dense,weights=w,l2=.02,max_iter=300,tol=1e-6)
    b=channel_pars(A,y,B,weights=w,l2=.02,max_iter=300,tol=1e-6)
    np.testing.assert_allclose(a.estimate,b.estimate,atol=2e-9)
    np.testing.assert_allclose(a.predicted,b.predicted,atol=2e-9)
    assert adjoint_error(ChannelProjected(A,w,B))<1e-12
    assert b.diagnostics['background_orthogonality']<1e-10


def test_projection_rejects_huber():
    with pytest.raises(ValueError,match='Gaussian'):
        channel_pars(Mixing([[1]],10),np.ones((1,10)),np.ones((10,1)),loss='huber')


@pytest.mark.parametrize('change',[
    {'time_s':[0.,0.]},{'mz':[44,44,45]},{'signal_unit':'mA'},
    {'current_A':None},{'pressure':[1.]*90}, {'channel_offsets_s':[0.]},
    {'valid':[[False]*90]*3}, {'signal':[[float('nan')]*90]*3}, {'unknown':2}])
def test_invalid_dataset(dataset,change):
    data,*_=dataset; doc=data.model_dump();doc.update(change)
    with pytest.raises(ValueError): MSDataset(**doc)


def test_nonuniform_and_scan_offsets_rejected(dataset):
    data,S,h,_=dataset;doc=data.model_dump();doc['time_s'][-1]+=.1;d=MSDataset(**doc)
    req=AnalysisRequest(dataset_id=digest(d.model_dump()),response=S.tolist(),species=['a','b'],kernels=[x.tolist() for x in h])
    assert not audit_dataset(d)['uniform_time']
    with pytest.raises(ValueError,match='uniform'): analyze(d,req)
    doc=data.model_dump();doc['channel_offsets_s']=[0,.02,.04];d=MSDataset(**doc)
    req.dataset_id=digest(d.model_dump())
    with pytest.raises(ValueError,match='offsets'): analyze(d,req)


@pytest.mark.parametrize('method',['fista','tikhonov','tv','channel_pars'])
def test_analysis_methods(dataset,method):
    data,S,h,x=dataset
    req=AnalysisRequest(dataset_id=digest(data.model_dump()),response=S.tolist(),species=['a','b'],kernels=[k.tolist() for k in h],method=method,max_iter=500,l2=.001)
    out=analyze(data,req)
    assert np.shape(out['estimate'])==x.shape
    assert out['diagnostics']['adjoint_relative_error']<1e-12
    assert out['quantification_status'].startswith('not_evaluated')
    assert out['audit']['synthetic']


def test_low_iteration_is_not_converged(dataset):
    data,S,h,_=dataset
    r=analyze(data,AnalysisRequest(dataset_id=digest(data.model_dump()),response=S.tolist(),species=['a','b'],kernels=[k.tolist() for k in h],max_iter=1,tol=1e-12))
    assert not r['converged']
    assert r['science_status']=='numerical_fit_not_converged'


def test_response_rank_and_collinearity():
    r=response_diagnostics([[1,1],[.3,.3]])
    assert not r['full_column_rank'] and r['normalized_condition'] is None and r['near_collinear_pairs']


def test_blank_residual_signed():
    t=np.arange(100.); ref=10+.03*t+np.sin(t/10); target=.2+.012*ref;target[40:60]-=.1
    d=MSDataset(time_s=t.tolist(),mz=[44,45],signal=[ref.tolist(),target.tolist()],signal_unit='a.u.',time_origin='test')
    detail,child=background_diagnosis(d,[45],[44],[[0,30],[70,99]],drift=True)
    assert np.max(np.abs(np.asarray(detail['signed_residual'])[0,:30]))<1e-12
    assert min(child.signal[0])<-.09 and child.mz==[45]
    assert child.metadata['parent_dataset_sha256']==digest(d.model_dump())
    with pytest.raises(ValueError): background_diagnosis(d,[45],[45],[[0,30]])


def test_mass_profile():
    req=ProfileRequest(mz_grid=np.linspace(40,50,101).tolist(),observed=np.exp(-((np.arange(101)-50)/5)**2).tolist(),line_shape=[.2,.6,.2],max_iter=30)
    r=analyze_profile(req);assert len(r['estimate'])==101 and r['audit']['axis']=='m/z'
    with pytest.raises(ValueError):ProfileRequest(**{**req.model_dump(),'line_shape':[.5,.5]})
    with pytest.raises(ValueError):ProfileRequest(**{**req.model_dump(),'mz_grid':[1.]*101})


def wait_for(w,j):
    for _ in range(1000):
        state=w.get_job(j)
        if state['status'] in {'completed','failed','cancelled','interrupted'}:return state
        time.sleep(.005)
    raise TimeoutError()


def test_workspace_result_reuse_and_slice(tmp_path,dataset):
    data,S,h,_=dataset;w=MSWorkspace(tmp_path)
    try:
        imp=w.put_dataset(data)
        req=AnalysisRequest(dataset_id=imp['dataset_id'],response=S.tolist(),species=['a','b'],kernels=[k.tolist() for k in h],max_iter=600)
        job=w.submit(req.model_dump());key=job['job_id']
        assert wait_for(w,key)['status']=='completed'
        summary=w.result(key); assert 'estimate' not in summary
        page=w.read_array(key,count=10);assert len(page['values'])==10 and page['next_start']==10
        assert w.submit(req.model_dump())['reused']
        with pytest.raises(ValueError):w.read_array(key,count=3000)
        assert w.charge(imp['dataset_id'])['cathodic_C']==pytest.approx(8.9)
        with pytest.raises(ValueError):w.quantify(key,0,'missing',0,89,True)
        with pytest.raises(RuntimeError):MSWorkspace(tmp_path)
    finally:w.close()
    w=MSWorkspace(tmp_path)
    try: assert w.result(key)['array_sha256']==summary['array_sha256']
    finally:w.close()


def test_files_sandbox(tmp_path,dataset):
    data,*_=dataset;w=MSWorkspace(tmp_path/'ws')
    try:
        write_json(w.root/'inbox'/'data.json',data.model_dump())
        assert w.import_file('data.json')['shape']==[3,90]
        for path in ['../data.json','/etc/passwd','https://example.com/data.json']:
            with pytest.raises(ValueError):w.import_file(path)
        (w.root/'inbox'/'bad.csv').write_text('time_s,mz_44\n0,=system()\n1,4\n')
        with pytest.raises(ValueError):w.import_file('bad.csv')
    finally:w.close()


def test_symbolic_link_import_rejected(tmp_path,dataset):
    data,*_=dataset;w=MSWorkspace(tmp_path/'ws')
    try:
        outside=tmp_path/'outside.json';write_json(outside,data.model_dump())
        try:
            (w.root/'inbox'/'link.json').symlink_to(outside)
        except OSError as exc:
            if getattr(exc,'winerror',None)==1314:
                pytest.skip('Windows account cannot create symlinks (WinError 1314); import guards remain enabled')
            raise
        with pytest.raises(ValueError,match='links'):w.import_file('link.json')
    finally:w.close()


def test_verified_quantification_and_fingerprint(tmp_path):
    # A transparent synthetic calibration with analytically known amount/FE.
    n=30;t=np.arange(n,dtype=float);x=np.ones((1,n))*1e-9
    d=MSDataset(time_s=t.tolist(),mz=[2],signal=x.tolist(),signal_unit='A',time_origin='sim',synthetic=True,
                instrument_id='sim',conditions_id='one',ec_time_s=t.tolist(),current_A=(-np.ones(n)*1e-4).tolist())
    w=MSWorkspace(tmp_path)
    try:
        key=w.put_dataset(d)['dataset_id']
        req=AnalysisRequest(dataset_id=key,response=[[1]],species=['H2'],kernels=[[1]],l2=0,max_iter=100,tol=1e-12)
        job=w.submit(req.model_dump())['job_id']; assert wait_for(w,job)['status']=='completed'
        cal={'record_id':'sim','species':'H2','verified':True,'verified_by':'test only','includes_collection':True,
             'instrument_id':'sim','conditions_id':'one','reference_mz':2,'sensitivity_C_per_mol':10.,'electrons':2,
             'response_sha256':digest(req.response),'kernel_sha256':digest({'kernel':req.kernels[0],'convention':'discrete'}),'synthetic':True}
        write_json(w.root/'calibrations'/'sim.json',cal)
        out=w.quantify(job,0,'sim',0,29,True)
        assert out['amount_mol']==pytest.approx(2.9e-9,rel=1e-4)
        with pytest.raises(ValueError,match='Complete'):w.quantify(job,0,'sim',0,29,False)
        cal['response_sha256']='bad';write_json(w.root/'calibrations'/'sim.json',cal)
        with pytest.raises(ValueError,match='fingerprint'):w.quantify(job,0,'sim',0,29,True)
    finally:w.close()


def test_cancel_and_queue_budget(tmp_path,monkeypatch,dataset):
    import convolvex.ms_workspace as module
    from convolvex.solvers import CancelledError
    def slow(data,req,cancel=None,callback=None):
        for _ in range(1000):
            if cancel():raise CancelledError()
            time.sleep(.002)
        raise AssertionError('test worker should be cancelled')
    monkeypatch.setattr(module,'analyze',slow)
    w=MSWorkspace(tmp_path,workers=1,capacity=1)
    try:
        data=dataset[0];key=w.put_dataset(data)['dataset_id']
        req=AnalysisRequest(dataset_id=key,response=[[1,0],[0,1],[.3,.4]],species=['a','b'],model='spectral')
        job=w.submit(req.model_dump())['job_id']
        with pytest.raises(ValueError,match='queue'):w.submit(req.model_dump(),reuse=False)
        w.cancel(job)
        assert wait_for(w,job)['status']=='cancelled'
    finally:w.close()


def test_restart_interrupted(tmp_path):
    import uuid
    w=MSWorkspace(tmp_path);key=str(uuid.uuid4())
    with w.connection() as con:
        con.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?)',(key,time.time(),'running','analysis','0'*64,None))
    w.close();w=MSWorkspace(tmp_path)
    try:assert w.get_job(key)['status']=='interrupted'
    finally:w.close()


def test_result_array_tamper_detected(tmp_path,dataset):
    w=MSWorkspace(tmp_path)
    try:
        data=dataset[0];key=w.put_dataset(data)['dataset_id']
        req=AnalysisRequest(dataset_id=key,response=[[1,0],[0,1],[.3,.4]],species=['a','b'],model='spectral')
        job=w.submit(req.model_dump())['job_id'];wait_for(w,job)
        path=w.root/'jobs'/job/'arrays.npz';path.write_bytes(path.read_bytes()+b'tamper')
        with pytest.raises(ValueError,match='checksum'):w.read_array(job)
    finally:w.close()


def test_dataset_tamper_detected(tmp_path,dataset):
    w=MSWorkspace(tmp_path)
    try:
        data=dataset[0];key=w.put_dataset(data)['dataset_id']
        doc=data.model_dump();doc['signal'][0][0]+=.1
        write_json(w.root/'datasets'/(key+'.json'),doc)
        with pytest.raises(ValueError,match='checksum'):w.dataset(key)
    finally:w.close()


def test_duplicate_file_json_rejected(tmp_path):
    w=MSWorkspace(tmp_path)
    try:
        (w.root/'inbox'/'bad.json').write_text('{"time_s":[0,1],"time_s":[2,3]}')
        with pytest.raises(ValueError,match='Duplicate'):w.import_file('bad.json')
    finally:w.close()
