"""Private, single-process MS workspace with immutable data and bounded jobs.

This is a local research service, not a multi-tenant or adversarial compute sandbox.
No tool writes calibration records, executes code, fetches URLs, or deletes files.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import csv, hashlib, io, json, os, re, sqlite3, threading, time, uuid
from datetime import datetime, timezone
import numpy as np
from .massspec import (MSDataset, AnalysisRequest, ProfileRequest, analyze, analyze_profile,
                       audit_dataset, digest, response_diagnostics, background_diagnosis)
from .physics import integrate_current, FARADAY
from .solvers import CancelledError

MAX_BYTES = 24_000_000


def write_json(path: Path, value):
    encoded=json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    tmp=path.with_name(path.name+"."+uuid.uuid4().hex+".tmp")
    try:
        with open(tmp,"xb") as handle:
            os.chmod(tmp,0o600); handle.write(encoded); handle.flush(); os.fsync(handle.fileno())
        os.replace(tmp,path)
    finally:
        tmp.unlink(missing_ok=True)


def parse_json(raw):
    def pairs(items):
        out={}
        for key,value in items:
            if key in out: raise ValueError("Duplicate JSON key")
            out[key]=value
        return out
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda s: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))


def read_json(path):
    return parse_json(Path(path).read_text(encoding="utf-8"))


def identifier(value, kind="hash"):
    if kind=="hash":
        ok=isinstance(value,str) and re.fullmatch(r"[0-9a-f]{64}",value)
    else:
        try: ok=isinstance(value,str) and str(uuid.UUID(value))==value
        except (ValueError,TypeError,AttributeError): ok=False
    if not ok: raise ValueError("Invalid identifier")
    return value


class MSWorkspace:
    def __init__(self, root, workers=2, capacity=6):
        self.root=Path(root).expanduser().resolve()
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.lock=threading.RLock(); self.events={}; self.progress={}; self.capacity=capacity
        self._lease=open(self.root/".process.lock","a+b")
        try:
            if os.name=="nt":
                import msvcrt
                self._lease.seek(0); self._lease.write(b"0"); self._lease.flush(); self._lease.seek(0)
                msvcrt.locking(self._lease.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self._lease,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self._lease.close()
            raise RuntimeError("Workspace already has an active server; use a separate workspace per process") from None
        for sub in ("inbox","datasets","jobs","artifacts","calibrations"):
            (self.root/sub).mkdir(exist_ok=True,mode=0o700)
        self.db=self.root/"ms-jobs.sqlite3"
        with self.connection() as con:
            con.execute("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,created REAL,status TEXT,kind TEXT,request_hash TEXT,error TEXT)")
            con.execute("UPDATE jobs SET status='interrupted',error='Process restarted; job was not resumed' WHERE status IN ('queued','running')")
        self.pool=ThreadPoolExecutor(max_workers=workers,thread_name_prefix="convolvex-ms")
        self.closed=False

    def connection(self):
        return sqlite3.connect(self.db,timeout=20)

    def log(self, action, **fields):
        record={"timestamp":datetime.now(timezone.utc).isoformat(),"action":action,**fields}
        with self.lock,open(self.root/"audit.jsonl","a",encoding="utf-8") as handle:
            handle.write(json.dumps(record,ensure_ascii=False,allow_nan=False)+"\n")

    def quota(self):
        if sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file())>1_000_000_000:
            raise ValueError("Workspace quota exceeded (1 GB); archive it outside this service")

    def put_dataset(self, data: MSDataset):
        self.quota()
        content=data.model_dump(); key=digest(content); path=self.root/"datasets"/(key+".json")
        if not path.exists(): write_json(path,content)
        self.log("import_dataset",dataset_id=key)
        return audit_dataset(data)

    def dataset(self,key):
        identifier(key); path=self.root/"datasets"/(key+".json")
        if not path.is_file(): raise ValueError("Unknown dataset")
        data=MSDataset.model_validate(read_json(path))
        if digest(data.model_dump())!=key: raise ValueError("Dataset checksum mismatch")
        return data

    def import_file(self,relative_path,signal_unit="a.u.",time_origin="explicit shared origin",instrument_id="unspecified",conditions_id="unspecified"):
        """Read only JSON/CSV already placed by the user under inbox/; never arbitrary paths."""
        if not isinstance(relative_path,str) or len(relative_path)>256:
            raise ValueError("Invalid input path")
        part=Path(relative_path)
        if part.is_absolute() or any(p in {"..","."} for p in part.parts):
            raise ValueError("Only relative inbox paths are allowed")
        base=(self.root/"inbox").resolve(); path=base/part
        for parent in [path,*path.parents]:
            if parent==base: break
            if parent.is_symlink(): raise ValueError("Symbolic links are not allowed")
        if not path.resolve().is_relative_to(base) or not path.is_file():
            raise ValueError("Input must be an existing file under inbox")
        if path.suffix.lower() not in {".json",".csv"} or path.stat().st_size>MAX_BYTES:
            raise ValueError("Only bounded .json and .csv inputs are accepted")
        with os.fdopen(os.open(path,os.O_RDONLY|getattr(os,"O_NOFOLLOW",0)),"rb") as h:
            raw=h.read(MAX_BYTES+1)
        if len(raw)>MAX_BYTES: raise ValueError("Input exceeds size limit")
        text=raw.decode("utf-8-sig")
        if path.suffix.lower()==".json":
            data=MSDataset.model_validate(parse_json(text))
        else:
            reader=csv.DictReader(io.StringIO(text))
            fields=reader.fieldnames or []
            if len(set(fields))!=len(fields) or "time_s" not in fields:
                raise ValueError("CSV requires unique headers and time_s")
            masses=[f for f in fields if f.startswith("mz_")]
            if not masses or set(fields)-set(["time_s","current_A",*masses]):
                raise ValueError("CSV columns: time_s,mz_44,mz_45,...,optional current_A; richer metadata uses JSON")
            rows=list(reader)
            if len(rows)<2 or len(rows)*(len(masses)+1)>1_200_000:
                raise ValueError("CSV size outside supported range")
            try:
                t=[float(r["time_s"]) for r in rows]
                values=[[float(r[m]) for r in rows] for m in masses]
                data=MSDataset(time_s=t,mz=[float(m[3:]) for m in masses],signal=values,signal_unit=signal_unit,
                    time_origin=time_origin,instrument_id=instrument_id,conditions_id=conditions_id,
                    ec_time_s=t if "current_A" in fields else None,
                    current_A=[float(r["current_A"]) for r in rows] if "current_A" in fields else None,
                    metadata={"source_file_sha256":hashlib.sha256(raw).hexdigest()})
            except (TypeError,ValueError,KeyError) as exc:
                raise ValueError("Invalid numeric CSV; no formulas or silent missing-value filling: "+str(exc)) from None
        result=self.put_dataset(data); result["source_file_sha256"]=hashlib.sha256(raw).hexdigest()
        return result

    def background(self,key,targets,references,windows,include_pressure=False,drift=True):
        detail,child=background_diagnosis(self.dataset(key),targets,references,windows,include_pressure,drift)
        audit=self.put_dataset(child); artifact_id=digest({"parent":key, "child":audit["dataset_id"],"detail":detail})
        write_json(self.root/"artifacts"/(artifact_id+".json"),detail)
        compact={k:v for k,v in detail.items() if k not in {"predicted_background","signed_residual","blank_mask"}}
        compact.update({"residual_dataset_id":audit["dataset_id"],"artifact_id":artifact_id,
                        "parent_dataset_id":key,"residual_unit":child.signal_unit})
        self.log("background",parent=key,child=audit["dataset_id"],artifact_id=artifact_id)
        return compact

    def submit(self, request, kind="analysis", reuse=True):
        self.quota()
        if kind=="analysis":
            req=AnalysisRequest.model_validate(request)
            data=self.dataset(req.dataset_id)
            # Preflight catches model/units/grid problems before occupying a queue slot.
            from .massspec import _operator_and_weights
            _operator_and_weights(data,req)
        elif kind=="mass_profile": req=ProfileRequest.model_validate(request)
        else: raise ValueError("Unsupported job kind")
        document=req.model_dump(); rh=digest({"kind":kind,"request":document})
        with self.lock,self.connection() as con:
            if reuse:
                row=con.execute("SELECT id FROM jobs WHERE request_hash=? AND status IN ('queued','running','completed') ORDER BY created DESC LIMIT 1",(rh,)).fetchone()
                if row:
                    result=self.get_job(row[0]); result["reused"]=True; return result
            if con.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]>=self.capacity:
                raise ValueError("Task queue is full")
            key=str(uuid.uuid4()); folder=self.root/"jobs"/key; folder.mkdir(mode=0o700)
            write_json(folder/"input.json",{"kind":kind,"request":document,"request_hash":rh})
            con.execute("INSERT INTO jobs VALUES (?,?,?,?,?,?)",(key,time.time(),"queued",kind,rh,None))
        event=threading.Event()
        with self.lock: self.events[key]=event
        self.pool.submit(self._run,key,kind,document,event)
        self.log("submit",job_id=key,kind=kind,request_hash=rh)
        return {**self.get_job(key),"reused":False}

    def update(self,key,status,error=None):
        with self.connection() as con:
            con.execute("UPDATE jobs SET status=?,error=? WHERE id=?",(status,error,key))

    def _run(self,key,kind,request,event):
        folder=self.root/"jobs"/key
        try:
            if event.is_set(): raise CancelledError()
            self.update(key,"running")
            def progress(p):
                with self.lock: self.progress[key]=p
            if kind=="analysis":
                req=AnalysisRequest.model_validate(request)
                result=analyze(self.dataset(req.dataset_id),req,cancel=event.is_set,callback=progress)
            else:
                result=analyze_profile(ProfileRequest.model_validate(request),cancel=event.is_set,callback=progress)
            if event.is_set(): raise CancelledError()
            arrays={field:np.asarray(result.pop(field)) for field in ("estimate","predicted","residual")}
            extras=result.pop("extras",{})
            for field in ("background","background_coefficients"):
                if field in extras: arrays[field]=np.asarray(extras.pop(field))
            if extras: result["extras"]=extras
            history=result.pop("history",[])
            arrays["objective_history"]=np.asarray([h["objective"] for h in history],dtype=float)
            write_json(folder/"history.json",history)
            with open(folder/"arrays.npz","wb") as handle: np.savez_compressed(handle,**arrays)
            array_hash=hashlib.sha256((folder/"arrays.npz").read_bytes()).hexdigest()
            result.update({"job_id":key,"array_sha256":array_hash,
                           "arrays":{k:{"shape":list(v.shape),"dtype":str(v.dtype)} for k,v in arrays.items()},
                           "history_count":len(history),"resource_uri":f"convolvex://jobs/{key}/summary"})
            write_json(folder/"summary.json",result)
            self.update(key,"completed")
            self.log("completed",job_id=key,array_sha256=array_hash,converged=result["converged"])
        except CancelledError:
            self.update(key,"cancelled"); self.log("cancelled",job_id=key)
        except Exception as exc:
            # Never expose tracebacks, credentials, or arbitrary file contents to a model.
            self.update(key,"failed",f"{type(exc).__name__}: {str(exc)[:1000]}")
            self.log("failed",job_id=key,error_type=type(exc).__name__)
        finally:
            with self.lock: self.events.pop(key,None)

    def get_job(self,key):
        identifier(key,"uuid")
        with self.connection() as con:
            row=con.execute("SELECT id,created,status,kind,request_hash,error FROM jobs WHERE id=?",(key,)).fetchone()
        if row is None: raise ValueError("Unknown job")
        out=dict(zip(("job_id","created_unix","status","kind","request_hash","error"),row))
        with self.lock: out["progress"]=self.progress.get(key)
        out["completed_means"]="execution finished; inspect converged/science_status separately"
        return out

    def list_jobs(self,limit=20):
        if not 1<=limit<=100: raise ValueError("limit must be 1..100")
        with self.connection() as con:
            ids=con.execute("SELECT id FROM jobs ORDER BY created DESC LIMIT ?",(limit,)).fetchall()
        return {"jobs":[self.get_job(row[0]) for row in ids]}

    def cancel(self,key):
        status=self.get_job(key)
        with self.lock:
            event=self.events.get(key)
            if event: event.set()
        self.log("cancel_requested",job_id=key,requested=event is not None)
        return {"job_id":key,"cancellation_requested":event is not None,"previous_status":status["status"]}

    def result(self,key):
        if self.get_job(key)["status"]!="completed":
            raise ValueError("Result is not complete")
        return read_json(self.root/"jobs"/key/"summary.json")

    def read_array(self,key,field="estimate",row=0,start=0,count=256):
        summary=self.result(key)
        if field not in summary["arrays"]: raise ValueError("Unknown array field")
        if count<1 or count>2048 or start<0 or row<0: raise ValueError("Invalid slice; count must be 1..2048")
        path=self.root/"jobs"/key/"arrays.npz"
        if hashlib.sha256(path.read_bytes()).hexdigest()!=summary["array_sha256"]:
            raise ValueError("Result checksum mismatch")
        with np.load(path,allow_pickle=False) as arrays:
            a=arrays[field]; shape=a.shape
            if a.ndim==1:
                if row!=0: raise ValueError("one-dimensional array has only row zero")
                v=a
            elif a.ndim==2:
                if row>=a.shape[0]: raise ValueError("row out of range")
                v=a[row]
            else: raise ValueError("Unsupported array dimensionality")
            if start>v.size: raise ValueError("slice starts beyond array")
            stop=min(start+count,v.size)
            return {"job_id":key,"field":field,"shape":list(shape),"row":row,"start":start,
                    "values":v[start:stop].tolist(),"next_start":stop if stop<v.size else None,
                    "array_sha256":summary["array_sha256"]}

    def charge(self,key,start_s=None,stop_s=None):
        data=self.dataset(key)
        if data.ec_time_s is None: raise ValueError("Raw EC current and time are missing")
        return {**integrate_current(data.ec_time_s,data.current_A,start_s,stop_s),
                "dataset_id":key,"integrated_on":"raw EC grid; no MS-grid resampling",
                "meaning":"total measured charge, not automatically Faradaic-only"}

    def quantify(self,key,species_index,calibration_id,start_s,stop_s,complete_window_confirmed=False,direction="cathodic"):
        summary=self.result(key)
        if not summary.get("converged"): raise ValueError("Quantification blocked: solver not converged")
        rd=summary.get("diagnostics",{}).get("response",{})
        if not rd.get("full_column_rank") or rd.get("near_collinear_pairs"):
            raise ValueError("Quantification blocked: unresolved/coherent response columns require independent evidence")
        input_doc=read_json(self.root/"jobs"/key/"input.json")
        if input_doc["kind"]!="analysis": raise ValueError("Not a species-time analysis")
        req=AnalysisRequest.model_validate(input_doc["request"]); data=self.dataset(req.dataset_id)
        if req.model!="spectrotemporal": raise ValueError("Instantaneous source quantification requires a transport model in this interface")
        if data.signal_unit!="A": raise ValueError("Absolute quantification requires ion current in A")
        if not complete_window_confirmed: raise ValueError("Complete response/integration window must be explicitly confirmed")
        if not 0<=species_index<len(req.species): raise ValueError("species index out of range")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}",calibration_id): raise ValueError("invalid calibration record identifier")
        calpath=self.root/"calibrations"/(calibration_id+".json")
        if calpath.is_symlink() or not calpath.is_file(): raise ValueError("No operator-provisioned calibration record")
        if calpath.stat().st_size>32768: raise ValueError("calibration record exceeds size limit")
        cal=read_json(calpath)
        required={"verified","verified_by","record_id","species","instrument_id","conditions_id","reference_mz",
                  "sensitivity_C_per_mol","electrons","includes_collection","response_sha256","kernel_sha256"}
        if not required<=cal.keys(): raise ValueError("Incomplete calibration record")
        if cal["verified"] is not True or cal["includes_collection"] is not True or not cal["verified_by"]:
            raise ValueError("Calibration has not been operator-verified with collection included")
        if cal["record_id"]!=calibration_id or cal["species"]!=req.species[species_index]:
            raise ValueError("Calibration identity mismatch")
        if any(cal[name]!=getattr(data,name) or cal[name]=="unspecified" for name in ("instrument_id","conditions_id")):
            raise ValueError("Instrument/conditions mismatch; transfer of calibration is not automatic")
        if bool(cal.get("synthetic",False))!=data.synthetic:
            raise ValueError("Synthetic and experimental calibration records cannot be interchanged")
        if cal["response_sha256"]!=digest(req.response) or cal["kernel_sha256"]!=digest({"kernel":req.kernels[species_index],"convention":req.kernel_convention}):
            raise ValueError("Calibration response/kernel fingerprint mismatch")
        if data.synthetic and not cal.get("synthetic"):
            raise ValueError("Simulation cannot use experimental calibration")
        ref=data.mz.index(cal["reference_mz"]) if cal["reference_mz"] in data.mz else -1
        if ref<0 or not np.isclose(req.response[ref][species_index],1.,rtol=1e-9,atol=1e-12):
            raise ValueError("Calibrated reference-channel coefficient must equal one")
        mass=summary["diagnostics"]["kernel_mass"][species_index]
        if not np.isclose(mass,1.,rtol=.01,atol=1e-8):
            raise ValueError("Unit-mass transfer kernel required; avoid double-counting collection efficiency")
        sensitivity=cal["sensitivity_C_per_mol"]; electrons=cal["electrons"]
        if not isinstance(sensitivity,(int,float)) or isinstance(sensitivity,bool) or not np.isfinite(sensitivity) or sensitivity<=0:
            raise ValueError("Invalid calibration sensitivity")
        if not isinstance(electrons,int) or isinstance(electrons,bool) or electrons<1:
            raise ValueError("Electron stoichiometry must be a positive integer")
        if "valid_until" in cal:
            expiry=datetime.fromisoformat(cal["valid_until"].replace("Z","+00:00"))
            if expiry.tzinfo is None or datetime.now(timezone.utc)>expiry:
                raise ValueError("Calibration expired or expiry timezone unspecified")
        charges=self.charge(req.dataset_id,start_s,stop_s)
        if direction not in {"cathodic","anodic"}: raise ValueError("direction must be cathodic/anodic")
        denominator=charges[direction+"_C"]
        if denominator<=0: raise ValueError("No positive charge denominator in selected direction")
        array_path=self.root/"jobs"/key/"arrays.npz"
        if hashlib.sha256(array_path.read_bytes()).hexdigest()!=summary["array_sha256"]:
            raise ValueError("Result checksum mismatch")
        with np.load(array_path,allow_pickle=False) as arrays: source=arrays["estimate"][species_index]
        if np.any(source<0): raise ValueError("Negative source retained; inspect model rather than clipping for FE")
        rate=source/float(sensitivity)
        amount=integrate_current(data.time_s,rate,start_s,stop_s)["net_C"]
        q=float(electrons*FARADAY*amount); efficiency=q/denominator
        result={"job_id":key,"species":cal["species"],"amount_mol":amount,"product_charge_C":q,
                "denominator_charge_C":denominator,"faradaic_efficiency":efficiency,
                "interval_s":[start_s,stop_s],"calibration_id":calibration_id,
                "calibration_sha256":digest(cal),"synthetic":data.synthetic,
                "interpretation":"conditional on the supplied response, transfer, calibration and charge definition",
                "warnings":["Calibration/kernel/model uncertainty is not included; total measured charge may contain capacitive contributions."]}
        if efficiency>1: result["warnings"].append("FE exceeds one; inspect calibration, background, charge and integration window.")
        qid=digest(result); write_json(self.root/"artifacts"/(qid+".json"),result)
        result["artifact_id"]=qid; self.log("quantify",job_id=key,artifact_id=qid,calibration_sha256=digest(cal))
        return result

    def close(self):
        if self.closed: return
        self.closed=True
        with self.lock:
            for event in self.events.values(): event.set()
        self.pool.shutdown(wait=True,cancel_futures=False)
        self._lease.close()
