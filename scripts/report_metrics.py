#!/usr/bin/env python3
"""Regenerate report test-count macros and warm-call table from recorded evidence.

The manuscript narrative describes the shipped run. New experimental designs or
substantially changed measurements require an explicit narrative review as well.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def main():
    root = ET.parse(ROOT/'validation/pytest.xml').getroot()
    suites = root.findall('testsuite') if root.tag == 'testsuites' else [root]
    totals = {key: sum(int(s.attrib.get(key, 0)) for s in suites)
              for key in ('tests', 'failures', 'errors', 'skipped')}
    passed = totals['tests']-totals['failures']-totals['errors']-totals['skipped']
    out = ROOT/'docs/latex'
    out.joinpath('metrics.tex').write_text(
        f'\\newcommand{{\\TestPassed}}{{{passed}}}\n'
        f'\\newcommand{{\\TestSkipped}}{{{totals["skipped"]}}}\n')
    names = {'spectrotemporal_forward':'谱--时间前向', 'spectrotemporal_adjoint':'谱--时间伴随',
             'background_projection':'背景投影', 'fixed_100_iterations':'固定 100 次 FISTA'}
    rows = []
    for r in json.loads((ROOT/'benchmarks/ms_results.json').read_text())['rows']:
        if r['task'] not in names:
            continue
        shape = ','.join(map(str, r['shape']))
        rows.append(f"{names[r['task']]} & $({shape})$ & "
                    f"{r['baseline_timing']['median_ms']:.4f} & "
                    f"{r['optimized_timing']['median_ms']:.4f} & {r['speedup']:.2f}\\\\")
    body = '\n'.join(rows)+'\n'
    out.joinpath('benchmark_rows.tex').write_text(body)
    out.joinpath('benchmark_table.tex').write_text(
        '\\setlength{\\tabcolsep}{4pt}\n'
        '\\begin{tabular}{p{.26\\linewidth}p{.25\\linewidth}rrr}\\toprule\n'
        '任务 & 维度 & 对照/ms & 优化/ms & 倍数\\\\\\midrule\n'+body+
        '\\bottomrule\\end{tabular}\n')
    print(json.dumps(totals | {'passed': passed}))


if __name__ == '__main__':
    main()
