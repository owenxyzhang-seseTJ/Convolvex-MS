"""Local-first REST API and scientific UI. Single-process persistent job store.

Numerical tasks run in bounded workers; persistence is atomic JSON plus SQLite.
On restart, unfinished tasks are marked interrupted, never silently resumed.
"""
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import asyncio,hashlib,hmac,json,os,re,sqlite3,threading,time,uuid
from fastapi import FastAPI,HTTPException,Request,Query
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from . import __version__
from .pipeline import Problem,execute,demo
from .native import available as native_available
from .gpu import capability
from .solvers import CancelledError
from .massspec import MSDataset, Contract
from .web_ms import WebMSProject, execute_ms, ms_demo, dataset_summary, response_from_spectra
from .web_import import ImportPayload, preview_import, import_table
from .web_dems import DEMSDataset, DEMSProcessRequest, process_dems
from .nist import lookup_spectrum, parse_jcamp, spectrum_catalog, ALIASES, enrich_spectrum
from pydantic import Field


class SpectrumImport(Contract):
    filename: str = Field(min_length=1,max_length=256)
    text: str = Field(max_length=2_000_000)
    name: str | None = Field(default=None,min_length=1,max_length=96)
    cas: str | None = Field(default=None,max_length=32)
    formula: str | None = Field(default=None,max_length=128)


class SpectrumResponse(Contract):
    mz: list[float] = Field(min_length=1,max_length=128)
    spectra: list[dict] = Field(min_length=1,max_length=32)


def atomic_json(path,value):
    tmp=path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False),encoding="utf-8"); os.replace(tmp,path)


class JobStore:
    def __init__(self,root,workers=2,capacity=8):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.db=self.root/"jobs.sqlite3";self.lock=threading.RLock();self.events={};self.progress={}
        self.pool=ThreadPoolExecutor(max_workers=workers,thread_name_prefix="convolvex")
        self.capacity=capacity
        with self.connection() as con:
            con.execute("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, created REAL, status TEXT, method TEXT, error TEXT)")
            con.execute("UPDATE jobs SET status='interrupted',error='Service restarted before completion' WHERE status IN ('queued','running')")
    def connection(self): return sqlite3.connect(self.db,timeout=10)
    def update(self,id,status,error=None):
        with self.connection() as con: con.execute("UPDATE jobs SET status=?,error=? WHERE id=?",(status,error,id))
    def list(self):
        with self.connection() as con: rows=con.execute("SELECT id,created,status,method,error FROM jobs ORDER BY created DESC LIMIT 100").fetchall()
        return [dict(zip(("id","created","status","method","error"),r)) for r in rows]
    def get(self,id):
        try: uuid.UUID(id)
        except ValueError: raise HTTPException(404,"Unknown job")
        with self.connection() as con: row=con.execute("SELECT id,created,status,method,error FROM jobs WHERE id=?",(id,)).fetchone()
        if row is None: raise HTTPException(404,"Unknown job")
        item=dict(zip(("id","created","status","method","error"),row));item["progress"]=self.progress.get(id)
        return item
    def submit(self,problem):
        with self.lock:
            with self.connection() as con:
                active=con.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]
                if active>=self.capacity: raise HTTPException(429,"Task queue is full")
                id=str(uuid.uuid4());con.execute("INSERT INTO jobs VALUES (?,?,?,?,?)",(id,time.time(),"queued",problem.method,None))
            event=threading.Event();self.events[id]=event
            atomic_json(self.root/(id+".input.json"),problem.model_dump())
            self.pool.submit(self.run,id,problem,event)
        return self.get(id)
    def run(self,id,problem,event):
        try:
            if event.is_set(): raise CancelledError()
            self.update(id,"running")
            execute_problem = execute_ms if isinstance(problem, WebMSProject) else execute
            result=execute_problem(problem,cancel=event.is_set,callback=lambda p:self.progress.__setitem__(id,p))
            if event.is_set(): raise CancelledError()
            atomic_json(self.root/(id+".result.json"),result)
            self.update(id,"completed")
        except CancelledError: self.update(id,"cancelled")
        except Exception as exc: self.update(id,"failed",f"{type(exc).__name__}: {exc}")
        finally:
            with self.lock: self.events.pop(id,None)
    def close(self):
        for e in list(self.events.values()): e.set()
        self.pool.shutdown(wait=True,cancel_futures=False)


def create_app(data_dir=None):
    root=Path(data_dir or os.environ.get("CONVOLVEX_DATA",str(Path.home()/".convolvex")))
    store=JobStore(root)
    @asynccontextmanager
    async def lifespan(app):
        yield
        store.close()
    app=FastAPI(title="Convolvex",version=__version__,lifespan=lifespan)
    app.state.store=store
    token=os.environ.get("CONVOLVEX_TOKEN","")
    @app.middleware("http")
    async def guard(request:Request,call_next):
        # No cross-origin CORS. Bind loopback by default; token needed for shared instances.
        if request.url.path.startswith("/api/") and token:
            given=request.headers.get("authorization","").removeprefix("Bearer ")
            if not hmac.compare_digest(given.encode("utf-8"),token.encode("utf-8")):
                return JSONResponse({"detail":"Authentication required"},401)
        length=request.headers.get("content-length","0")
        try:
            if int(length)>32_000_000: return JSONResponse({"detail":"Request too large"},413)
        except ValueError: return JSONResponse({"detail":"Invalid Content-Length"},400)
        if request.method in {"POST","PUT","PATCH"}:
            data=await request.body()
            if len(data)>32_000_000: return JSONResponse({"detail":"Request too large"},413)
        response=await call_next(request)
        response.headers["X-Content-Type-Options"]="nosniff"
        response.headers["Referrer-Policy"]="no-referrer"
        response.headers["Content-Security-Policy"]="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"
        return response
    @app.get("/api/v1/health")
    def health(): return {"status":"ok","version":__version__}
    @app.get("/api/v1/capabilities")
    def capabilities(): return {"cpp":native_available(),"gpu":capability(),"max_elements":1_000_000,"max_iter":5000,"workers":2,"version":__version__}
    @app.get("/api/v1/demo/{kind}")
    def load_demo(kind:str,seed:int=7):
        try: return demo(kind,seed)
        except ValueError as exc: raise HTTPException(422,str(exc))
    @app.get("/api/v1/ms/demo")
    def load_ms_demo(): return ms_demo()
    @app.post("/api/v1/ms/dataset")
    def inspect_ms_dataset(data:DEMSDataset):
        return {"kind":"dems","dataset":data.model_dump(),"summary":dataset_summary(data)}
    @app.post("/api/v1/ms/process")
    def process_ms(payload:DEMSProcessRequest):
        try:
            data, req, fit = payload.dataset, None, None
            if payload.job_id:
                if store.get(payload.job_id)["status"] != "completed":
                    raise HTTPException(409,"请先完成组分分析")
                document=json.loads((store.root/(payload.job_id+".input.json")).read_text(encoding="utf-8"))
                if document.get("schema_version") != "web-ms-1.0":
                    raise ValueError("请选择原生 DEMS 分析记录")
                project=WebMSProject.model_validate(document)
                req=project.analysis
                if data is not None:
                    for name in ("time_s","mz","signal","signal_unit","valid","channel_offsets_s","time_origin","synthetic"):
                        if getattr(data,name) != getattr(project.dataset,name):
                            raise ValueError("当前质谱数据与分析记录不一致，请重新运行分析")
                else:
                    data=project.dataset
                fit=json.loads((store.root/(payload.job_id+".result.json")).read_text(encoding="utf-8"))
            report=process_dems(data,payload.settings,req,fit,payload.trace_points)
            report["job_id"]=payload.job_id
            return report
        except (ValueError,TypeError,KeyError) as exc:
            raise HTTPException(422,str(exc))
    @app.post("/api/v1/ms/project/validate")
    def validate_ms_project(project:WebMSProject):
        return {"project":project.model_dump(),"summary":dataset_summary(project.dataset)}
    @app.post("/api/v1/import/preview")
    def inspect_import(payload:ImportPayload):
        try: return preview_import(payload)
        except (ValueError,TypeError,KeyError) as exc: raise HTTPException(422,str(exc))
    @app.post("/api/v1/import/data")
    def import_data(payload:ImportPayload):
        try: return import_table(payload)
        except (ValueError,TypeError,KeyError) as exc: raise HTTPException(422,str(exc))
    @app.get("/api/v1/spectra/nist")
    def nist_spectrum(query:str=Query(min_length=1,max_length=120)):
        try:
            resolved=ALIASES.get(query.strip().casefold(),query.strip())
            key="C"+resolved.replace("-","") if re.fullmatch(r"\d{2,7}-\d{2}-\d",resolved) else resolved if re.fullmatch(r"C\d{3,12}",resolved) else None
            cache=root/"nist-spectra"
            if key and (cache/(key+".json")).is_file():
                return enrich_spectrum(json.loads((cache/(key+".json")).read_text(encoding="utf-8")))
            spectrum=lookup_spectrum(query)
            if re.fullmatch(r"C\d{3,12}",spectrum.get("compound_id","")):
                cache.mkdir(exist_ok=True)
                with store.lock:
                    atomic_json(cache/(spectrum["compound_id"]+".json"),spectrum)
            return spectrum
        except LookupError as exc: raise HTTPException(404,str(exc))
        except ConnectionError as exc: raise HTTPException(502,str(exc))
        except ValueError as exc: raise HTTPException(422,str(exc))
    @app.get("/api/v1/spectra/catalog")
    def get_spectrum_catalog(): return spectrum_catalog()
    @app.post("/api/v1/spectra/import")
    def import_spectrum(payload:SpectrumImport):
        try:
            spectrum=parse_jcamp(payload.text,filename=payload.filename)
            if payload.name:spectrum.update(name=payload.name,display_name=payload.name)
            if payload.cas:spectrum['cas']=payload.cas
            if payload.formula:spectrum['formula']=payload.formula
            return enrich_spectrum(spectrum)
        except ValueError as exc: raise HTTPException(422,str(exc))
    @app.post("/api/v1/ms/response")
    def build_response(payload:SpectrumResponse):
        try: return response_from_spectra(payload.mz,payload.spectra)
        except (ValueError,KeyError,TypeError) as exc: raise HTTPException(422,str(exc))
    @app.post("/api/v1/jobs",status_code=202)
    def submit(problem:Problem|WebMSProject): return store.submit(problem)
    @app.get("/api/v1/jobs")
    def list_jobs(): return store.list()
    @app.get("/api/v1/jobs/{id}")
    def get_job(id:str): return store.get(id)
    @app.post("/api/v1/jobs/{id}/cancel")
    def cancel_job(id:str):
        job=store.get(id)
        with store.lock:
            event=store.events.get(id)
            if event is not None: event.set()
        return {"id":id,"cancellation_requested":event is not None,"status":job["status"]}
    @app.get("/api/v1/jobs/{id}/result")
    def result(id:str):
        if store.get(id)["status"]!="completed": raise HTTPException(409,"Result is not complete")
        return FileResponse(store.root/(id+".result.json"),media_type="application/json",filename="convolvex-result.json")
    @app.get("/api/v1/jobs/{id}/input")
    def input_file(id:str):
        store.get(id)
        return FileResponse(store.root/(id+".input.json"),media_type="application/json",filename="convolvex-project.json")
    @app.get("/api/v1/benchmarks")
    def benchmarks():
        path=Path(__file__).parent/"data/benchmark.json"
        if not path.exists(): return {"available":False}
        return json.loads(path.read_text())
    @app.get("/")
    def index(): return FileResponse(Path(__file__).parent/"web/index.html")
    app.mount("/assets",StaticFiles(directory=Path(__file__).parent/"web"),name="assets")
    return app
