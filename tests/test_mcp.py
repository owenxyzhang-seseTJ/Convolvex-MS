import asyncio
import base64
import io
import json
import sys
import time
import numpy as np
import pytest
from fastapi.testclient import TestClient
from convolvex.agent_runner import StdioClient, run_workflow
from convolvex.massspec import MSDataset, digest
from convolvex.ms_workspace import MSWorkspace, write_json
from convolvex.mcp_server import MCPApplication, create_http_app, serve_stdio, strict_json, MODERN, VERSIONS, META_PREFIX
from convolvex.operators import Identity
from convolvex.solvers import fista


def rpc(method,params=None,i=1,modern=False):
    p={} if params is None else dict(params)
    if modern:p['_meta']={META_PREFIX+'protocolVersion':MODERN,META_PREFIX+'clientCapabilities':{}}
    return {'jsonrpc':'2.0','id':i,'method':method,'params':p}

@pytest.fixture
def app(tmp_path):
    w=MSWorkspace(tmp_path)
    try: yield MCPApplication(w)
    finally:w.close()


def tiny_data():
    t=np.arange(60,dtype=float);x=np.maximum(0,np.sin(t/15))
    return MSDataset(time_s=t.tolist(),mz=[2,28],signal=[x.tolist(),(.3*x).tolist()],signal_unit='a.u.',
                     time_origin='synthetic origin',synthetic=True)

@pytest.mark.parametrize('scale',[1.,1e-6,1e-9,1e-12])
def test_scale_relative_solver(scale):
    y=np.array([.2,1.,.7,0.])*scale
    r=fista(Identity((4,)),y,l2=0,tol=1e-10,max_iter=20)
    assert r.converged
    np.testing.assert_allclose(r.estimate/scale,y/scale,atol=1e-12)

@pytest.mark.parametrize('text',['{"a":1,"a":2}','{"a":NaN}','{"a":Infinity}','{"a":-Infinity}'])
def test_strict_json(text):
    with pytest.raises(ValueError):strict_json(text)

@pytest.mark.parametrize('method',['tools/list','resources/list','resources/templates/list','prompts/list','ping','server/discover'])
def test_modern_catalog(app,method):
    r=app.handle(rpc(method,modern=True),True,False)
    assert r['result']['resultType']=='complete'
    assert r['result']['_meta'][META_PREFIX+'serverInfo']['version']=='1.1.0'
    if method=='tools/list':
        names=[x['name'] for x in r['result']['tools']]
        assert len(names)==15 and names==sorted(names)
        assert all(x['inputSchema']['type']=='object' for x in r['result']['tools'])


def test_protocol_errors(app):
    assert app.handle(rpc('tools/list'),True,False)['error']['code']==-32000
    assert app.handle(rpc('not_a_method',modern=True))['error']['code']==-32601
    p=rpc('tools/list',modern=True);p['params']['_meta'][META_PREFIX+'protocolVersion']='2099-01-01'
    e=app.handle(p)['error'];assert e['code']==-32022 and e['data']['supported']==list(VERSIONS)
    p=rpc('tools/list',modern=True);del p['params']['_meta'][META_PREFIX+'clientCapabilities']
    assert app.handle(p)['error']['code']==-32602
    assert app.handle({'jsonrpc':'2.0','id':True,'method':'ping'})['error']['code']==-32600
    assert app.handle([])['error']['code']==-32600
    assert app.handle({'jsonrpc':'2.0','method':'notifications/cancelled','params':{'requestId':9}}) is None


def test_resources_and_prompt(app):
    for uri in ['convolvex://schema/dataset','convolvex://schema/analysis','convolvex://workflow','convolvex://limitations']:
        r=app.handle(rpc('resources/read',{'uri':uri},modern=True))
        assert r['result']['contents'][0]['uri']==uri
    r=app.handle(rpc('resources/read',{'uri':'file:///etc/passwd'},modern=True))
    assert r['error']['code']==-32602
    p=app.handle(rpc('prompts/get',{'name':'analyze_mass_spectrometry'},modern=True))
    assert 'calibration' in p['result']['messages'][0]['content']['text']
    e=app.handle(rpc('tools/call',{'name':'ms_read_array','arguments':{'job_id':'x','count':99999}},modern=True))
    assert e['result']['isError'] is True
    assert 'input_value' not in e['result']['content'][0]['text']


def test_stdio_lifecycle_stream(app):
    init=rpc('initialize',{'protocolVersion':'2025-11-25','capabilities':{},'clientInfo':{'name':'test','version':'0'}})
    msg=[rpc('tools/list'),init,{'jsonrpc':'2.0','method':'notifications/initialized'},rpc('tools/list',i=2)]
    inp=io.BytesIO(('\n'.join(json.dumps(x) for x in msg)+'\nnot-json\n').encode())
    out=io.StringIO();serve_stdio(app,inp,out)
    rows=[json.loads(x) for x in out.getvalue().splitlines()]
    assert rows[0]['error']['code']==-32000
    assert rows[1]['result']['protocolVersion']=='2025-11-25'
    assert len(rows[2]['result']['tools'])==15
    assert rows[3]['error']['code']==-32700


def test_http_profile_and_protection(app):
    token='t'*40
    headers={'Authorization':'Bearer '+token,'Accept':'application/json, text/event-stream','MCP-Protocol-Version':MODERN}
    http=create_http_app(app,token)
    with TestClient(http,base_url='http://127.0.0.1:8766') as c:
        h={**headers,'Mcp-Method':'tools/list'}
        assert c.post('/mcp',json=rpc('tools/list',modern=True),headers=h).status_code==200
        assert c.post('/mcp',json=rpc('tools/list',modern=True)).status_code==401
        assert c.post('/mcp',json=rpc('tools/list',modern=True),headers={**h,'Origin':'https://evil.invalid'}).status_code==403
        assert c.post('/mcp',json=rpc('tools/list',modern=True),headers={**h,'Host':'evil.invalid'}).status_code==403
        bad=c.post('/mcp',json=rpc('tools/list',modern=True),headers={**h,'Mcp-Method':'tools/call'})
        assert bad.status_code==400 and bad.json()['error']['code']==-32020
        bad=c.post('/mcp',json=rpc('tools/list',modern=True),headers={**h,'MCP-Protocol-Version':'2025-11-25'})
        assert bad.json()['error']['code']==-32020
        call=rpc('tools/call',{'name':'ms_capabilities','arguments':{}},modern=True)
        h={**headers,'Mcp-Method':'tools/call','Mcp-Name':'ms_capabilities'}
        good=c.post('/mcp',json=call,headers=h)
        assert good.status_code==200 and good.json()['result']['structuredContent']['tool_count']==15
        encoded='=?base64?'+base64.b64encode(b'ms_capabilities').decode()+'?='
        assert c.post('/mcp',json=call,headers={**h,'Mcp-Name':encoded}).status_code==200
        assert c.post('/mcp',json=call,headers={**h,'Mcp-Name':'wrong'}).status_code==400
        assert c.get('/mcp',headers=headers).status_code==405
        assert c.delete('/mcp',headers=headers).status_code==405
        assert c.post('/mcp',json=rpc('unknown',modern=True),headers={**headers,'Mcp-Method':'unknown'}).status_code==404
        assert c.post('/mcp',json=call,headers={**h,'Accept':'application/json'}).status_code==406
        legacy={**headers,'MCP-Protocol-Version':'2025-06-18'}
        assert c.post('/mcp',json=rpc('tools/list'),headers=legacy).status_code==200
        assert c.post('/mcp',json={'jsonrpc':'2.0','method':'notifications/initialized'},headers=legacy).status_code==202
    with pytest.raises(ValueError):create_http_app(app,'short')

@pytest.mark.parametrize('protocol',[MODERN,'2025-11-25','2025-06-18'])
def test_actual_subprocess(tmp_path,protocol):
    with StdioClient(tmp_path,protocol=protocol) as c:
        assert len(c.request('tools/list',{})['tools'])==15
        data=tiny_data()
        key=c.tool('ms_import_dataset',{'data':data.model_dump()})['dataset_id']
        audit=c.tool('ms_inspect',{'dataset_id':key})
        assert audit['synthetic']
        req={'dataset_id':key,'response':[[1],[.3]],'species':['candidate'],'model':'spectral','l2':0,'tol':1e-8}
        job=c.tool('ms_submit_analysis',{'request':req})['job_id']
        for _ in range(100):
            status=c.tool('ms_get_job',{'job_id':job})
            if status['status']=='completed':break
            time.sleep(.02)
        assert status['status']=='completed'
        result=c.tool('ms_get_result',{'job_id':job})
        assert result['converged']
        arr=c.tool('ms_read_array',{'job_id':job,'field':'estimate','count':20})
        assert len(arr['values'])==20
        with pytest.raises(RuntimeError):
            c.tool('ms_quantify',{'job_id':job,'species_index':0,'calibration_id':'missing','start_s':0,'stop_s':59})
        assert not c.stderr


def test_agent_end_to_end(tmp_path):
    (tmp_path/'inbox').mkdir()
    write_json(tmp_path/'inbox'/'test.json',tiny_data().model_dump())
    plan={'input':{'relative_path':'test.json','time_origin':'sim'},
          'analysis':{'response':[[1],[.3]],'species':['candidate'],'model':'spectral','l2':.002,'max_iter':500,'tol':1e-6},
          'l2_factors':[.5,1.,2.],'max_jobs':3}
    result=run_workflow(plan,tmp_path)
    assert len(result['jobs'])==3 and result['protocol']==MODERN
    assert result['quantification_status'].startswith('not_attempted')
    assert result['synthetic'] is True
    assert result['conclusion_status']=='conditional_model_fit_available'
    assert all('result_sha256' in x for x in result['trace'])
    with pytest.raises(ValueError):run_workflow({**plan,'max_jobs':999},tmp_path)


def test_optional_official_sdk_v1(tmp_path):
    pytest.importorskip('mcp',reason='Official MCP SDK not installed; no third-party interoperability claim')
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    async def run():
        args=StdioServerParameters(command=sys.executable,args=['-m','convolvex.mcp_server','--workspace',str(tmp_path)])
        async with stdio_client(args) as (read,write):
            async with ClientSession(read,write) as session:
                await session.initialize()
                tools=await session.list_tools()
                assert len(tools.tools)==15
                result=await session.call_tool('ms_capabilities',{})
                assert not result.isError
    asyncio.run(run())
