#include <cstddef>
#include <algorithm>
// C++17 C ABI. No hidden threads, no fast-math. Output blocking and loop
// interchange expose independent outputs to the compiler's SIMD vectorizer.
// The summation order over kernel taps remains ascending for each output.
#if defined(_MSC_VER)
#define RESTRICT __restrict
#else
#define RESTRICT __restrict__
#endif
extern "C" {
void cvx_convolve_full(const double* RESTRICT x, std::size_t n,
                       const double* RESTRICT h, std::size_t k,
                       double* RESTRICT y) {
    constexpr std::size_t block = 2048;
    const std::size_t m=n+k-1;
    for (std::size_t begin=0; begin<m; begin+=block) {
        const std::size_t end=std::min(begin+block,m);
        std::fill(y+begin,y+end,0.);
        for (std::size_t j=0; j<k; ++j) {
            const std::size_t lo=std::max(begin,j), hi=std::min(end,n+j);
            const double hj=h[j];
            for (std::size_t t=lo; t<hi; ++t) y[t]+=hj*x[t-j];
        }
    }
}
void cvx_correlate_valid(const double* RESTRICT y, std::size_t m,
                         const double* RESTRICT h, std::size_t k,
                         double* RESTRICT x) {
    constexpr std::size_t block=2048;
    const std::size_t n=m-k+1;
    for (std::size_t begin=0; begin<n; begin+=block) {
        const std::size_t end=std::min(begin+block,n);
        std::fill(x+begin,x+end,0.);
        for (std::size_t j=0; j<k; ++j) {
            const double hj=h[j];
            for (std::size_t i=begin; i<end; ++i) x[i]+=hj*y[i+j];
        }
    }
}
}
