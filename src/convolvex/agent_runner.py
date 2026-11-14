"""Runnable deterministic MCP client workflow, not a claim of an LLM benchmark.

A language-model agent can call the same tools and prompt. This client provides
an inspectable, bounded reference trajectory without a provider key or network.
"""
from __future__ import annotations
import argparse, copy, json, os, queue, subprocess, sys, threading, time
from pathlib import Path
from .massspec import digest


class StdioClient:
    def __init__(self,workspace,timeout=30.,protocol="2026-07-28"):
        self.timeout=timeout; self.protocol=protocol; self.sequence=0; self.incoming=queue.Queue()
        self.process=subprocess.Popen([sys.executable,"-u","-m","convolvex.mcp_server","--workspace",str(workspace)],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding="utf-8",bufsize=1)
        self.stderr=[]
        def reader():
            try:
                for line in self.process.stdout:
                    self.incoming.put(json.loads(line))
            except Exception as exc: self.incoming.put(exc)
            finally: self.incoming.put(EOFError("MCP subprocess closed stdout"))
        def errors():
            for line in self.process.stderr:
                self.stderr.append(line.rstrip())
                if len(self.stderr)>100: self.stderr.pop(0)
        self.thread=threading.Thread(target=reader,daemon=True); self.thread.start()
        self.error_thread=threading.Thread(target=errors,daemon=True); self.error_thread.start()
        if protocol=="2026-07-28":
            result=self.request("server/discover",{})
            if protocol not in result["supportedVersions"]:
                self.close(); raise RuntimeError("Unsupported server protocol")
        else:
            result=self.request("initialize",{"protocolVersion":protocol,"capabilities":{},
                                            "clientInfo":{"name":"convolvex-reference-agent","version":"1.1.0"}})
            if result["protocolVersion"]!=protocol:
                self.close(); raise RuntimeError("Unsupported negotiated protocol")
            self.notify("notifications/initialized",{})

    def notify(self,method,params):
        self.process.stdin.write(json.dumps({"jsonrpc":"2.0","method":method,"params":params},allow_nan=False)+"\n")
        self.process.stdin.flush()

    def request(self,method,params):
        if self.protocol=="2026-07-28":
            params={**params,"_meta":{"io.modelcontextprotocol/protocolVersion":self.protocol,
                    "io.modelcontextprotocol/clientCapabilities":{},
                    "io.modelcontextprotocol/clientInfo":{"name":"convolvex-reference-agent","version":"1.1.0"}}}
        self.sequence+=1; ident=self.sequence
        self.process.stdin.write(json.dumps({"jsonrpc":"2.0","id":ident,"method":method,"params":params},allow_nan=False)+"\n")
        self.process.stdin.flush()
        deadline=time.monotonic()+self.timeout
        while True:
            try: response=self.incoming.get(timeout=max(.01,deadline-time.monotonic()))
            except queue.Empty: raise TimeoutError("MCP request timed out") from None
            if isinstance(response,Exception): raise response
            if "id" not in response: continue
            if response["id"]!=ident: raise RuntimeError("Mismatched response ID")
            if "error" in response: raise RuntimeError(json.dumps(response["error"]))
            return response["result"]

    def tool(self,name,arguments):
        result=self.request("tools/call",{"name":name,"arguments":arguments})
        if result.get("isError"): raise RuntimeError(result["content"][0]["text"])
        return result["structuredContent"]

    def close(self):
        if self.process.poll() is None:
            self.process.stdin.close()
            try: self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.terminate()
                try: self.process.wait(timeout=3)
                except subprocess.TimeoutExpired: self.process.kill(); self.process.wait()
        self.thread.join(timeout=1); self.error_thread.join(timeout=1)

    def __enter__(self): return self
    def __exit__(self,*_): self.close()


def run_workflow(plan:dict,workspace,deadline_s=120.):
    if set(plan)-{"input","analysis","background","l2_factors","max_jobs","timeout_s"}:
        raise ValueError("Unknown workflow field")
    factors=plan.get("l2_factors",[1.]); budget=int(plan.get("max_jobs",3))
    if not 1<=budget<=3 or not factors or len(factors)>budget or any(not isinstance(x,(int,float)) or not 0<x<=100 for x in factors):
        raise ValueError("At most three prespecified positive regularization factors are allowed")
    if not 1<=deadline_s<=600: raise ValueError("deadline_s must be 1..600")
    trace=[]; start=time.monotonic()
    with StdioClient(workspace) as client:
        catalog=client.request("tools/list",{})
        def call(name,args):
            response=client.tool(name,args)
            trace.append({"step":len(trace)+1,"tool":name,"arguments":args,
                          "arguments_sha256":digest(args),"result":response,"result_sha256":digest(response)})
            return response
        capabilities=call("ms_capabilities",{})
        imported=call("ms_import_file",plan["input"])
        key=imported["dataset_id"]
        audited=call("ms_inspect",{"dataset_id":key})
        if "background" in plan:
            bg=call("ms_background",{"dataset_id":key,**plan["background"]})
            key=bg["residual_dataset_id"]
            audited=call("ms_inspect",{"dataset_id":key})
        check=call("ms_check_response",{"response":plan["analysis"]["response"]})
        jobs=[]
        try:
            for factor in factors:
                request=copy.deepcopy(plan["analysis"])
                request["dataset_id"]=key; request["l2"]=request.get("l2",.003)*factor
                submitted=call("ms_submit_analysis",{"request":request,"reuse":True})
                key_job=submitted["job_id"]; jobs.append({"job_id":key_job,"l2_factor":factor})
                while True:
                    status=client.tool("ms_get_job",{"job_id":key_job})
                    if status["status"] in {"completed","cancelled","failed","interrupted"}: break
                    if time.monotonic()-start>deadline_s:
                        call("ms_cancel_job",{"job_id":key_job}); raise TimeoutError("Workflow budget exhausted; cancellation requested")
                    time.sleep(.03)
                trace.append({"step":len(trace)+1,"tool":"ms_get_job","arguments":{"job_id":key_job},
                              "result":status,"result_sha256":digest(status)})
                if status["status"]!="completed": raise RuntimeError("Numerical task did not complete: "+str(status))
                summary=call("ms_get_result",{"job_id":key_job})
                preview=call("ms_read_array",{"job_id":key_job,"field":"estimate","row":0,"count":64})
                jobs[-1].update(summary=summary,preview=preview)
        except Exception:
            for job in jobs:
                try: client.tool("ms_cancel_job",{"job_id":job["job_id"]})
                except Exception: pass
            raise
        review=any(not j["summary"]["converged"] for j in jobs) or not check["full_column_rank"] or bool(check["near_collinear_pairs"])
        return {"schema_version":"agent-trace-1.0","runner":"deterministic MCP reference client; no LLM invoked",
                "plan_sha256":digest(plan),"tool_catalog_count":len(catalog["tools"]),"protocol":client.protocol,
                "dataset_id":key,"synthetic":audited["synthetic"],"jobs":jobs,"trace":trace,
                "conclusion_status":"needs_numerical_review" if review else "conditional_model_fit_available",
                "quantification_status":"not_attempted_without_operator_calibration",
                "molecular_identification":"not_performed","elapsed_s":time.monotonic()-start,
                "next_evidence":["independent blank/standard/replicate data","verified calibration for absolute rates/FE"]}


def main():
    p=argparse.ArgumentParser(prog="convolvex-agent")
    p.add_argument("plan"); p.add_argument("--workspace",required=True); p.add_argument("--output",default="agent_trace.json")
    a=p.parse_args()
    path=Path(a.plan)
    if path.stat().st_size>2_000_000: p.error("Plan exceeds 2 MB")
    plan=json.loads(path.read_text(encoding="utf-8"))
    result=run_workflow(plan,a.workspace,float(plan.get("timeout_s",120.)))
    Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({"output":a.output,"status":result["conclusion_status"],"jobs":len(result["jobs"])},ensure_ascii=False))

if __name__=="__main__": main()
