import numpy as np
import pytest
from convolvex.pipeline import demo,Problem,execute
from convolvex.operators import Identity
from convolvex.inference import pars

def test_volume_workflow():
    d=demo("volume"); p=Problem(**d["problem"]); p.parameters["max_iter"]=60
    r=execute(p); assert np.shape(r["estimate"])==(24,24,24)
    assert np.isfinite(r["objective"]) and r["audit"]["adjoint_relative_error"]<1e-12

def test_pars_rejects_huber():
    with pytest.raises(ValueError,match="Gaussian"):
        pars(Identity((10,)),np.ones(10),np.ones((10,1)),loss="huber")

def test_complex_data_rejected():
    with pytest.raises(ValueError):
        Identity((2,)).forward(np.array([1+1j,2]))


def test_sparse_complex_rejected():
    from scipy import sparse
    from convolvex.operators import Matrix
    with pytest.raises(ValueError, match="complex"):
        Matrix(sparse.csr_matrix([[1+1j, 0], [0, 1]]))
