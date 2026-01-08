---
description: Cut a new release (patch, minor, or major)
allowed-tools: Bash(npm version:*), Bash(git status:*), Bash(git log:*), Bash(git push:*), Bash(git diff:*), Bash(git checkout:*), Bash(git branch:*), Bash(git tag:*), Bash(git fetch:*), Bash(nvm:*), Bash(gh pr:*), Read
---

# Release Command

Cut a new release by creating a release branch, bumping the version, and going through the PR process.

## Arguments

The user should provide a version type as the first argument: `patch`, `minor`, or `major`

- **patch**: Bug fixes and minor changes (0.2.2 → 0.2.3)
- **minor**: New features, backwards compatible (0.2.2 → 0.3.0)
- **major**: Breaking changes (0.2.2 → 1.0.0)

If no argument is provided, ask the user which version type they want.

## Pre-release Checks

Before starting, verify:

1. Run `git status` to ensure the working directory is clean (no uncommitted changes)
2. Run `git branch --show-current` to check the current branch
3. Read the current version from package.json

If there are uncommitted changes, stop and ask the user to commit or stash them first.

## Release Process

### Phase 1: Create Release PR

1. Checkout main and pull latest: `git checkout main && git pull`
2. Read package.json to determine the current version
3. Calculate what the new version will be based on the type (patch/minor/major)
4. Create a release branch: `git checkout -b release/v<new-version>`
5. Use `nvm use $(cat .node-version)` before running npm commands
6. Run `npm version <type> --no-git-tag-version` to bump version WITHOUT creating a tag
7. Commit the version bump: `git add package.json package-lock.json && git commit -m "chore: bump version to <new-version>"`
8. Push the release branch: `git push -u origin release/v<new-version>`
9. Create a pull request using gh CLI:
   ```
   gh pr create --title "chore: bump version to <new-version>" --body "## Summary
   - Bumps version from <old-version> to <new-version>

   ## Release Type
   - **Type**: <patch|minor|major>

   ## After Merge
   Once this PR is merged, the release tag will be created automatically and the package will be published to npm.

   To skip automatic tagging, add \`[SKIP RELEASE]\` to the PR title."
   ```
10. Tell the user the PR has been created and they should wait for checks to pass and merge

### Phase 2: Create Release Tag (only if [SKIP RELEASE] was used)

If the user runs `/release tag` (only needed when auto-tagging was skipped):

1. Run `git fetch origin && git checkout main && git pull` to get the merged changes
2. Read the version from package.json
3. Create the tag: `git tag v<version>`
4. Push the tag: `git push origin v<version>`
5. Inform the user that the release workflow has been triggered

## Output

After Phase 1, tell the user:
- The PR URL
- The new version number
- To wait for CI checks to pass
- To merge the PR
- That after merge, tagging and npm publishing will happen automatically
- They can monitor progress at: https://github.com/alvincrespo/hashnode-content-converter/actions

After Phase 2 (manual tagging), tell the user:
- The tag that was created
- That the GitHub Actions release workflow has been triggered
- They can monitor progress at: https://github.com/alvincrespo/hashnode-content-converter/actions/workflows/release.yml
