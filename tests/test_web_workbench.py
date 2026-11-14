"""Focused regressions for the Web DEMS, import and public-spectrum paths."""
import base64
import io
import time
import numpy as np
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from convolvex import nist
from convolvex.massspec import MSDataset
from convolvex.service import create_app
from convolvex.web_import import ImportPayload, preview_import, import_table
from convolvex.web_ms import InlineAnalysis, WebMSProject, execute_ms, response_from_spectra


JCAMP = """##TITLE=Test reference
##DATA TYPE=MASS SPECTRUM
##XFACTOR=1
##YFACTOR=0.1
##NPOINTS=3
##PEAK TABLE=(XY..XY)
2,100 28,50 44,20
##END=
"""


def project():
    x = np.r_[np.zeros(8),np.ones(12),np.zeros(20)]
    data = MSDataset(time_s=list(map(float,range(40))),mz=[2,28],
        signal=[x.tolist(),(.5*x).tolist()],signal_unit="A",time_origin="test shared zero",
        ec_time_s=[0.,2.5,5.],current_A=[0.,.01,0.],synthetic=True)
    return WebMSProject(dataset=data,analysis=InlineAnalysis(response=[[1.],[.5]],species=["test component"],
        model="spectral",l2=0,l1=0,max_iter=100,tol=1e-8))


def test_jcamp_peak_scaling_and_order():
    spectrum = nist.parse_jcamp(JCAMP)
    assert spectrum["mz"] == [2,28,44]
    assert spectrum["intensity"] == [100,50,20]
    assert spectrum["source"] == "local JCAMP-DX"


@pytest.mark.parametrize("text", [JCAMP.replace("MASS SPECTRUM","INFRARED SPECTRUM"),
    JCAMP.replace("NPOINTS=3","NPOINTS=4"), JCAMP.replace("28,50","2,50"), JCAMP.replace("2,100","2,-100"),JCAMP.replace("2,100","2,invalid100")])
def test_invalid_reference_spectra_are_rejected(text):
    with pytest.raises(ValueError): nist.parse_jcamp(text)


def test_nist_fetch_is_on_demand_and_keeps_source(monkeypatch):
    calls=[]
    def fetch(parameters):
        calls.append(parameters)
        return JCAMP,"https://webbook.nist.gov/cgi/cbook.cgi?JCAMP=C124389"
    nist.lookup_spectrum.cache_clear()
    monkeypatch.setattr(nist,"_fetch",fetch)
    value=nist.lookup_spectrum("CO2")
    assert calls == [{"JCAMP":"C124389","Index":"0","Type":"Mass"}]
    assert value["source"] == "NIST Chemistry WebBook, SRD 69"
    assert value["source_url"].startswith("https://webbook.nist.gov/")
    nist.lookup_spectrum.cache_clear()


def test_unavailable_spectrum_is_not_replaced_by_a_parent(monkeypatch):
    nist.lookup_spectrum.cache_clear()
    monkeypatch.setattr(nist,"_fetch",lambda p:("<h1>No matching species</h1>","https://webbook.nist.gov/"))
    with pytest.raises(LookupError): nist.lookup_spectrum("unlisted isotope fixture")
    nist.lookup_spectrum.cache_clear()


def test_wide_csv_preserves_channels_masks_ec_and_converts_explicit_units():
    payload=ImportPayload(filename="scan.csv",text="time_ms,m/z 44 (nA),mz_2 (nA),current_mA,pressure_mbar\n0,2,1,1,.1\n500,,2,2,.2\n1000,4,3,1,.1\n")
    preview=preview_import(payload)
    assert preview["kind"] == "dems" and preview["mz"] == [44,2]
    data=import_table(payload)["dataset"]
    assert data["time_s"] == [0,.5,1]
    assert data["mz"] == [44,2] and data["signal_unit"] == "A"
    assert data["valid"] == [[True,False,True],[True,True,True]]
    assert data["signal"][0][0] == pytest.approx(2e-9)
    assert data["current_A"] == [.001,.002,.001]
    assert data["ec_time_s"] == [0,.5,1] and data["pressure_unit"] == "mbar"


def test_excel_sheet_selection_and_numeric_formulas():
    workbook=Workbook();workbook.active.title="Notes";workbook.active.append(["Notes"])
    sheet=workbook.create_sheet("DEMS");sheet.append(["time_s","mz_2","mz_44"])
    sheet.append([0,1,2]);sheet.append([1,2,4]);sheet.append([2,3,6])
    buffer=io.BytesIO();workbook.save(buffer)
    payload=ImportPayload(filename="run.xlsx",content_base64=base64.b64encode(buffer.getvalue()).decode(),sheet="DEMS")
    assert preview_import(payload)["sheets"] == ["Notes","DEMS"]
    assert import_table(payload)["dataset"]["signal"] == [[1,2,3],[2,4,6]]
    payload.sheet=None
    assert preview_import(payload)["sheet"] == "DEMS"
    sheet["B2"]="=1+1";buffer=io.BytesIO();workbook.save(buffer)
    payload.content_base64=base64.b64encode(buffer.getvalue()).decode()
    with pytest.raises(ValueError,match="公式"): import_table(payload)


def test_mixed_current_prefixes_are_converted_per_column():
    payload=ImportPayload(filename="run.csv",text="time_s,mz_2 (pA),mz_44 (nA)\n0,1,1\n1,2,2\n")
    assert preview_import(payload)["signal_unit"] == "auto"
    data=import_table(payload)["dataset"]
    assert data["signal"][0][0] == pytest.approx(1e-12)
    assert data["signal"][1][0] == pytest.approx(1e-9)


def test_csv_duplicate_times_rejected_but_irregular_times_retained():
    payload=ImportPayload(filename="run.csv",text="time_s,mz_2\n0,1\n0,2\n2,3\n")
    with pytest.raises(ValueError): import_table(payload)
    payload.text="time_s,mz_2\n0,1\n.8,2\n2,3\n"
    value=import_table(payload)
    assert value["dataset"]["time_s"] == [0,.8,2]
    assert value["summary"]["uniform_time"] is False


def test_local_spectrum_table_does_not_become_a_time_series():
    payload=ImportPayload(filename="spectrum.csv",text="mz,intensity\n2,10\n28,5\n44,2\n")
    value=import_table(payload)
    assert value["kind"] == "spectrum" and value["spectrum"]["intensity"] == [100,50,20]


def test_response_columns_and_missing_monitored_peak():
    spectrum=nist.parse_jcamp(JCAMP)
    value=response_from_spectra([44,2],[spectrum])
    assert value["response"] == [[.2],[1.]]
    assert value["references"][0]["reference_mz"] == 2
    with pytest.raises(ValueError): response_from_spectra([100],[spectrum])


def test_inline_ms_fit_retains_ec_and_numerical_units():
    p=project(); original_ec=p.dataset.ec_time_s[:]
    result=execute_ms(p)
    assert result["converged"] and result["relative_residual"] < 1e-6
    assert np.shape(result["estimate"]) == (1,40)
    assert result["estimate_unit"].startswith("A")
    assert p.dataset.ec_time_s == original_ec
    assert result["quantification_status"] == "requires_external_instrument_calibration"


def test_temporal_and_sequential_acquisition_guards():
    p=project();p.dataset.channel_offsets_s=[0,.1]
    with pytest.raises(ValueError,match="时间偏移"):execute_ms(p)
    p.dataset.channel_offsets_s=None;p.analysis.model="spectrotemporal";p.analysis.kernels=[[1.]]
    p.dataset.time_s[3]=3.2
    with pytest.raises(ValueError,match="均匀时间"):execute_ms(p)


def test_web_ms_job_and_project_round_trip(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        request=project().model_dump()
        checked=client.post('/api/v1/ms/project/validate',json=request)
        assert checked.status_code == 200
        submitted=client.post('/api/v1/jobs',json=request)
        assert submitted.status_code == 202
        key=submitted.json()["id"]
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            state=client.get('/api/v1/jobs/'+key).json()
            if state['status'] not in {'running','queued'}:break
            time.sleep(.01)
        assert state['status'] == 'completed'
        assert client.get('/api/v1/jobs/'+key+'/input').json() == request
        assert client.get('/api/v1/jobs/'+key+'/result').json()['species'] == ["test component"]
        catalog=client.get('/api/v1/spectra/catalog').json()
        assert {g['id'] for g in catalog['groups']} == {'co2rr','norr','cn_coupling','isotopes','common'}
        coupling=[e for e in catalog['entries'] if e['group']=='cn_coupling']
        assert {'57-13-6','75-12-7','60-35-5','74-89-5','75-05-8'} <= {e['query'] for e in coupling}
        assert all(e['availability']=='on-demand' for e in catalog['entries'])
