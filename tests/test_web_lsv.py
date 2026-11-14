"""Classical DEMS/LSV workflow on synthetic signals and public reference snapshots."""
import numpy as np
import pytest
from fastapi.testclient import TestClient
from convolvex.web_import import ImportPayload, import_table, preview_import
from convolvex.web_dems import DEMSDataset, DEMSSettings, SpeciesCalibration, process_dems
from convolvex.physics import FARADAY
from convolvex.web_ms import InlineAnalysis, WebMSProject, execute_ms, ms_demo, response_from_spectra
from convolvex.service import create_app


def test_lsv_without_time_requires_explicit_scan_rate_and_preserves_potential_order():
    p=ImportPayload(filename='lsv.csv',text='Ewe/V,<I>/mA\n.1,-1\n0,-2\n-.1,-3\n')
    info=preview_import(p)
    assert info['kind']=='electrochemistry' and info['time_column']==-1 and info['current_column']==1
    with pytest.raises(ValueError,match='扫描速率'):import_table(p)
    p.scan_rate_mV_s=10;p.lsv_start_s=2
    ec=import_table(p)
    assert ec['ec_time_s']==[2,12,22]
    assert ec['potential_V']==[.1,0,-.1] and ec['current_A']==[-.001,-.002,-.003]
    assert ec['time_source'].startswith('reconstructed')


@pytest.mark.parametrize('potentials',['0,.1,0','0,0,.1'])
def test_lsv_reconstruction_does_not_guess_time_for_cv_or_holds(potentials):
    p=ImportPayload(filename='lsv.csv',text='potential_V,current_A\n'+'\n'.join(f'{e},-1' for e in potentials.split(',')),scan_rate_mV_s=10)
    with pytest.raises(ValueError,match='单向'):import_table(p)


def test_current_density_needs_area_and_keeps_recorded_time():
    p=ImportPayload(filename='lsv.csv',text='time_s,Ewe/V,j/mA cm^-2\n0,0,-2\n1,-.1,-4\n')
    assert preview_import(p)['current_unit']=='mA/cm2'
    with pytest.raises(ValueError,match='面积'):import_table(p)
    p.electrode_area_cm2=.5
    ec=import_table(p)
    assert ec['ec_time_s']==[0,1] and ec['current_A']==[-.001,-.002]
    assert ec['time_source']=='recorded time'


def test_delay_alignment_uses_matching_ec_window_and_does_not_extrapolate():
    d=DEMSDataset(time_s=list(range(7)),mz=[44],signal=[[1]*7],signal_unit='A',time_origin='synthetic zero',
        ec_time_s=list(range(5)),potential_V=[0,.1,.2,.3,.4],current_A=[-1]*5,synthetic=True)
    before=d.model_dump()
    r=process_dems(d,DEMSSettings(start_s=2,stop_s=6,transport_delay_s=2,lookup_value=4))
    assert r['lookup']['segments'][0]['mean_potential_V']==pytest.approx(.2)
    assert r['electrochemistry_charge']['interval_s']==[0,4]
    assert r['electrochemistry_charge']['cathodic_C']==4
    assert r['trace']['potential_V'][:2]==[None,None]
    assert r['lsv']['median_scan_rate_mV_s']==pytest.approx(100)
    assert r['lsv']['raw_lsv']['current_A']==[-1]*5
    assert r['trace']['electrode_time_s']==list(range(-2,5))
    assert d.model_dump()==before


def test_transport_kernel_and_pure_delay_are_not_applied_twice():
    d=DEMSDataset(time_s=[0,1,2],mz=[44],signal=[[1,1,1]],signal_unit='A',time_origin='synthetic',
        ec_time_s=[0,1,2],potential_V=[0,.1,.2],current_A=[-1]*3,synthetic=True)
    a=InlineAnalysis(response=[[1]],species=['二氧化碳'],kernels=[[1]],model='spectrotemporal')
    r=process_dems(d,DEMSSettings(transport_delay_s=5),a,{'estimate':[[1,1,1]],'converged':True})
    assert r['alignment']['transport_delay_applied_s']==0
    assert r['trace']['potential_V']==[0,.1,.2]
    assert any('未再次' in w for w in r['warnings'])


def test_blank_only_linear_background_precedes_fragment_unmixing():
    t=np.arange(10,dtype=float);source=np.r_[np.zeros(3),np.ones(7)]
    background=np.stack([2+.1*t,3-.05*t])
    raw=background+np.array([[1],[.5]])*source
    d=DEMSDataset(time_s=t.tolist(),mz=[28,44],signal=raw.tolist(),signal_unit='A',time_origin='synthetic',synthetic=True)
    a=InlineAnalysis(response=[[1],[.5]],species=['明确命名的合成物质'],model='spectral',l1=0,l2=0,tol=1e-10,
        blank_windows_s=[[0,2]],blank_model='linear')
    p=WebMSProject(dataset=d,analysis=a);r=execute_ms(p)
    assert np.allclose(r['estimate'][0],source,atol=1e-7)
    assert np.allclose(r['background'],background)
    assert np.allclose(r['predicted'],raw)
    assert p.dataset.signal==raw.tolist()
    processed=process_dems(p.dataset,DEMSSettings(),a,r)
    assert np.allclose(processed['trace']['signal'],source)
    assert np.allclose(processed['trace']['raw_signal'],raw[0])


def test_default_demo_uses_named_nist_species_with_corresponding_response():
    doc=ms_demo();p=WebMSProject.model_validate(doc['project'])
    assert p.analysis.species==['氢气 (H₂)','一氧化碳 (CO)','二氧化碳 (CO₂)']
    assert p.dataset.synthetic and p.dataset.signal_unit=='A'
    assert p.dataset.metadata['spectrum_references'][2]['cas']=='124-38-9'
    fit=execute_ms(p)
    assert fit['converged'] and fit['relative_residual']<.03
    assert fit['species']==p.analysis.species


def test_reference_import_keeps_explicit_identity_and_cas(tmp_path):
    with TestClient(create_app(tmp_path)) as c:
        r=c.post('/api/v1/spectra/import',json={'filename':'standard.json','text':'##TITLE=CO2\n##DATA TYPE=MASS SPECTRUM\n##PEAK TABLE=(XY..XY)\n28,10 44,100\n##END=',
            'name':'二氧化碳 (CO₂)','cas':'124-38-9','formula':'CO2'})
        assert r.status_code==200
        spectrum=r.json()
        assert spectrum['name']=='二氧化碳 (CO₂)' and spectrum['cas']=='124-38-9'
        response=response_from_spectra([28,44],[spectrum])
        assert response['species']==['二氧化碳 (CO₂)']
        assert response['references'][0]['display_name']=='二氧化碳 (CO₂)'
        with pytest.raises(ValueError,match='名称'):
            response_from_spectra([44],[{'mz':[44],'intensity':[100]}])


@pytest.mark.parametrize('model',['spectral','spectrotemporal'])
def test_calibrated_lsv_partial_current_density_and_conditional_fe(model):
    d=DEMSDataset(time_s=[0,1,2],mz=[44],signal=[[1,2,3]],signal_unit='A',time_origin='synthetic',
        ec_time_s=[0,1,2],potential_V=[.1,0,-.1],current_A=[-1]*3,instrument_id='fixture',conditions_id='fixture',synthetic=True)
    kernel=[1.] if model=='spectrotemporal' else None
    a=InlineAnalysis(response=[[1]],species=['二氧化碳 (CO₂)'],model=model,kernels=[kernel] if kernel else None,l2=0,l1=0,tol=1e-10)
    cal=SpeciesCalibration(species=a.species[0],record_id='synthetic-only',sensitivity_C_per_mol=1e6,electrons=2,
        reference_mz=44,instrument_id='fixture',conditions_id='fixture',includes_collection=True,confirmed=True,synthetic=True,
        mz=[44],response_column=[1],model=model,kernel=kernel)
    p=WebMSProject(dataset=d,analysis=a)
    s=DEMSSettings(electrode_area_cm2=2,steady_state_confirmed=True,complete_window_confirmed=True,calibrations=[cal])
    r=process_dems(p.dataset,s,a,execute_ms(p))
    partial=np.arange(1,4)*2*FARADAY/1e6
    assert np.allclose(r['lsv']['product_current_A'],-partial)
    assert np.allclose(r['lsv']['product_current_density_A_cm2'],-partial/2)
    assert np.allclose(r['lsv']['instantaneous_FE'],partial)
    assert r['lsv']['polarization_scope']==('transport_corrected' if kernel else 'transport_filtered')
