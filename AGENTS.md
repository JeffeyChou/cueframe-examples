# CueFrame examples — agent contract

This repository holds finished CueFrame projects. CueFrame itself is the `cueframe/` submodule;
read `cueframe/AGENTS.md` first, it is the contract for every project here.

## Adding an example

1. `pnpm exec cueframe new examples/<name>` (or `--template deck`), or create the folder by hand:
   `package.json`, `timeline.ts`, `scenes/`, `tsconfig.json` extending `../../tsconfig.base.json`.
2. Import recipes as `@cueframe/recipes/<name>`; copy one into the project only to change it.
3. Large binaries (fonts over ~1 MB, audio, video, rendered plates) are never committed: add them
   to `.gitignore` and to `scripts/fetch-fonts.sh` or the example's `make.sh`.
4. A `README.md` with what the piece is and the commands that build it, from the repository root.
   Files it imports from `build/` go in its `package.json` as `"cueframe": { "generated": [...],
   "needs": "..." }`.
5. `pnpm check <name>` passes, and you looked at the stills yourself.

## Changing CueFrame or texmorph

When the framework is in the way, change it, as `cueframe/AGENTS.md` ("Changing CueFrame")
describes: in `cueframe/`, branch `feedback/<example>`, fix with a test, add a field note to
`cueframe/docs/feedback/` (ignored by git, it stays local), push and open a pull request there. Until it is merged, the submodule
here may point at that branch's commit; after the merge, point it at CueFrame's main. Never edit
files under `cueframe/` or `texmorph/` without such a branch.

## Bumping a submodule (cueframe or texmorph)

1. The commit must be pushed to that repository first (a pull request branch until it merges, then
   its main); a gitlink to an unpushed commit breaks every clone.
2. `git -C cueframe fetch && git -C cueframe checkout <commit>` (the same for `texmorph`).
3. `pnpm -C cueframe install` (or `pnpm -C texmorph install`) when its lockfile changed, then
   `pnpm check --strict` with every example built.
4. Commit the gitlink with the submodule's short SHA and what it brings in the message; after the
   pull request merges, bump again to the merge commit on main.

A regression in an example is a CueFrame bug to report (field note) or fix, not something to patch
around here.

## Prohibited

- Editing another example's content when working on yours.
- Editing generated output (`out/`, `build/`) by hand instead of regenerating it.
- Hiding or skipping a failing check.
