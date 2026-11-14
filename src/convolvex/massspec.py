"""Validated mass-spectrometry contracts and deterministic scientific workflow.

All plots, observations, fitted components and calibrated rates have distinct
units. Strings and file contents are untrusted data, never executable prompts.
"""
from __future__ import annotations
from typing import Any, Literal
import hashlib, json, platform
import numpy as np
import scipy
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator
from .operators import Mixing, Convolution, array, adjoint_error
from .ms_operators import BatchedSpectroTemporal, channel_pars
from .solvers import fista, tikhonov, tv_pdhg
from .physics import integrate_current, FARADAY

MAX_DATA_VALUES = 1_000_000


def digest(value) -> str:
    if isinstance(value, np.ndarray):
        value = value.tolist()
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                    ensure_ascii=False, allow_nan=False).encode()).hexdigest()


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class MSDataset(Contract):
    schema_version: Literal["ms-1.0"] = "ms-1.0"
    time_s: list[FiniteFloat] = Field(min_length=2, max_length=200_000)
    mz: list[FiniteFloat] = Field(min_length=1, max_length=128)
    signal: list[list[FiniteFloat]] = Field(min_length=1, max_length=128)
    signal_unit: Literal["A", "a.u.", "counts", "Pa", "mbar"]
    time_origin: str = Field(min_length=1, max_length=256)
    valid: list[list[bool]] | None = None
    pressure: list[FiniteFloat] | None = None
    pressure_unit: Literal["Pa", "mbar", "a.u."] | None = None
    ec_time_s: list[FiniteFloat] | None = None
    current_A: list[FiniteFloat] | None = None
    channel_offsets_s: list[FiniteFloat] | None = None
    instrument_id: str = Field(default="unspecified", max_length=128)
    conditions_id: str = Field(default="unspecified", max_length=128)
    synthetic: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_data(self):
        n, c = len(self.time_s), len(self.mz)
        if n*c > MAX_DATA_VALUES:
            raise ValueError("dataset exceeds one million measurements")
        if len(self.signal) != c or any(len(row) != n for row in self.signal):
            raise ValueError("signal must have shape (m/z channels, time samples)")
        if any(v <= 0 for v in self.mz) or len(set(self.mz)) != c:
            raise ValueError("m/z must be positive and unique; unresolved channels must not be duplicated")
        if np.any(np.diff(self.time_s) <= 0):
            raise ValueError("time_s must be strictly increasing; duplicate scans require an explicit repair")
        if self.valid is not None:
            if np.shape(self.valid) != (c, n) or not np.any(self.valid):
                raise ValueError("valid mask shape mismatch or no valid observations")
            if not np.all(np.any(self.valid, axis=1)):
                raise ValueError("every channel needs at least one valid observation")
        if self.pressure is not None and (len(self.pressure) != n or self.pressure_unit is None):
            raise ValueError("pressure requires matching length and an explicit unit")
        if self.pressure is None and self.pressure_unit is not None:
            raise ValueError("pressure_unit without pressure")
        if (self.ec_time_s is None) != (self.current_A is None):
            raise ValueError("EC time and current must be supplied together")
        if self.ec_time_s is not None:
            if len(self.ec_time_s)<2 or len(self.ec_time_s)!=len(self.current_A) or np.any(np.diff(self.ec_time_s)<=0):
                raise ValueError("EC time/current must be paired, strictly increasing, and on the declared common time origin")
            if len(self.ec_time_s)>200_000:
                raise ValueError("EC array exceeds limit")
        if self.channel_offsets_s is not None and len(self.channel_offsets_s) != c:
            raise ValueError("one acquisition offset per channel required")
        if len(json.dumps(self.metadata, allow_nan=False)) > 8192:
            raise ValueError("metadata exceeds 8 KiB; store large metadata outside the model context")
        return self


class AnalysisRequest(Contract):
    dataset_id: str = Field(pattern=r"^[0-9a-f]{64}$")
    response: list[list[FiniteFloat]] = Field(min_length=1, max_length=128)
    species: list[str] = Field(min_length=1, max_length=32)
    model: Literal["spectral", "spectrotemporal"] = "spectrotemporal"
    kernels: list[list[FiniteFloat]] | None = None
    kernel_convention: Literal["discrete", "density"] = "discrete"
    method: Literal["fista", "tikhonov", "tv", "channel_pars"] = "fista"
    l2: FiniteFloat = Field(default=.003, ge=0)
    l1: FiniteFloat = Field(default=0., ge=0)
    tv_weight: FiniteFloat = Field(default=.01, ge=0)
    order: Literal[0, 1, 2] = 1
    nonnegative: bool = True
    loss: Literal["gaussian", "huber"] = "gaussian"
    huber_delta: FiniteFloat = Field(default=1., gt=0)
    noise_std: list[FiniteFloat] | None = None
    background_degree: Literal[0, 1] = 1
    max_iter: int = Field(default=1500, ge=1, le=5000)
    tol: FiniteFloat = Field(default=1e-6, ge=1e-12, le=.1)

    @model_validator(mode="after")
    def validate_request(self):
        p = len(self.species)
        if len(set(self.species)) != p or any(not s or len(s)>96 for s in self.species):
            raise ValueError("species labels must be nonempty and unique")
        if any(len(row)!=p for row in self.response) or np.any(np.asarray(self.response)<0):
            raise ValueError("relative response must be a nonnegative channels-by-species matrix")
        if np.any(np.linalg.norm(self.response, axis=0)==0):
            raise ValueError("a zero response column cannot identify a species")
        if self.model=="spectrotemporal":
            if self.kernels is None or len(self.kernels)!=p:
                raise ValueError("one explicit kernel per species is required")
            if any(not k or len(k)>10000 or min(k)<0 or sum(k)<=0 for k in self.kernels):
                raise ValueError("physical response kernels must be nonnegative with positive mass and bounded support")
        elif self.kernels is not None:
            raise ValueError("spectral-only analysis does not use transport kernels")
        if self.noise_std is not None and (len(self.noise_std)!=len(self.response) or min(self.noise_std)<=0):
            raise ValueError("noise_std requires one strictly positive standard deviation per channel")
        if self.method != "fista" and self.loss != "gaussian":
            raise ValueError("Huber is implemented for FISTA only")
        if self.method in {"tikhonov", "tv"} and self.l1:
            raise ValueError("this MS wrapper does not combine l1 with tikhonov/TV; select fista")
        return self


class ProfileRequest(Contract):
    """One mass-axis profile; not an image and not charge-state deconvolution."""
    mz_grid: list[FiniteFloat] = Field(min_length=3, max_length=50_000)
    observed: list[FiniteFloat] = Field(min_length=3, max_length=50_000)
    line_shape: list[FiniteFloat] = Field(min_length=1, max_length=1001)
    signal_unit: Literal["A", "a.u.", "counts"] = "a.u."
    l2: FiniteFloat = Field(default=.001, ge=0)
    l1: FiniteFloat = Field(default=0., ge=0)
    max_iter: int = Field(default=1500, ge=1, le=5000)
    tol: FiniteFloat = Field(default=1e-6, ge=1e-12, le=.1)

    @model_validator(mode="after")
    def validate_profile(self):
        delta = np.diff(self.mz_grid)
        if len(self.mz_grid)!=len(self.observed) or np.any(delta<=0) or not np.allclose(delta, delta[0], rtol=1e-6, atol=1e-12):
            raise ValueError("mass-profile convolution requires a uniform, increasing m/z grid")
        if len(self.line_shape)%2!=1:
            raise ValueError("use odd-length centered line shape to make the zero lag explicit")
        if min(self.line_shape)<0 or not np.isclose(sum(self.line_shape),1.,rtol=1e-6,atol=1e-12):
            raise ValueError("line shape must be supplied as nonnegative unit-sum discrete weights")
        return self


def audit_dataset(data: MSDataset) -> dict:
    t = np.array(data.time_s); y = np.asarray(data.signal); dt = np.diff(t)
    valid = np.ones_like(y, bool) if data.valid is None else np.asarray(data.valid)
    uniform = bool(np.allclose(dt, np.median(dt), rtol=1e-6, atol=1e-12))
    warnings = []
    if not uniform:
        warnings.append("Nonuniform time grid: temporal FFT inverse is blocked; do not silently resample.")
    if data.channel_offsets_s and np.any(np.asarray(data.channel_offsets_s)!=0):
        warnings.append("Sequential channel offsets are nonzero: joint simultaneous-channel fit is blocked in this release.")
    if np.any(y[valid]<0):
        warnings.append("Signed values retained; negative residuals are not clipped and are not Poisson counts.")
    if data.signal_unit!="A":
        warnings.append("Signal is not in amperes; ion-signal calibration cannot produce absolute molar rates.")
    if data.synthetic:
        warnings.append("Synthetic data; not experimental validation or molecular identification.")
    return {"dataset_id": digest(data.model_dump()), "shape": list(y.shape), "mz": data.mz,
            "signal_unit": data.signal_unit, "time_origin": data.time_origin,
            "uniform_time": uniform, "median_dt_s": float(np.median(dt)),
            "dt_range_s": [float(min(dt)), float(max(dt))], "time_range_s": [float(t[0]),float(t[-1])],
            "valid_fraction": float(valid.mean()), "negative_fraction": float(np.mean(y[valid]<0)),
            "channel_min": [float(min(row[mask])) for row,mask in zip(y,valid)],
            "channel_max": [float(max(row[mask])) for row,mask in zip(y,valid)],
            "has_pressure": data.pressure is not None, "has_raw_ec": data.ec_time_s is not None,
            "warnings": warnings, "synthetic": data.synthetic}


def response_diagnostics(response) -> dict:
    S = array(response)
    if S.ndim!=2 or max(S.shape)>128 or np.any(S<0):
        raise ValueError("bounded nonnegative response matrix required")
    norm = np.linalg.norm(S,axis=0)
    if np.any(norm==0):
        raise ValueError("zero response column")
    N = S / norm
    singular = np.linalg.svd(N,compute_uv=False)
    threshold = np.finfo(float).eps * max(S.shape) * singular[0]
    rank = int(np.sum(singular>threshold))
    gram = N.T@N; np.fill_diagonal(gram,0.)
    pairs = [[int(i), int(j), float(gram[i,j])] for i in range(S.shape[1]) for j in range(i+1,S.shape[1]) if gram[i,j]>.995]
    return {"rank":rank, "species":S.shape[1], "channels":S.shape[0],
            "full_column_rank":rank==S.shape[1],
            "normalized_condition":float(singular[0]/singular[-1]) if rank==S.shape[1] else None,
            "normalized_singular_values":singular.tolist(), "column_norms":norm.tolist(),
            "maximum_coherence":float(gram.max()) if gram.size else 0., "near_collinear_pairs":pairs,
            "scope":"spectral matrix only; rank deficiency is a warning, not a complete joint temporal identifiability test"}


def _operator_and_weights(data, req):
    audit = audit_dataset(data)
    c,n = len(data.mz),len(data.time_s)
    if len(req.response)!=c:
        raise ValueError("response rows must follow the dataset m/z order exactly")
    if data.channel_offsets_s and np.any(np.asarray(data.channel_offsets_s)!=0):
        raise ValueError("sequential scan offsets require an explicit acquisition-time operator; not silently aligned")
    if c*n + len(req.species)*n > 2_000_000:
        raise ValueError("MS analysis allocation budget exceeded")
    if req.model=="spectrotemporal":
        if not audit["uniform_time"]:
            raise ValueError("temporal FFT requires uniform time; use explicit nonuniform quadrature via the Python core")
        volume = audit["median_dt_s"] if req.kernel_convention=="density" else 1.
        A = BatchedSpectroTemporal(req.response,req.kernels,n,sample_volume=volume)
    else:
        A = Mixing(req.response,n)
    w = np.ones((c,n)) if req.noise_std is None else np.broadcast_to(1./np.asarray(req.noise_std)[:,None],(c,n)).copy()
    if data.valid is not None:
        w *= np.asarray(data.valid)
    return A,w,audit


def analyze(data: MSDataset, req: AnalysisRequest, cancel=None, callback=None):
    if digest(data.model_dump())!=req.dataset_id:
        raise ValueError("dataset hash does not match request")
    A,w,audit = _operator_and_weights(data,req)
    y = np.array(data.signal)
    common = dict(nonnegative=req.nonnegative, max_iter=req.max_iter,tol=req.tol,cancel=cancel,callback=callback)
    if req.method=="tikhonov":
        fit=tikhonov(A,y,alpha=req.l2,order=req.order,weights=w,**common)
    elif req.method=="tv":
        fit=tv_pdhg(A,y,alpha=req.tv_weight,l2=req.l2,weights=w,**common)
    elif req.method=="channel_pars":
        u=(np.asarray(data.time_s)-data.time_s[0])/(data.time_s[-1]-data.time_s[0])
        B=np.stack([u**i for i in range(req.background_degree+1)],axis=1)
        fit=channel_pars(A,y,B,weights=w,l2=req.l2,l1=req.l1,order=req.order,**common)
    else:
        fit=fista(A,y,weights=w,l2=req.l2,l1=req.l1,order=req.order,loss=req.loss,huber_delta=req.huber_delta,**common)
    diag=response_diagnostics(req.response)
    fit.diagnostics.update({"response":diag,"adjoint_relative_error":adjoint_error(A),
                            "weighted_residual_rms":float(np.sqrt(np.sum((w*fit.residual)**2)/np.count_nonzero(w))),
                            "valid_observations":int(np.count_nonzero(w)),
                            "per_channel_rmse":[float(np.sqrt(np.mean(r[ww>0]**2))) for r,ww in zip(fit.residual,w)]})
    fit.warnings.extend(audit["warnings"])
    if not diag["full_column_rank"] or diag["near_collinear_pairs"]:
        fit.warnings.append("Spectral columns are deficient or highly coherent; recovered components are model-dependent, not confirmed identities.")
    if req.model=="spectral":
        fit.warnings.append("Spectral-only components remain transport-filtered; instantaneous electrode rates are not recovered.")
    if req.model=="spectrotemporal":
        vol=A.sample_volume
        masses=[float(sum(k)*vol) for k in req.kernels]
        fit.diagnostics["kernel_mass"]=masses
        if not np.allclose(masses,1.,rtol=.01,atol=1e-8):
            fit.warnings.append("Kernel integral is not unity; absolute scaling must be explicitly calibrated, not silently normalized.")
    payload=fit.to_dict()
    payload["science_status"]="numerical_fit_converged" if fit.converged else "numerical_fit_not_converged"
    payload["quantification_status"]="not_evaluated_requires_external_calibration"
    payload["estimate_unit"]=data.signal_unit+" (response-column-equivalent)"
    payload["species"]=req.species
    payload["mz"]=data.mz
    payload["audit"]={"software":"convolvex-ms-1.1.0", "dataset_sha256":req.dataset_id,
                       "request_sha256":digest(req.model_dump()), "synthetic":data.synthetic,
                       "python":platform.python_version(), "numpy":np.__version__,"scipy":scipy.__version__,
                       "units":"relative response matrix; no implicit physical calibration",
                       "raw_ec_preserved":True}
    return payload


def analyze_profile(req: ProfileRequest, cancel=None, callback=None):
    A=Convolution(req.line_shape,len(req.observed),mode="same",engine="fft")
    fit=fista(A,req.observed,l2=req.l2,l1=req.l1,order=1,nonnegative=True,
              max_iter=req.max_iter,tol=req.tol,cancel=cancel,callback=callback)
    out=fit.to_dict()
    out.update({"science_status":"numerical_fit_converged" if fit.converged else "numerical_fit_not_converged",
                "quantification_status":"unsupported_for_mass_profile", "estimate_unit":req.signal_unit,
                "audit":{"software":"convolvex-ms-1.1.0","request_sha256":digest(req.model_dump()),
                          "axis":"m/z","uniform_spacing":True,"adjoint_relative_error":adjoint_error(A)}})
    out["warnings"].append("Mass-invariant centered line shape assumed; no charge-state assignment or automatic compound identification.")
    return out


def background_diagnosis(data: MSDataset, targets, references, windows, include_pressure=False, drift=True):
    """Blank-window-only regression; neither a product detector nor pressure calibration."""
    t=np.asarray(data.time_s); y=np.asarray(data.signal)
    if not targets or not references or set(targets)&set(references):
        raise ValueError("targets and references must be nonempty and disjoint")
    try:
        ti=[data.mz.index(m) for m in targets]; ri=[data.mz.index(m) for m in references]
    except ValueError:
        raise ValueError("requested m/z absent from dataset") from None
    if not windows or len(windows)>32:
        raise ValueError("one to 32 explicit blank windows required")
    mask=np.zeros(len(t),bool)
    for a,b in windows:
        if not (np.isfinite([a,b]).all() and t[0]<=a<b<=t[-1]):
            raise ValueError("blank window outside measured support")
        mask|=(t>=a)&(t<=b)
    valid=np.ones_like(y,bool) if data.valid is None else np.asarray(data.valid)
    mask &= np.all(valid[ti+ri],axis=0)
    columns=[np.ones(len(t))]+[y[i] for i in ri]; names=["intercept"]+[f"mz_{m}" for m in references]
    if include_pressure:
        if data.pressure is None:
            raise ValueError("pressure covariate requested but missing")
        columns.append(np.asarray(data.pressure)); names.append("pressure")
    if drift:
        columns.append(t); names.append("time_s")
    B=np.stack(columns,axis=1)
    if mask.sum()<=B.shape[1]+2:
        raise ValueError("insufficient independent blank observations")
    center=B[mask].mean(axis=0); scale=B[mask].std(axis=0); center[0]=0; scale[0]=1
    scale[scale==0]=1
    Z=(B-center)/scale
    beta,_,rank,s=np.linalg.lstsq(Z[mask],y[ti][:,mask].T,rcond=None)
    pred=(Z@beta).T; residual=y[ti]-pred
    coeff=beta/scale[:,None]; coeff[0]-=np.sum(center[:,None]*coeff,axis=0)
    blank_rms=np.sqrt(np.mean(residual[:,mask]**2,axis=1))
    warnings=["Signed residuals preserved. A residual at m/z 45/46 is not a compound identification.",
              "Reference-channel and pressure regression is an empirical blank model, not an instrument calibration."]
    if rank<B.shape[1]:
        warnings.append("Blank design is rank deficient; coefficient interpretation is not unique.")
    # A child dataset retains only analyzed channels, so it cannot silently mix corrected and raw axes.
    child=data.model_dump(); child.update(mz=list(targets),signal=residual.tolist(),
        valid=valid[ti].tolist(),channel_offsets_s=None if data.channel_offsets_s is None else [data.channel_offsets_s[i] for i in ti])
    child["metadata"]={"parent_dataset_sha256":digest(data.model_dump()), "operation":"blank_regression",
                       "targets":targets,"references":references,"windows":windows,
                       "include_pressure":include_pressure,"drift":drift,"signed_residual":True}
    return {"target_mz":targets,"reference_mz":references,"blank_points":int(mask.sum()),"rank":int(rank),
            "predictors":names,"coefficients":coeff.T.tolist(),"blank_rmse":blank_rms.tolist(),
            "predicted_background":pred.tolist(),"signed_residual":residual.tolist(),"blank_mask":mask.tolist(),
            "warnings":warnings},MSDataset(**child)
