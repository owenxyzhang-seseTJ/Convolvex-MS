import argparse,json,os
from pathlib import Path
from .pipeline import Problem,execute,demo


def main():
    p=argparse.ArgumentParser(prog="convolvex")
    sub=p.add_subparsers(dest="command",required=True)
    serve=sub.add_parser("serve");serve.add_argument("--host",default="127.0.0.1");serve.add_argument("--port",default=8765,type=int);serve.add_argument("--data-dir")
    run=sub.add_parser("run");run.add_argument("project");run.add_argument("--output",default="result.json")
    ex=sub.add_parser("demo");ex.add_argument("kind",choices=["signal","baseline","image","volume","dems","poisson"]);ex.add_argument("--output",default="project.json")
    sub.add_parser("capabilities")
    args=p.parse_args()
    if args.command=="serve":
        import uvicorn
        from .service import create_app
        if args.host not in {"localhost","127.0.0.1","::1"} and not os.environ.get("CONVOLVEX_TOKEN"):
            p.error("Non-loopback binding requires CONVOLVEX_TOKEN. Use a TLS/authenticated reverse proxy.")
        uvicorn.run(create_app(args.data_dir),host=args.host,port=args.port,workers=1)
    elif args.command=="run":
        try:
            problem=Problem.model_validate_json(Path(args.project).read_text(encoding="utf-8"));out=execute(problem)
            Path(args.output).write_text(json.dumps(out,ensure_ascii=False,indent=2,allow_nan=False),encoding="utf-8")
            print(args.output)
        except (ValueError,TypeError,RuntimeError) as e: p.error(str(e))
    elif args.command=="demo":
        Path(args.output).write_text(json.dumps(demo(args.kind)["problem"],ensure_ascii=False,indent=2),encoding="utf-8");print(args.output)
    else:
        from .gpu import capability
        from .native import available
        print(json.dumps({"cpp":available(),"gpu":capability()},indent=2))

if __name__=="__main__": main()
