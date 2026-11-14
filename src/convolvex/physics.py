"""DEMS utilities with explicit physical units and no implicit calibration."""
from dataclasses import dataclass
import numpy as np
from scipy.special import gammaln
from .operators import array
FARADAY=96485.33212331001 # N_A e, SI exact defining constants


def gamma_response(times,shape=2.,scale=2.,delay=0.):
    t=array(times)-delay
    if not all(np.isfinite(v) for v in (shape,scale,delay)) or shape<1 or scale<=0: raise ValueError("shape>=1, scale>0 required")
    out=np.zeros_like(t); positive=t>0
    out[positive]=np.exp((shape-1)*np.log(t[positive])-t[positive]/scale-gammaln(shape)-shape*np.log(scale))
    if shape==1: out[t==0]=1/scale
    return out


def first_passage_response(times,distance,velocity,diffusivity):
    """1D drift-diffusion first-passage density, not a universal DEMS cell model."""
    if not all(np.isfinite(v) for v in (distance,velocity,diffusivity)) or distance<=0 or diffusivity<=0 or velocity<0:
        raise ValueError("distance,D>0 and velocity>=0 required")
    t=array(times); out=np.zeros_like(t); p=t>0
    out[p]=distance/np.sqrt(4*np.pi*diffusivity*t[p]**3)*np.exp(-(distance-velocity*t[p])**2/(4*diffusivity*t[p]))
    return out


def co2_isotope_ratios(c13=.0107,o17=.00038,o18=.00205):
    if min(c13,o17,o18)<0 or c13>=1 or o17+o18>=1: raise ValueError("invalid abundances")
    c=c13/(1-c13); a=o17/(1-o17-o18); b=o18/(1-o17-o18)
    return {"45/44":c+2*a,"46/44":2*b+a*a+2*c*a,
            "assumption":"nominal singly charged CO2 molecular ions; equal isotope response; no C14; not instrument calibration"}


def integrate_current(times,current,start=None,stop=None):
    """Piecewise-linear integration with exact interval clipping and zero crossings."""
    t=array(times).ravel(); i=array(current).ravel()
    if t.size<2 or t.shape!=i.shape or np.any(np.diff(t)<=0): raise ValueError("strictly increasing paired time/current data required")
    a=t[0] if start is None else float(start); b=t[-1] if stop is None else float(stop)
    if not np.isfinite([a,b]).all() or a<t[0] or b>t[-1] or b<=a: raise ValueError("integration interval must lie within measured support")
    cross=np.where(i[:-1]*i[1:]<0)[0]
    zeros=t[cross]-i[cross]*(t[cross+1]-t[cross])/(i[cross+1]-i[cross])
    grid=np.unique(np.r_[a,t[(t>a)&(t<b)],zeros[(zeros>a)&(zeros<b)],b]); values=np.interp(grid,t,i)
    return {"net_C":float(np.trapezoid(values,grid)),"cathodic_C":float(-np.trapezoid(np.minimum(values,0),grid)),
            "anodic_C":float(np.trapezoid(np.maximum(values,0),grid)),"interval_s":[a,b]}


@dataclass
class Calibration:
    species: str
    sensitivity_C_per_mol: float
    electrons: int
    record_id: str
    includes_collection: bool
    verified: bool
    def validate(self):
        if not self.verified or not self.includes_collection or not self.record_id or not self.species:
            raise ValueError("verified, traceable, effective collection-inclusive calibration is required")
        if not np.isfinite(self.sensitivity_C_per_mol) or self.sensitivity_C_per_mol<=0 or self.electrons<1 or int(self.electrons)!=self.electrons:
            raise ValueError("invalid sensitivity or electron stoichiometry")


def quantify(times,deconvolved_ion_signal_A,calibration:Calibration,denominator_charge_C,complete_window=False):
    """Input is already species separated and transport-corrected, NOT raw m/z."""
    calibration.validate()
    if not complete_window: raise ValueError("complete integration/response window must be explicitly confirmed")
    if not np.isfinite(denominator_charge_C) or denominator_charge_C<=0: raise ValueError("positive Faradaic denominator charge required")
    signal=array(deconvolved_ion_signal_A)
    if np.any(signal<0): raise ValueError("negative species generation: inspect background rather than clipping")
    rate=signal/calibration.sensitivity_C_per_mol
    amount=integrate_current(times,rate)["net_C"] # Numerically an integral; rate units here are mol/s.
    product_charge=calibration.electrons*FARADAY*amount
    return {"rate_mol_s":rate.tolist(),"amount_mol":amount,"product_charge_C":product_charge,
            "faradaic_efficiency":product_charge/denominator_charge_C,
            "calibration_record":calibration.record_id,
            "warnings":[] if product_charge<=denominator_charge_C else ["FE exceeds one; inspect calibration, denominator, background and window."]}


def fit_background(times,channels,basis,background_mask):
    """Fit only explicit blank windows; preserve signed residuals everywhere."""
    t=array(times).ravel(); y=array(channels); B=array(basis); mask=np.asarray(background_mask,dtype=bool)
    if y.shape[0]!=t.size or B.ndim!=2 or B.shape[0]!=t.size or mask.shape!=t.shape:
        raise ValueError("background model shapes disagree")
    if np.count_nonzero(mask)<=B.shape[1]: raise ValueError("insufficient blank observations")
    beta,_,rank,s=np.linalg.lstsq(B[mask],y[mask],rcond=None)
    return {"baseline":B@beta,"residual":y-B@beta,"coefficients":beta,"rank":int(rank),"blank_points":int(mask.sum())}
