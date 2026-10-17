# CueFrame examples — agent contract

This repository holds finished CueFrame projects. CueFrame itself is the `cueframe/` submodule;
read `cueframe/AGENTS.md` first, it is the contract for every project here.

## Adding an example

1. `pnpm exec cueframe new examples/<name>` (or `--template deck`), or create the folder by hand:
   `package.json`, `timeline.ts`, `scenes/`, `tsconfig.json` extending `../../tsconfig.base.json`.
2. Import recipes as `@cueframe/recipes/<name>`; copy one into the project only to change it.
3. Large binaries (fonts over ~1 MB, audio, video, rendered plates) are never committed: add them
   to `.gitignore` and to `scripts/fetch-fonts.sh` or the example's `make.sh`.
4. A `README.md` with what the piece is and the commands that build it.
5. `pnpm check <name>` passes, and you looked at the stills yourself.

## Changing CueFrame or texmorph

When the framework is in the way, change it, as `cueframe/AGENTS.md` ("Changing CueFrame")
describes: in `cueframe/`, branch `feedback/<example>`, fix with a test, add a field note to
`cueframe/docs/feedback/`, push and open a pull request there. Until it is merged, the submodule
here may point at that branch's commit; after the merge, point it at CueFrame's main. Never edit
files under `cueframe/` or `texmorph/` without such a branch.

## Bumping the submodule

`git -C cueframe fetch && git -C cueframe checkout <commit>`, then `pnpm check`. A regression in
an example is a CueFrame bug to report (field note) or fix, not something to patch around here.

## Prohibited

- Editing another example's content when working on yours.
- Editing generated output (`out/`, `build/`) by hand instead of regenerating it.
- Hiding or skipping a failing check.
