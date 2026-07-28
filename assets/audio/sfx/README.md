# Sound effects

Every `.m4a` here is loaded by `require()` from code — `src/render/management-sfx.ts`
for management UI cues, `src/render/audio.ts` for match cues. The cue-to-asset
mapping is pinned by `src/render/__tests__/management-sfx.test.ts`, which asserts
the literal `require()` source text, so a rename or repoint fails the suite rather
than going quiet.

## Retained masters

One file is deliberately kept without being loaded:

- **`stat-step-tap.m4a`** — the un-boosted source of `stat-step-tap-loud.m4a`.
  The shipped asset is this one at 1.6x with a soft knee (sample ceiling
  -0.5 dBFS). Keeping the master is what makes that render reproducible; delete
  it and regenerating the stepper tap needs a fresh recording.

It is not an orphan. An automated sweep that deletes unreferenced assets will
flag it — don't.

## Before deleting anything

Assets go stale when a cue is repointed, and the `stat-step` cue has moved three
times (`stat-step-tap` → `ui-push-button` → `ui-push-button-loud` →
`stat-step-tap-loud`), stranding a file at each hop. So:

1. Check every branch, not just yours. `git grep <name> $(git rev-list --all)` is
   slow but honest; at minimum check `main` and any open branch. A file unused on
   your branch may be the live asset on `main`.
2. Use `git grep`, not `grep -r` — it searches tracked files, so it can't be
   fooled by a stale `dist/` or by the sibling worktrees under `.claude/`.
3. Delete in the same commit as the repoint that orphaned the file, so a revert
   restores the cue and its asset together.
