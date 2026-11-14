# 1.1.0 — MS and MCP

- Added mass-spectrometry contracts, immutable datasets, scan/units/mask audit.
- Added batched causal/full spectral-temporal operators and strict adjoints.
- Added channel-wise weighted SVD background elimination without a dense global basis.
- Corrected scale-incompatible FISTA roundoff and stopping checks for very small signals.
- Added local MCP stdio and loopback Streamable HTTP with modern 2026-07-28 metadata and legacy 2025 profiles.
- Fixed 2026-07-28 cacheable replies to include the SEP-2549 `ttlMs` and `cacheScope` fields required by official SDK clients.
- Added 15 domain tools, resources, a prompt, bounded job storage, integrity checks and slice reads.
- Added operator-only calibration gates and preserved raw-EC integration.
- Added deterministic MCP client workflow and host-installable skill instructions.
- Added MS-only simulations, reproducible CPU timings and a LaTeX report; removed generic image/volume examples from the main example directory.
- Set plotting preference to strict Arial; the shipped preview records an explicit Arimo fallback because Arial is unavailable in the build environment.

The generic numerical API and existing web assets are retained for compatibility. This release does not provide a new frontend, an official MCP certification, GPU measurements, LLM performance evaluation, or experimental chemical validation.
