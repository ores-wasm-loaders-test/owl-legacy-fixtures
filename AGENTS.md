# owl-fixtures — agent notes

This repository is synthetic but structurally faithful build outputs — a Flutter web release, a Leptos islands release and a Dioxus route-chunk release — with their manifests, plus a marketing shell that prepares them.

- Fixtures imitate the SHAPE of real build output (entrypoints, chunk graph, digests), never a vendor's copyrighted assets.
- This org exists for external-facing testing and its own GitHub Actions minutes; nothing here is deployed.
- Never React/JSX and never a webview. TypeScript, Rust and Dart are modularized (nothing
  lives only in `main.*`); favor pure functions, explicit inputs and outputs, immutability,
  typed errors, exhaustive matching, and effects pushed to the edges.
- No third-party runtime dependencies in this org. The loading layer is the first thing a
  page runs; it must not drag a dependency tree in front of itself.
- Contracts are TypeSpec + JSON Schema peers checked by ORESoftware/ores-contracts; the
  shared vocabulary comes from `ores-wasm-loaders/owl-interfaces` through zed-pkg.
- Preparation and activation are different operations and must stay that way: preparation
  never executes application code, authenticates, subscribes, or writes.
- Resolve git conflicts semantically (reconcile both sides; never just pick one); never
  rebase, stash, or reset. `main` is production, `dev` is integration.

<!-- BEGIN ores-agents-pointer: managed by ORESoftware/my-ai; edit there, not here -->
## Canonical agent instructions

Before doing anything else in this repository, also read:

    .ores/agents/AGENTS.md

That path is a symlink to `~/codes/oresoftware/my-ai/AGENTS.md`, whose canonical copy is
<https://github.com/ORESoftware/my-ai/blob/main/AGENTS.md>. The symlink is deliberately not
committed (it names an absolute path only valid on a machine with that checkout), so `.ores/`
is git-ignored. If it is missing on your machine:

    mkdir -p .ores/agents
    ln -sfn "$HOME/codes/oresoftware/my-ai/AGENTS.md" .ores/agents/AGENTS.md

A missing `.ores/agents/AGENTS.md` is a setup gap on the reader's machine, never a reason to
skip the canonical instructions: fetch them from the URL above instead.
<!-- END ores-agents-pointer -->
