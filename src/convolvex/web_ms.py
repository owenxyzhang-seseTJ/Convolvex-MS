"""Inline Web DEMS requests using the existing MS operators and solvers.

The Web contract carries its dataset directly and does not require a workspace
checksum identifier. Numerical methods remain shared with the Python/MS core.
"""
from typing import Literal
import numpy as np
from pydantic import Field, FiniteFloat, model_validator, field_validator
from .massspec import Contract, MSDataset, AnalysisRequest, response_diagnostics
from .operators import Mixing, adjoint_error
from .ms_operators import BatchedSpectroTemporal, channel_pars
from .solvers import fista, tikhonov, tv_pdhg
from .web_dems import DEMSSettings, DEMSDataset


class InlineAnalysis(AnalysisRequest):
    dataset_id: Literal["inline"] = Field(default="inline", exclude=True)
    blank_windows_s: list[list[FiniteFloat]] = Field(default_factory=list,max_length=16)
    blank_model: Literal["constant","linear"] = "constant"


def blank_background(data, req):
    t=np.asarray(data.time_s); y=np.asarray(data.signal)
    baseline=np.zeros_like(y); mask=np.zeros(len(t),bool)
    valid=np.ones_like(y,bool) if data.valid is None else np.asarray(data.valid)
    for window in req.blank_windows_s:
        if len(window)!=2 or not t[0]<=window[0]<window[1]<=t[-1]:
            raise ValueError("空白窗口需要数据范围内的起止时间")
        mask|=(t>=window[0])&(t<=window[1])
    if not req.blank_windows_s:
        return baseline,{"applied":False}
    u=(t-t[0])/(t[-1]-t[0])
    basis=np.stack([np.ones(len(t)),u],axis=1) if req.blank_model=="linear" else np.ones((len(t),1))
    counts=[]
    for channel in range(len(data.mz)):
        keep=mask&valid[channel]
        if np.count_nonzero(keep)<basis.shape[1]+1:
            raise ValueError("每个 m/z 通道的空白窗口需要足够的有效点")
        beta,_,rank,_=np.linalg.lstsq(basis[keep],y[channel,keep],rcond=None)
        if rank<basis.shape[1]:raise ValueError("空白窗口不能唯一确定背景模型")
        baseline[channel]=basis@beta;counts.append(int(keep.sum()))
    return baseline,{"applied":True,"windows_s":req.blank_windows_s,"model":req.blank_model,"valid_points_per_channel":counts,
                     "scope":"blank-only fit; signed residuals retained; original observations preserved"}


class WebMSProject(Contract):
    schema_version: Literal["web-ms-1.0"] = "web-ms-1.0"
    dataset: DEMSDataset
    analysis: InlineAnalysis
    dems: DEMSSettings | None = None

    @field_validator("dataset", mode="before")
    @classmethod
    def accept_base_dataset(cls, value):
        return value.model_dump() if isinstance(value, MSDataset) else value

    @property
    def method(self):
        return self.analysis.method

    @model_validator(mode="after")
    def rows_follow_channels(self):
        if len(self.analysis.response) != len(self.dataset.mz):
            raise ValueError("响应矩阵的行数必须与数据的 m/z 通道数一致，并保持同一顺序")
        return self


def dataset_summary(data):
    dt = np.diff(data.time_s)
    warnings = []
    uniform = bool(np.allclose(dt, np.median(dt), rtol=1e-6, atol=1e-12))
    if not uniform:
        warnings.append("时间网格不均匀；未自动重采样，时域传输反演不可直接使用 FFT。")
    if data.channel_offsets_s and any(v != 0 for v in data.channel_offsets_s):
        warnings.append("通道采集存在时间偏移；本接口不进行隐式时间对齐。")
    valid = np.ones_like(data.signal, bool) if data.valid is None else np.asarray(data.valid)
    return {"channels":len(data.mz), "samples":len(data.time_s), "mz":data.mz,
            "signal_unit":data.signal_unit, "uniform_time":uniform,
            "dt_s":float(np.median(dt)), "time_range_s":[data.time_s[0], data.time_s[-1]],
            "valid_fraction":float(valid.mean()), "has_ec":data.ec_time_s is not None,
            "has_current":data.current_A is not None, "has_potential":data.potential_V is not None,
            "has_pressure":data.pressure is not None, "warnings":warnings}


def execute_ms(project, cancel=None, callback=None):
    data, req = project.dataset, project.analysis
    summary = dataset_summary(data)
    if data.channel_offsets_s and any(v != 0 for v in data.channel_offsets_s):
        raise ValueError("顺序扫描通道存在时间偏移，需要显式采集时间算子，不能视为同步 DEMS 数据")
    channels, samples = len(data.mz), len(data.time_s)
    if channels*samples + len(req.species)*samples > 2_000_000:
        raise ValueError("DEMS 分析超过当前数组大小限制")
    if req.model == "spectrotemporal":
        if not summary["uniform_time"]:
            raise ValueError("传输反卷积需要均匀时间网格；原始时间已保留，请显式处理不均匀采样")
        volume = summary["dt_s"] if req.kernel_convention == "density" else 1.
        operator = BatchedSpectroTemporal(req.response, req.kernels, samples, sample_volume=volume)
    else:
        volume = 1.
        operator = Mixing(req.response, samples)
    weights = np.ones((channels,samples))
    if req.noise_std is not None:
        weights /= np.asarray(req.noise_std)[:,None]
    if data.valid is not None:
        weights *= np.asarray(data.valid)
    raw_observed = np.asarray(data.signal)
    background,blank_info=blank_background(data,req)
    observed = raw_observed-background
    common = dict(nonnegative=req.nonnegative, max_iter=req.max_iter, tol=req.tol, cancel=cancel, callback=callback)
    if req.method == "tikhonov":
        fit = tikhonov(operator, observed, alpha=req.l2, order=req.order, weights=weights, **common)
    elif req.method == "tv":
        fit = tv_pdhg(operator, observed, alpha=req.tv_weight, l2=req.l2, weights=weights, **common)
    elif req.method == "channel_pars":
        u = (np.asarray(data.time_s)-data.time_s[0])/(data.time_s[-1]-data.time_s[0])
        basis = np.stack([u**i for i in range(req.background_degree+1)], axis=1)
        fit = channel_pars(operator, observed, basis, weights=weights, l2=req.l2, l1=req.l1, order=req.order, **common)
    else:
        fit = fista(operator, observed, weights=weights, l2=req.l2, l1=req.l1, order=req.order,
                    loss=req.loss, huber_delta=req.huber_delta, **common)
    diagnostic = response_diagnostics(req.response)
    fit.diagnostics.update({"response":diagnostic, "adjoint_relative_error":adjoint_error(operator),
        "blank_correction":blank_info,
        "weighted_residual_rms":float(np.sqrt(np.sum((weights*fit.residual)**2)/np.count_nonzero(weights))),
        "valid_observations":int(np.count_nonzero(weights)),
        "per_channel_rmse":[float(np.sqrt(np.mean(r[w>0]**2))) for r,w in zip(fit.residual,weights)]})
    fit.warnings.extend(summary["warnings"])
    if not diagnostic["full_column_rank"] or diagnostic["near_collinear_pairs"]:
        fit.warnings.append("响应列秩不足或高度相似；当前组分分离依赖给定模型，不能据此确认化合物身份。")
    if req.model == "spectral":
        fit.warnings.append("当前为谱分离，未校正传输响应；输出仍包含仪器传输滤波。")
    else:
        masses = [float(sum(k)*volume) for k in req.kernels]
        fit.diagnostics["kernel_mass"] = masses
        if not np.allclose(masses,1.,rtol=.01,atol=1e-8):
            fit.warnings.append("给定核的积分不为 1；已保留原始尺度，未进行隐式归一化。")
    references = data.metadata.get("spectrum_references", [])
    if references:
        fit.warnings.append("NIST EI 相对谱仅用于候选碎片响应；未进行本机绝对灵敏度标定。")
    fit.predicted += background
    out = fit.to_dict()
    if blank_info["applied"]:out["background"]=background.tolist()
    out.update({"species":req.species, "mz":data.mz, "time_s":data.time_s,
        "signal_unit":data.signal_unit, "estimate_unit":data.signal_unit+"（响应列等效）",
        "science_status":"numerical_fit_converged" if fit.converged else "numerical_fit_not_converged",
        "quantification_status":"requires_external_instrument_calibration",
        "audit":{"software":"convolvex-ms-1.1.0", "source":"DEMS / MS", "synthetic":data.synthetic,
                 "raw_ec_preserved":True, "time_unit":"s", "signal_unit":data.signal_unit,
                 "model":req.model, "spectrum_references":references}})
    return out


def ms_demo():
    import json
    from pathlib import Path
    from .physics import gamma_response
    spectra=json.loads((Path(__file__).parent/'data/dems_demo_spectra.json').read_text(encoding='utf-8'))['spectra']
    t=np.arange(400)*.5; potential=.2-.005*t; masses=[2,16,28,44]
    response=response_from_spectra(masses,spectra)
    h2=1.5e-9/(1+np.exp((potential+.55)/.045))
    co=1.0e-9/(1+np.exp((potential+.35)/.05))
    co2=np.full(len(t),.45e-9)
    source=np.stack([h2,co,co2]);kernels=[]
    for scale in [1.2,1.6,1.4]:
        k=gamma_response(np.arange(50)*.5,shape=2,scale=scale);k/=sum(k)*.5;kernels.append(k.tolist())
    operator=BatchedSpectroTemporal(response['response'],kernels,len(t),sample_volume=.5)
    observed=operator.forward(source)+np.random.default_rng(7).normal(0,2e-12,(len(masses),len(t)))
    data=DEMSDataset(time_s=t.tolist(),mz=masses,signal=observed.tolist(),signal_unit='A',
        time_origin='synthetic shared zero',synthetic=True,instrument_id='simulation',ec_time_s=t.tolist(),
        potential_V=potential.tolist(),current_A=(-.0001-1e6*(2*h2+co)).tolist(),
        metadata={'name':'DEMS–LSV synthetic mixture','potential_reference':'synthetic reference',
            'response_source':'public NIST EI reference snapshots; simulated signal, transport and LSV; no instrument calibration',
            'spectrum_references':response['references'],'ec_time_source':'synthetic recorded time'})
    analysis=InlineAnalysis(response=response['response'],species=response['species'],kernels=kernels,
        kernel_convention='density',l2=.002,l1=0,max_iter=1800)
    return {'project':WebMSProject(dataset=data,analysis=analysis).model_dump(),'truth':source.tolist(),'summary':dataset_summary(data)}


def response_from_spectra(mz, spectra):
    if not 1 <= len(mz) <= 128 or not 1 <= len(spectra) <= 32:
        raise ValueError("需要 1–128 个通道、1–32 个候选组分")
    columns, species, references = [], [], []
    for spectrum in spectra:
        masses, intensity = np.asarray(spectrum["mz"],float), np.asarray(spectrum["intensity"],float)
        if masses.ndim != 1 or len(masses) != len(intensity) or not len(masses) or len(masses)>50000 or not np.all(np.isfinite(masses)) or not np.all(np.isfinite(intensity)) or np.any(intensity<0):
            raise ValueError("候选图谱的 m/z 和强度格式无效")
        values = np.array([float(intensity[np.abs(masses-m)<=.25].sum()) for m in mz])
        if values.max() <= 0:
            raise ValueError(str(spectrum.get("name","候选物质"))+" 在当前监测通道中没有匹配峰")
        name=str(spectrum.get("display_name") or spectrum.get("name") or '').strip()
        if not name or len(name)>96:
            raise ValueError("标准谱需要明确的组分名称（不超过 96 字符）")
        species.append(name)
        reference = int(np.argmax(values))
        columns.append(values/values.max())
        references.append({k:spectrum.get(k) for k in ["name","cas","source","source_url","record_id"]})
        references[-1].update({"reference_mz":mz[reference], "mass_tolerance":.25, "scaling":"maximum selected-channel response = 1"})
        references[-1]['display_name']=name
    if len(set(species)) != len(species):
        raise ValueError("候选组分不能重复添加")
    response = np.stack(columns,axis=1).tolist()
    return {"response":response, "species":species, "references":references, "diagnostics":response_diagnostics(response)}
