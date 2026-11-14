"""Numerical and HTTP checks for DEMS electrochemistry; all fixtures synthetic."""
import time
import numpy as np
import pytest
from fastapi.testclient import TestClient
from convolvex.physics import FARADAY
from convolvex.service import create_app
from convolvex.web_dems import DEMSDataset, DEMSSettings, SpeciesCalibration, process_dems
from convolvex.web_import import ImportPayload, import_table, preview_import
from convolvex.web_ms import WebMSProject, InlineAnalysis, execute_ms


def dataset():
    return DEMSDataset(time_s=[0,1,2,3,4],mz=[28,44],signal=[[0,1,2,3,4],[0,2,4,6,8]],signal_unit="A",
        time_origin="synthetic shared zero",ec_time_s=[0,.5,2.5,4],current_A=[-2,-2,2,2],
        potential_V=[0,.05,.25,.4],instrument_id="synthetic-ms",conditions_id="synthetic-condition",synthetic=True)


def calibrated_project():
    d=dataset();d.signal=[[1,2,3,4,5],[.5,1,1.5,2,2.5]]
    req=InlineAnalysis(response=[[1],[.5]],species=["synthetic product"],model="spectral",l2=0,l1=0,max_iter=200,tol=1e-10)
    project=WebMSProject(dataset=d,analysis=req)
    cal=SpeciesCalibration(species="synthetic product",record_id="synthetic standard",sensitivity_C_per_mol=1000.,electrons=2,
        reference_mz=28,instrument_id=d.instrument_id,conditions_id=d.conditions_id,includes_collection=True,confirmed=True,
        synthetic=True,mz=d.mz,response_column=[1,.5],model="spectral")
    s=DEMSSettings(start_s=.5,stop_s=3.5,calibrations=[cal],complete_window_confirmed=True,steady_state_confirmed=True)
    return project,s


def test_independent_ec_grid_exact_clipping_and_raw_signal_slope():
    d=dataset();before=d.model_dump()
    r=process_dems(d,DEMSSettings(start_s=.5,stop_s=3.5,lookup_value=2))
    assert r["signal"]["integral"] == pytest.approx(6)
    assert r["signal"]["slope_per_s"] == pytest.approx(1)
    assert r["electrochemistry_charge"]["net_C"] == pytest.approx(2)
    assert r["electrochemistry_charge"]["cathodic_C"] == pytest.approx(1)
    assert r["electrochemistry_charge"]["anodic_C"] == pytest.approx(3)
    assert r["lookup"]["segments"][0]["mean_potential_V"] == pytest.approx(.2)
    assert d.model_dump() == before
    assert r["quantification"]["available"] is False


def test_missing_values_are_not_bridged_and_ec_not_extrapolated():
    d=dataset();d.valid=[[True,True,False,True,True],[True]*5]
    d.ec_time_s=[1,3];d.current_A=[1,1];d.potential_V=[.1,.3]
    r=process_dems(d,DEMSSettings())
    assert r["signal"]["coverage_fraction"] == pytest.approx(.5)
    assert r["signal"]["integral"] == pytest.approx(4)
    assert r["trace"]["signal"][2] is None
    assert r["trace"]["potential_V"][0] is None and r["trace"]["potential_V"][-1] is None
    assert not r["electrochemistry_charge"]["available"]


def test_repeated_potential_crossings_remain_separate_and_tafel_rejects_reversal():
    d=dataset();d.ec_time_s=d.time_s;d.current_A=[-1]*5;d.potential_V=[0,.1,.2,.1,0]
    r=process_dems(d,DEMSSettings(lookup="potential",lookup_value=.1,lookup_tolerance=.001))
    assert r["lookup"]["matches"] == 2 and len(r["lookup"]["segments"]) == 2
    assert not r["tafel"]["available"] and "往返" in r["tafel"]["reason"]


def test_tafel_120_millivolts_and_overpotential_and_nonpositive_exclusion():
    e=np.linspace(.1,.46,41);signal=10**((e-.1)/.12)
    d=DEMSDataset(time_s=list(range(41)),mz=[44],signal=[signal.tolist()],signal_unit="A",time_origin="synthetic",
        ec_time_s=list(range(41)),potential_V=e.tolist(),synthetic=True)
    r=process_dems(d,DEMSSettings(tafel_bins=41,tafel_basis="channel",equilibrium_potential_V=.05))
    assert r["tafel"]["slope_mV_dec"] == pytest.approx(120,rel=1e-10)
    assert r["tafel"]["r_squared"] == pytest.approx(1)
    assert r["tafel"]["potential_V"][0] == pytest.approx(.05)
    assert r["tafel"]["kind"] == "signal_potential_slope"
    d.signal[0][0]=-1
    r=process_dems(d,DEMSSettings(tafel_bins=41,tafel_basis="channel"))
    assert r["tafel"]["excluded_nonpositive"] == 1
    assert r["tafel"]["slope_mV_dec"] == pytest.approx(120)


def test_small_potential_noise_does_not_mimic_a_return_scan():
    d=dataset();d.ec_time_s=d.time_s;d.current_A=[-1]*5;d.potential_V=[0,.1,.0998,.2,.3]
    d.signal[0]=[1,10,10,100,1000]
    assert process_dems(d,DEMSSettings())["tafel"]["available"]


def test_calibrated_amount_and_product_charge_not_ion_charge():
    p,s=calibrated_project();fit=execute_ms(p);r=process_dems(p.dataset,s,p.analysis,fit)
    q=r["quantification"]
    assert q["available"] and q["amount_mol"] == pytest.approx(.009)
    assert q["product_charge_C"] == pytest.approx(2*FARADAY*.009)
    assert r["signal"]["integral"] == pytest.approx(9)
    assert q["product_charge_C"] != r["signal"]["integral"]
    assert r["components"][0]["channel_contribution_mean"] == pytest.approx(3)
    assert r["trace"]["rate_scope"] == "transport_filtered"


@pytest.mark.parametrize("change,reason",[("window","完整"),("unit","单位"),("context","响应"),("instrument","仪器"),("synthetic","混用"),("missing","缺测")])
def test_absolute_quantification_requires_matching_calibration_and_support(change,reason):
    p,s=calibrated_project();fit=execute_ms(p)
    if change=="window":s.complete_window_confirmed=False
    if change=="unit":p.dataset.signal_unit="a.u."
    if change=="context":s.calibrations[0].response_column=[1,.6]
    if change=="instrument":s.calibrations[0].instrument_id="different"
    if change=="synthetic":s.calibrations[0].synthetic=False
    if change=="missing":p.dataset.valid=[[True,False,True,True,True],[True]*5]
    r=process_dems(p.dataset,s,p.analysis,fit)
    assert not r["quantification"]["available"] and reason in r["quantification"]["reason"]


def test_complex_system_contributions_use_convolved_detector_signal():
    d=dataset();a=InlineAnalysis(response=[[1,.5],[.2,1]],species=["A","B"],model="spectrotemporal",kernels=[[.5,.5],[1.]])
    fit={"estimate":[[2]*5,[4]*5],"converged":True}
    r=process_dems(d,DEMSSettings(lookup_value=0),a,fit)
    assert r["components"][0]["channel_contribution_mean"] == pytest.approx(1)
    assert r["components"][1]["channel_contribution_mean"] == pytest.approx(2)


def test_import_voltage_current_units_and_independent_ec_file():
    p=ImportPayload(filename="synthetic.csv",text="time_ms,mz_44 (pA),Ewe/mV,I/mA\n0,1,-100,-2\n500,2,-200,-3\n1000,3,-300,-4\n")
    info=preview_import(p);d=import_table(p)["dataset"]
    assert info["potential_column"] == 2 and info["current_column"] == 3
    assert d["potential_V"] == [-.1,-.2,-.3]
    assert d["current_A"] == [-.002,-.003,-.004]
    assert d["signal"][0][0] == pytest.approx(1e-12)
    ec=ImportPayload(filename="ec.csv",text="time_s,potential_V\n0,.1\n2,.2\n",synthetic=True)
    assert preview_import(ec)["kind"] == "electrochemistry"
    assert import_table(ec)["potential_V"] == [.1,.2]


def test_dems_http_uses_stored_result_and_preserves_settings(tmp_path):
    p,s=calibrated_project();p.dems=s
    with TestClient(create_app(tmp_path)) as client:
        raw=client.post('/api/v1/ms/process',json={"dataset":p.dataset.model_dump(),"settings":s.model_dump()})
        assert raw.status_code == 200 and not raw.json()["quantification"]["available"]
        key=client.post('/api/v1/jobs',json=p.model_dump()).json()["id"]
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            if client.get('/api/v1/jobs/'+key).json()['status']=='completed':break
            time.sleep(.01)
        result=client.post('/api/v1/ms/process',json={"job_id":key,"settings":s.model_dump()})
        assert result.status_code == 200 and result.json()["quantification"]["available"]
        assert client.get('/api/v1/jobs/'+key+'/input').json()['dems']['calibrations'][0]['electrons'] == 2
        p.dataset.signal[0][0]=100
        rejected=client.post('/api/v1/ms/process',json={"job_id":key,"dataset":p.dataset.model_dump()})
        assert rejected.status_code == 422 and "不一致" in rejected.json()['detail']
