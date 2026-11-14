"""DEMS time/potential lookup, explicit Tafel regression and calibrated charge.

No molecular assignment from a lone mass channel, implicit time alignment,
automatic kinetic-region selection, or invented calibration is performed.
"""
from typing import Literal
import numpy as np
from pydantic import Field, FiniteFloat, model_validator
from .massspec import Contract, MSDataset, response_diagnostics
from .physics import FARADAY, integrate_current
from .web_lsv import lsv_report


class DEMSDataset(MSDataset):
    potential_V: list[FiniteFloat] | None = None


class SpeciesCalibration(Contract):
    species: str = Field(min_length=1, max_length=96)
    record_id: str = Field(min_length=1, max_length=128)
    sensitivity_C_per_mol: FiniteFloat = Field(gt=0)
    electrons: int = Field(ge=1, le=64, strict=True)
    reference_mz: FiniteFloat = Field(gt=0)
    instrument_id: str = Field(min_length=1, max_length=128)
    conditions_id: str = Field(min_length=1, max_length=128)
    includes_collection: bool = False
    confirmed: bool = False
    synthetic: bool = False
    # Direct numerical context keeps a calibration tied to the response used.
    mz: list[FiniteFloat] = Field(min_length=1, max_length=128)
    response_column: list[FiniteFloat] = Field(min_length=1, max_length=128)
    model: Literal["spectral", "spectrotemporal"]
    kernel: list[FiniteFloat] | None = Field(default=None, max_length=10000)
    kernel_convention: Literal["discrete", "density"] = "discrete"


class DEMSSettings(Contract):
    start_s: FiniteFloat | None = None
    stop_s: FiniteFloat | None = None
    mz: FiniteFloat | None = None
    species_index: int = Field(default=0, ge=0, le=31)
    lookup: Literal["time", "potential", "current"] = "time"
    lookup_value: FiniteFloat | None = None
    lookup_tolerance: FiniteFloat = Field(default=.01, gt=0)
    ec_time_offset_s: FiniteFloat = 0.
    transport_delay_s: FiniteFloat = Field(default=0.,ge=0)
    baseline: FiniteFloat = 0.
    ion_polarity: Literal[1, -1] = 1
    potential_reference: str = Field(default="as imported", max_length=128)
    equilibrium_potential_V: FiniteFloat | None = None
    uncompensated_resistance_ohm: FiniteFloat = Field(default=0., ge=0)
    electrode_area_cm2: FiniteFloat | None = Field(default=None, gt=0)
    tafel_basis: Literal["species", "channel"] = "species"
    tafel_min_V: FiniteFloat | None = None
    tafel_max_V: FiniteFloat | None = None
    tafel_bins: int = Field(default=10, ge=3, le=80)
    steady_state_confirmed: bool = False
    complete_window_confirmed: bool = False
    direction: Literal["cathodic", "anodic"] = "cathodic"
    calibrations: list[SpeciesCalibration] = Field(default_factory=list, max_length=32)


class DEMSProcessRequest(Contract):
    dataset: DEMSDataset | None = None
    job_id: str | None = Field(default=None, pattern=r"^[0-9a-f-]{36}$")
    settings: DEMSSettings = Field(default_factory=DEMSSettings)
    trace_points: int = Field(default=3000, ge=100, le=200000)

    @model_validator(mode="after")
    def has_data(self):
        if self.dataset is None and self.job_id is None:
            raise ValueError("需要 DEMS 数据或已完成的分析记录")
        return self


def _aligned(t, ec_t, values):
    if values is None or ec_t is None:
        return np.full(len(t), np.nan)
    return np.interp(t, ec_t, values, left=np.nan, right=np.nan)


def _nullable(values):
    return [float(v) if np.isfinite(v) else None for v in values]


def _masked_integral(t, y, valid, a, b):
    """Integrate only observed adjacent segments; never bridge a missing scan."""
    left, right = np.maximum(t[:-1], a), np.minimum(t[1:], b)
    keep = (right > left) & valid[:-1] & valid[1:]
    dt = t[1:] - t[:-1]
    ya = y[:-1] + (y[1:]-y[:-1])*(left-t[:-1])/dt
    yb = y[:-1] + (y[1:]-y[:-1])*(right-t[:-1])/dt
    return float(np.sum(((ya+yb)*(right-left)*.5)[keep])), float(np.sum((right-left)[keep])/(b-a))


def _calibration_reason(data, req, fit, s, index, cal):
    if cal is None:
        return "尚未提供所选组分的本机标定"
    if not cal.confirmed or not cal.includes_collection:
        return "需确认标定来自标准实验且包含收集效率"
    if data.signal_unit != "A":
        return "绝对定量要求质谱电流单位为 A"
    if not fit.get("converged"):
        return "求解尚未收敛"
    diag = response_diagnostics(req.response)
    if not diag["full_column_rank"] or diag["near_collinear_pairs"]:
        return "候选响应秩不足或高度相似，不能唯一进行组分定量"
    if cal.synthetic != data.synthetic:
        return "合成与实验标定不能混用"
    if any(getattr(cal, k) != getattr(data, k) or getattr(data, k) == "unspecified" for k in ("instrument_id", "conditions_id")):
        return "标定的仪器或实验条件与数据不一致"
    if cal.mz != data.mz or len(cal.response_column) != len(data.mz) or not np.allclose(cal.response_column, np.asarray(req.response)[:,index], rtol=1e-10, atol=1e-12):
        return "标定的监测通道或响应列与当前分析不一致"
    if cal.model != req.model or cal.kernel_convention != req.kernel_convention or cal.kernel != (req.kernels[index] if req.kernels else None):
        return "标定的传输模型与当前分析不一致"
    if cal.reference_mz not in data.mz or not np.isclose(req.response[data.mz.index(cal.reference_mz)][index], 1., rtol=1e-9, atol=1e-12):
        return "标定参考通道的响应系数须为 1"
    if req.model == "spectrotemporal":
        volume = float(np.median(np.diff(data.time_s))) if req.kernel_convention == "density" else 1.
        if not np.isclose(sum(req.kernels[index])*volume, 1., rtol=.01, atol=1e-8):
            return "定量需要积分为 1 的传输核"
    return None


def _tafel(potential, signal, selected, settings, current_unit, calibrated):
    usable = selected & np.isfinite(potential) & np.isfinite(signal)
    if settings.tafel_min_V is not None:
        usable &= potential >= settings.tafel_min_V
    if settings.tafel_max_V is not None:
        usable &= potential <= settings.tafel_max_V
    if settings.tafel_min_V is not None and settings.tafel_max_V is not None and settings.tafel_min_V >= settings.tafel_max_V:
        return {"available":False, "reason":"Tafel 电位下限须小于上限"}
    e, y = potential[usable], signal[usable]
    if len(e) < 3:
        return {"available":False, "reason":"所选区间需要至少 3 个有电位记录的有效点"}
    # Ignore small acquisition noise while rejecting substantive scan reversals.
    excursion = np.max(np.maximum.accumulate(e)-e) if e[-1]>=e[0] else np.max(e-np.minimum.accumulate(e))
    if excursion > max(.002, .05*float(np.ptp(e))):
        return {"available":False, "reason":"所选区间含往返扫描，请用时间范围选择一个扫描方向"}
    rejected = int(np.count_nonzero(y <= 0))
    e, y = e[y > 0], y[y > 0]
    if len(e) < 3 or np.ptp(e) <= 1e-10:
        return {"available":False, "reason":"需要至少 3 个正信号点且电位有变化；未对负值取绝对值"}
    edges = np.linspace(e.min(), e.max(), settings.tafel_bins+1)
    bins = np.clip(np.searchsorted(edges, e, side="right")-1, 0, settings.tafel_bins-1)
    points = np.array([[float(np.mean(e[bins==i])),float(np.mean(y[bins==i])),int(np.sum(bins==i))]
                       for i in np.unique(bins)])
    x = np.log10(points[:,1]); v = points[:,0]-(settings.equilibrium_potential_V or 0.)
    if len(x) < 3 or np.ptp(x) < 1e-8:
        return {"available":False, "reason":"所选电位区间内正信号的对数跨度不足，无法拟合斜率"}
    # Centering avoids instability for very small ion currents and narrow spans.
    xc, vc = x-x.mean(), v-v.mean()
    slope = float(xc@vc/(xc@xc)); intercept = float(v.mean()-slope*x.mean())
    predicted = intercept+slope*x
    sse = float(np.sum((v-predicted)**2)); total = float(vc@vc)
    warnings = []
    if rejected:
        warnings.append(f"已排除 {rejected} 个非正信号点，未进行对数截断")
    if np.ptp(x) < 1:
        warnings.append("电流跨度不足一个数量级，斜率的适用范围较窄")
    qualified = calibrated and settings.steady_state_confirmed
    if not settings.steady_state_confirmed:
        warnings.append("未确认稳态与动力学控制区间，结果为表观斜率")
    if not calibrated:
        warnings.append("未标定：这是信号–电位斜率，不是已确认的产物分电流 Tafel 斜率")
    return {"available":True, "kind":"product_tafel" if qualified else "signal_potential_slope",
            "slope_mV_dec":slope*1000, "absolute_slope_mV_dec":abs(slope)*1000,
            "standard_error_mV_dec":float(np.sqrt(sse/(len(x)-2)/(xc@xc))*1000),
            "intercept_V":intercept, "r_squared":1-sse/total if total>0 else None,
            "log_current":x.tolist(), "potential_V":v.tolist(), "fitted_V":predicted.tolist(),
            "bin_samples":points[:,2].astype(int).tolist(), "points":len(x), "excluded_nonpositive":rejected,
            "current_unit":current_unit, "potential_axis":"overpotential" if settings.equilibrium_potential_V is not None else "potential",
            "potential_reference":settings.potential_reference, "warnings":warnings}


def process_dems(data, settings, req=None, fit=None, trace_points=3000):
    s = settings; t = np.asarray(data.time_s); y = np.asarray(data.signal)
    a = float(t[0] if s.start_s is None else s.start_s)
    b = float(t[-1] if s.stop_s is None else s.stop_s)
    if not t[0] <= a < b <= t[-1]:
        raise ValueError("起止时间必须位于质谱数据范围内，且起点小于终点")
    if data.channel_offsets_s and any(v != 0 for v in data.channel_offsets_s):
        raise ValueError("通道存在采集时间偏移，请先提供显式同步数据")
    mass = data.mz[0] if s.mz is None else s.mz
    if mass not in data.mz:
        raise ValueError("所选 m/z 不在监测通道中")
    ch = data.mz.index(mass)
    valid = np.ones_like(y, bool) if data.valid is None else np.asarray(data.valid)
    selected = (t>=a)&(t<=b)
    ec_t = None if data.ec_time_s is None else np.asarray(data.ec_time_s)+s.ec_time_offset_s
    delay = 0. if req is not None and req.model=='spectrotemporal' else s.transport_delay_s
    electrode_t=t-delay
    e = _aligned(electrode_t, ec_t, data.potential_V)
    current = _aligned(electrode_t, ec_t, data.current_A)
    if s.uncompensated_resistance_ohm and data.current_A is None:
        raise ValueError("iR 校正需要原始电化学电流")
    corrected_e = e-current*s.uncompensated_resistance_ohm if s.uncompensated_resistance_ohm else e.copy()
    background=np.zeros_like(y) if fit is None or fit.get('background') is None else np.asarray(fit['background'])
    if background.shape!=y.shape:raise ValueError("背景数组与当前质谱数据尺寸不一致")
    signal = (y[ch]-background[ch]-s.baseline)*s.ion_polarity
    integral, coverage = _masked_integral(t, signal, valid[ch], a, b)
    mask = selected & valid[ch]
    slope = None
    if np.count_nonzero(mask) >= 2:
        tx = t[mask]-t[mask].mean(); sy = signal[mask]
        slope = float(tx@(sy-sy.mean())/(tx@tx))
    warnings = []
    if s.transport_delay_s and delay==0:
        warnings.append("谱–时间联合反演已处理传输响应，未再次施加纯延迟校正")
    if coverage < 1-1e-9:
        warnings.append("积分包含缺测间隙；仅累计两端均有效的相邻线段")
    if s.baseline:
        warnings.append("基线数值应用于通道及所选组分；请确保二者使用同一参考通道尺度")
    if req and req.model == "spectral":
        warnings.append("谱分离保留传输延迟；瞬时电位关联需要已知延迟或稳态区间")
    charge = {"available":False, "reason":"未导入电化学电流"}
    if data.current_A is not None:
        if ec_t[0] <= a-delay < b-delay <= ec_t[-1]:
            charge = {"available":True, **integrate_current(ec_t, data.current_A, a-delay, b-delay),
                      "meaning":"原始电化学总电荷，可能包含电容电流", "grid":"raw EC"}
        else:
            charge = {"available":False, "reason":"积分区间超出原始电化学时间范围；未外推"}
    lookup_mask = mask.copy()
    value = s.lookup_value
    if s.lookup == "time":
        value = (a+b)/2 if value is None else value
        if not a <= value <= b:
            raise ValueError("查询时间须位于所选时间区间内")
        indexes = np.flatnonzero(lookup_mask)
        lookup_mask[:] = False
        if len(indexes):
            lookup_mask[indexes[np.argmin(abs(t[indexes]-value))]] = True
    else:
        if value is None:
            raise ValueError("请输入目标电位或目标电化学电流")
        coordinate = corrected_e if s.lookup == "potential" else current
        lookup_mask &= np.isfinite(coordinate) & (np.abs(coordinate-value)<=s.lookup_tolerance)
    indices = np.flatnonzero(lookup_mask)
    groups = np.split(indices, np.where(np.diff(indices)>1)[0]+1) if len(indices) else []
    segments = [{"start_s":float(t[g[0]]), "stop_s":float(t[g[-1]]), "samples":len(g),
                 "mean_signal":float(signal[g].mean()),
                 "mean_potential_V":float(np.nanmean(corrected_e[g])) if np.isfinite(corrected_e[g]).any() else None,
                 "mean_current_A":float(np.nanmean(current[g])) if np.isfinite(current[g]).any() else None}
                for g in groups]
    contributions = []; selected_source = None; calibration = None; calibration_reason = "请先完成候选组分的谱分离"
    idx = s.species_index
    if req is not None and fit is not None:
        if idx >= len(req.species):
            raise ValueError("所选组分索引超出范围")
        estimate = np.asarray(fit["estimate"])
        if estimate.shape != (len(req.species),len(t)):
            raise ValueError("组分结果与当前数据尺寸不一致")
        for j, name in enumerate(req.species):
            coefficient = req.response[ch][j]
            detected = estimate[j]
            if req.model == "spectrotemporal":
                volume = np.median(np.diff(t)) if req.kernel_convention == "density" else 1.
                detected = np.convolve(estimate[j],req.kernels[j],mode="full")[:len(t)]*volume
            contributions.append({"species":name,"response_coefficient":coefficient,
                "matches_mz":coefficient>0, "source_mean":float(estimate[j,indices].mean()) if len(indices) else None,
                "channel_contribution_mean":float((detected[indices]*coefficient).mean()) if len(indices) else None})
        selected_source = (estimate[idx]-s.baseline)*s.ion_polarity
        calibration = next((c for c in s.calibrations if c.species==req.species[idx]),None)
        calibration_reason = _calibration_reason(data,req,fit,s,idx,calibration)
        warnings.append("m/z 可对应多个候选物质；组分分离依据完整响应矩阵，不能由单峰确认身份")
    quant = {"available":False,"reason":calibration_reason}
    rate = None; partial = None; calibrated = calibration_reason is None
    if calibrated:
        rate = selected_source/calibration.sensitivity_C_per_mol
        partial = calibration.electrons*FARADAY*rate
        reason = None
        if not s.complete_window_confirmed:
            reason = "请确认区间涵盖完整产物响应，或使用已验证的传输校正"
        elif np.any(np.interp(np.r_[a,t[(t>a)&(t<b)],b],t,selected_source)<0):
            reason = "所选组分含负信号，请检查基线；未截断为零"
        elif data.valid is not None and not np.all(valid[:,max(0,np.searchsorted(t,a,side="right")-1):np.searchsorted(t,b,side="left")+1]):
            reason = "所选区间有缺测点，不能将插补组分结果直接作为绝对定量"
        if reason:
            quant = {"available":False,"reason":reason}
        else:
            amount = integrate_current(t,rate,a,b)["net_C"]
            product_charge = calibration.electrons*FARADAY*amount
            denominator = charge.get(s.direction+"_C") if charge["available"] else None
            efficiency = product_charge/denominator if denominator and denominator>0 else None
            quant = {"available":True,"species":req.species[idx],"amount_mol":amount,
                "product_charge_C":product_charge,"faradaic_efficiency":efficiency,
                "denominator_charge_C":denominator,"direction":s.direction,"calibration_id":calibration.record_id,
                "synthetic":data.synthetic, "conditional_on":"user-supplied instrument calibration, response and integration window"}
            if efficiency is not None and efficiency>1:
                warnings.append("FE 大于 100%，请检查标定、背景、电容贡献及积分窗口")
    use_species = s.tafel_basis == "species" and selected_source is not None
    if s.tafel_basis == "species" and selected_source is None:
        warnings.append("尚无组分分离结果，本次表观斜率使用原始 m/z 通道")
    tafel_signal = selected_source if use_species else signal
    tafel_unit = data.signal_unit+" (response equivalent)" if use_species else data.signal_unit
    physical_tafel = use_species and calibrated and (req.model=="spectrotemporal" or s.steady_state_confirmed)
    if physical_tafel and not np.all(valid[:,selected]):
        physical_tafel = False
        warnings.append("所选区间有缺测通道，Tafel 仅显示信号表观斜率")
    if physical_tafel:
        tafel_signal = partial/(s.electrode_area_cm2 or 1.)
        tafel_unit = "A/cm²" if s.electrode_area_cm2 else "A"
    tafel = _tafel(corrected_e, tafel_signal, mask, s, tafel_unit, physical_tafel)
    # Limit display payload while retaining full-resolution integration/regression.
    stride = max(1,int(np.ceil(len(t)/trace_points))); take = np.unique(np.r_[np.arange(0,len(t),stride),len(t)-1])
    dynamic_rate=calibrated and req.model=='spectrotemporal'
    lsv=lsv_report(data,s,ec_t,electrode_t,corrected_e,current,selected_source,partial,
        dynamic_rate or calibrated and s.steady_state_confirmed,selected,np.all(valid,axis=0),a,b,delay,trace_points,dynamic_rate)
    if lsv['available']:
        # All computations use the full arrays; only display arrays are sampled.
        for key in ('product_current_A','product_current_density_A_cm2','instantaneous_FE','electrode_time_s','potential_V','current_A','source_signal'):
            if lsv[key] is not None:lsv[key]=[lsv[key][i] for i in take]
    return {"interval_s":[a,b], "mz":mass, "synthetic":data.synthetic,
        "selected_species":None if req is None else req.species[idx],"lsv":lsv,
        "signal":{"integral":integral,"integral_unit":"C (ion detector)" if data.signal_unit=="A" else data.signal_unit+"·s",
                  "coverage_fraction":coverage,"slope_per_s":slope,"slope_unit":data.signal_unit+"/s"},
        "lookup":{"mode":s.lookup,"target":value,"matches":len(indices),"segments":segments,
                  "meaning":"nearest recorded MS sample" if s.lookup=="time" else "all matching runs; repeated potentials remain separate"},
        "components":contributions,"electrochemistry_charge":charge,"quantification":quant,"tafel":tafel,
        "trace":{"stride":stride,"time_s":t[take].tolist(),"electrode_time_s":electrode_t[take].tolist(),
                 "raw_signal":y[ch,take].tolist(),"background":background[ch,take].tolist(),
                 "potential_V":_nullable(corrected_e[take]),"current_A":_nullable(current[take]),
                 "signal":_nullable(np.where(valid[ch],signal,np.nan)[take]),"source":None if selected_source is None else _nullable(selected_source[take]),
                 "rate_mol_s":None if rate is None else _nullable(rate[take]),
                 "rate_scope":None if rate is None else "transport_corrected_source" if req.model=="spectrotemporal" else "transport_filtered",
                 "signal_unit":data.signal_unit},
        "alignment":{"method":"linear interpolation for display/query within EC support only", "ec_time_offset_s":s.ec_time_offset_s,
                     "transport_delay_applied_s":delay,"electrode_time_definition":"t_MS - transport_delay", "raw_ec_preserved":True},
        "warnings":warnings}
