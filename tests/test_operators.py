import numpy as np
import pytest
from scipy import signal,sparse
from convolvex import *
from convolvex.operators import KernelOperator
from convolvex.native import available

@pytest.mark.parametrize('shape,kshape', [((17,),(4,)),((9,11),(3,4)),((5,7,6),(2,3,2))])
@pytest.mark.parametrize('mode',['full','same','valid','causal','circular'])
def test_nd_adjoint(shape,kshape,mode):
    rng=np.random.default_rng(3);h=rng.normal(size=kshape);A=Convolution(h,shape,mode)
    assert adjoint_error(A)<3e-12
    x=rng.normal(size=shape)
    if mode in {'full','same','valid'}: np.testing.assert_allclose(A.forward(x),signal.convolve(x,h,mode,method='direct'),atol=2e-12)
    if mode=='causal': np.testing.assert_allclose(A.forward(x),signal.convolve(x,h,'full')[tuple(slice(0,n) for n in shape)],atol=2e-12)

@pytest.mark.parametrize('shape,kshape',[((1,),(3,)),((9,),(4,)),((9,11),(3,4)),((5,7,6),(2,3,2))])
def test_reflect(shape,kshape):
    rng=np.random.default_rng(9);A=Convolution(rng.normal(size=kshape),shape,'same','reflect')
    assert adjoint_error(A)<1e-12
    np.testing.assert_allclose(A.matrix().T@np.ones(A.shape[0]),A.adjoint(np.ones(A.output_shape)).ravel(),atol=2e-12)

@pytest.mark.parametrize('engine',['direct','fft','overlap_add','auto','cpp'])
@pytest.mark.parametrize('mode',['full','same','valid','causal'])
def test_engines(engine,mode):
    if engine=='cpp' and not available(): pytest.skip('native not compiled')
    h=np.array([.1,.3,-.2,.8]);x=np.arange(40.)
    A=Convolution(h,x.size,mode,engine=engine)
    np.testing.assert_allclose(A.forward(x),Convolution(h,x.size,mode).forward(x),atol=1e-12)
    assert adjoint_error(A)<1e-12

@pytest.mark.parametrize('shape',[(8,),(5,6),(4,3,5)])
def test_differences(shape):
    for D in (Gradient(shape),Laplacian(shape)):
        assert adjoint_error(D)<1e-12
        np.testing.assert_allclose(D.forward(np.ones(shape)),0,atol=1e-14)

def test_mixing_composition_sparse_sampling():
    S=np.array([[1,.2],[.1,1],[.3,.4]])
    for A in [Matrix(S),Matrix(sparse.csr_matrix(S)),Mixing(S,21),
              SpectroTemporal(S,[[.6,.4],[.3,.5,.2]],21),Sampling((9,),[2,2,5,8]),
              Matrix(S)@Diagonal([2.,3.])]:
        assert adjoint_error(A)<1e-12
    A=Mixing(S,21);D=Gradient(A.input_shape,A.regularization_axes)
    x=np.stack([np.ones(21),np.ones(21)*5]); assert np.all(D.forward(x)==0)

def test_nonuniform():
    t=np.array([0,.3,.7,1.4,2]);u=np.linspace(0,2.5,11)
    A=NonuniformConvolution(t,u,[0,1,2],[1,.5,0])
    assert adjoint_error(A)<1e-12
    assert A.quadrature_weights.sum()==pytest.approx(2)

@pytest.mark.parametrize('mode',['full','same','causal','valid'])
def test_kernel_operator(mode):
    A=KernelOperator(np.arange(10.),(4,),mode)
    assert adjoint_error(A)<1e-12
    h=np.array([.1,.4,.3,.2]);np.testing.assert_allclose(A.forward(h),Convolution(h,10,mode).forward(np.arange(10.)),atol=1e-12)

@pytest.mark.parametrize('make',[lambda:Convolution([1,np.nan],5),lambda:Convolution([1],0),
    lambda:Convolution([1],(5,4)),lambda:Convolution([1,2,3],2,'valid'),
    lambda:Convolution([1],8,'full','reflect'),lambda:Convolution([1+2j],5),
    lambda:Sampling(5,[1.5]),lambda:Diagonal([np.inf]),lambda:NonuniformConvolution([0,0],[0,1],[0,1],[1,0])])
def test_invalid_inputs(make):
    with pytest.raises((ValueError,TypeError)):make()

def test_scale_and_matrix_guard():
    a=Convolution([1,2],5,sample_volume=.2); b=Convolution([1,2],5)
    np.testing.assert_allclose(a.forward(np.ones(5)),.2*b.forward(np.ones(5)))
    with pytest.raises(ValueError):b.matrix(max_elements=5)
