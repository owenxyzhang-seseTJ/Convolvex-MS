"""Polarization curves on recorded LSV axes; no implicit dynamic calibration."""
import numpy as np


def lsv_report(data, settings, ec_time, electrode_time, potential, current, source, partial,
               physical_rate, selected, source_valid, start, stop, delay, trace_points, dynamic_rate=False):
    if data.potential_V is None or data.current_A is None:
        return {"available":False,"reason":"联合 LSV 分析需要电位和电化学电流；可导入带时间的 LSV，或提供恒定扫描速率"}
    e=np.asarray(data.potential_V); i=np.asarray(data.current_A)
    corrected=e-i*settings.uncompensated_resistance_ohm
    lo,hi=start-delay,stop-delay
    keep=(ec_time>=lo)&(ec_time<=hi)
    direction='insufficient'; speed=None; linearity=None
    if np.count_nonzero(keep)>=2:
        te=ec_time[keep]; ve=e[keep]; delta=np.diff(ve); dt=np.diff(te)
        span=np.ptp(ve)
        excursion=np.max(np.maximum.accumulate(ve)-ve) if ve[-1]>=ve[0] else np.max(ve-np.minimum.accumulate(ve))
        direction='mixed' if excursion>max(.002,.05*span) else 'increasing' if ve[-1]>ve[0] else 'decreasing' if ve[-1]<ve[0] else 'hold'
        speed=float(np.median(delta/dt)*1000)
        tc=te-te.mean(); slope=float(tc@(ve-ve.mean())/(tc@tc)); residual=ve-(ve.mean()+slope*tc)
        variance=float(np.sum((ve-ve.mean())**2))
        linearity=float(1-np.sum(residual**2)/variance) if variance>0 else None
    stride=max(1,int(np.ceil(len(ec_time)/trace_points)))
    take=np.unique(np.r_[np.arange(0,len(ec_time),stride),len(ec_time)-1])
    area=settings.electrode_area_cm2
    def nullable(v):return [float(x) if np.isfinite(x) else None for x in v]
    signed=None if partial is None else partial*(-1 if settings.direction=='cathodic' else 1)
    efficiency=np.full(len(potential),np.nan)
    if physical_rate and partial is not None:
        denominator=-current if settings.direction=='cathodic' else current
        mask=selected&source_valid&np.isfinite(potential)&np.isfinite(current)&(denominator>1e-15)&(partial>=0)
        efficiency[mask]=partial[mask]/denominator[mask]
    return {"available":True,"direction":direction,"median_scan_rate_mV_s":speed,"linear_scan_r_squared":linearity,
        "time_source":data.metadata.get('ec_time_source','recorded time'),
        "area_cm2":area,"polarization_scope":"transport_corrected" if dynamic_rate else "transport_filtered" if partial is not None else "relative_signal",
        "raw_lsv":{"time_s":ec_time[take].tolist(),"potential_V":e[take].tolist(),"corrected_potential_V":corrected[take].tolist(),
                   "current_A":i[take].tolist(),"current_density_A_cm2":None if area is None else (i[take]/area).tolist()},
        "product_current_A":None if signed is None else nullable(signed),
        "product_current_density_A_cm2":None if signed is None or area is None else nullable(signed/area),
        "instantaneous_FE":nullable(efficiency),"electrode_time_s":electrode_time.tolist(),
        "potential_V":nullable(potential),"current_A":nullable(current),
        "source_signal":None if source is None else nullable(source),
        "interval_electrochemistry_s":[lo,hi],"transport_delay_applied_s":delay}
