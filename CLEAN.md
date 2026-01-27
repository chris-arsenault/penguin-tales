# Cleanup Review (With .gitignore Applied)

Scope: artifacts, local/dev state, large binaries, temp outputs, and possible leaks. This pass filters out anything already ignored by the current `.gitignore` files. Only items that are **not ignored** are listed as cleanup candidates.

## Findings (Not Ignored)

### Local Tooling State
- `.claude/` (assistant workspace state)
- `.claude-flow/` (assistant workflow state)

### Module Federation Temp Output
Not ignored and present in multiple apps:
- `apps/archivist/webui/.__mf__temp/`
- `apps/canonry/webui/.__mf__temp/`
- `apps/chronicler/webui/.__mf__temp/`
- `apps/coherence-engine/webui/.__mf__temp/`
- `apps/cosmographer/webui/.__mf__temp/`
- `apps/illuminator/webui/.__mf__temp/`
- `apps/lore-weave/webui/.__mf__temp/`
- `apps/name-forge/webui/.__mf__temp/`
- `apps/viewer/webui/.__mf__temp/`

### Exports/Artifacts in Repo Root
- `eslint-plugin-react-perf-3.3.3.tgz` (vendor tarball)
- `image-prompts-2026-01-08.json` (data export)

### Ad-Hoc/Temp Files
- `apps/lore-weave/validate-temp.js`

### Planning Docs Outside `history/`
- `apps/cosmographer/PLAN.md`
- `apps/cosmographer/DESIGN-V2.md`

## Clean Scans (No Issues Found)
- No unignored `*.log`, `*.tmp`, `*.bak`, `*.swp`, or `*.db` files.
- No unignored large files > 20MB.
- No obvious secret patterns found outside ignored paths.

## Ignored By .gitignore (Mentioned Only For Zip-Sharing)
These are ignored by git and won’t be committed, but they will still exist if you zip the working directory:
- `.env`
- `node_modules/`, `dist/`, `coverage/`, `.vite/`
- `.idea/`
- `.terraform/` and downloaded Terraform provider binaries
- `.beads/beads.db`, `.beads/daemon.log`

If you plan to share a raw folder or zip, consider removing these too.
