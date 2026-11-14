# 质谱与 DEMS 信号解析：LaTeX 技术报告

运行 `latexmk -xelatex -interaction=nonstopmode -halt-on-error main.tex`。
需要 XeLaTeX、BibTeX、ctex、fontspec、amsmath、natbib、algorithm2e、TikZ 与常用 TeX 宏包。
本机字体：Noto Serif CJK SC、Noto Sans CJK SC、Noto Sans Mono CJK SC、Liberation Serif、Arimo、DejaVu Sans Mono。没有附带字体文件。

`main.tex` 是主文件，`chapters/` 为正文，`references.bib` 是文献，`figures/` 是已生成矢量图。`.latexmkrc` 仅在本环境 BibTeX 链接失效时选择存在的 `bibtex.original`，普通 TeX 安装不受影响。

绘图源码位于完整代码包的 `scripts/ms_simulate.py`，默认要求 **Arial**。当前构建环境没有 Arial，本次图的实际字体为 **Arimo**，已明确记录在完整包 `simulations/font_receipt.json` 中。单独 LaTeX 编译只会使用已生成的图，不会自动替换图中文字；在已合法安装 Arial 的机器上，先重新运行完整包的绘图脚本，再编译才能获得真正的 Arial 图。TikZ 图使用可用的 Arial，否则明确回退 Arimo。

本报告只讨论质谱/DEMS 的数学物理、算法、MCP 与 agent 流程；没有前端章节或图像去模糊实验。所有模拟是构造数据；计算测试不是实验定量认证。
