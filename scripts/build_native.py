"""Build portable native kernels with an installed C++17 compiler."""
from pathlib import Path
import os, subprocess, sys, json
root=Path(__file__).resolve().parents[1]
out=root/"src/convolvex/_native"; out.mkdir(exist_ok=True)
compiler=os.environ.get("CXX","g++")
if sys.platform=="win32":
    filename="convolvex_native.dll"; flags=["-shared"] # MinGW; MSVC uses a separate toolchain.
elif sys.platform=="darwin":
    filename="libconvolvex_native.dylib"; flags=["-dynamiclib","-fPIC"]
else:
    filename="libconvolvex_native.so"; flags=["-shared","-fPIC"]
cmd=[compiler,"-O3","-std=c++17",*flags,str(root/"cpp/kernels.cpp"),"-o",str(out/filename)]
subprocess.run(cmd,check=True)
(root/"benchmarks/native_build.json").write_text(json.dumps({"command":cmd,"compiler":subprocess.check_output([compiler,"--version"],text=True).splitlines()[0]},indent=2))
print(out/filename)
