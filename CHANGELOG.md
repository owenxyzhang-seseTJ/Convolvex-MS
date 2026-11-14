# Deployment revision deploy.1 — 2026-11-14

- Keep numerical package version 1.1.0; tag v1.1.0-deploy.1 records deployment fixes.
- Correct HTTP/UI version metadata and reject non-ASCII authorization headers with 401.
- Add native Windows service paths, process ownership checks, detached startup, configurable ports, and platform launchers.
- Split Windows symlink-privilege coverage from ordinary import guards; skip only the unsupported fixture.
- Record macOS CPU, WSL CPU/C++/CUDA parity, and native Windows CPU/MCP/HTTP measurements with scope and skip reasons.
- Add source deployment bundles for macOS ARM64 CPU, WSL2 x86_64 CUDA12 and Windows x86_64 CPU.

# 1.1.0 — MS and MCP

- Added mass-spectrometry contracts, immutable datasets, scan/units/mask audit.
- Added batched causal/full spectral-temporal operators and strict adjoints.
- Added channel-wise weighted SVD background elimination without a dense global basis.
- Corrected scale-incompatible FISTA roundoff and stopping checks for very small signals.
- Added local MCP stdio and loopback Streamable HTTP with modern 2026-07-28 metadata and legacy 2025 profiles.
- Added 15 domain tools, resources, a prompt, bounded job storage, integrity checks and slice reads.
- Added operator-only calibration gates and preserved raw-EC integration.
- Added deterministic MCP client workflow and host-installable skill instructions.
- Added MS-only simulations, reproducible CPU timings and a LaTeX report; removed generic image/volume examples from the main example directory.
- Set plotting preference to strict Arial; the shipped preview records an explicit Arimo fallback because Arial is unavailable in the build environment.

The generic numerical API and existing web assets are retained for compatibility. This release does not provide a new frontend, an official MCP certification, GPU measurements, LLM performance evaluation, or experimental chemical validation.
