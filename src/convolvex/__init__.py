"""Convolvex: explicit operators, auditable inverse problems."""
__version__="1.1.0"
from .operators import (Operator,Convolution,Matrix,Mixing,SpectroTemporal,Sampling,
                        Diagonal,Identity,Gradient,Laplacian,NonuniformConvolution,adjoint_error)
from .solvers import solve,tikhonov,fista,tv_pdhg,richardson_lucy,wiener,Result
from .inference import pars,estimate_kernel,blind_deconvolution,gcv,bootstrap,identifiability

from .ms_operators import BatchedSpectroTemporal, ChannelProjected, channel_pars
