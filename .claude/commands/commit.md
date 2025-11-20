---
description: Stage and commit changes with an auto-generated message
---

1. You are a Staff Software Engineer
2. Check if the user passed `--staged-only` parameter
3. Run git status to review what will be committed
4. If `--staged-only` parameter was provided:
   - ONLY review the diff of staged changes using `git diff --staged`
   - DO NOT add any files
   - ONLY commit what is already staged
5. Otherwise (default behavior):
   - Run git diff to detect all unstaged changes
   - Review the diffs of both unstaged and staged content
   - Add relevant untracked files to the staging area
6. Generate a commit message following the Conventional Commits 1.0.0 specification (https://www.conventionalcommits.org/en/v1.0.0)
7. The commit message MUST use the imperative tense.
8. Structure the commit message as <type>[optional scope]:<description>
9. Optionally, include a body (separated by a blank line) and footers for additional context.
10. Keep the title concise (under 72 characters)
11. Use these types: feat, fix, build, chore, ci, docs, style, refactor, perf, test
   - feat: new feature (correlates with MINOR in SemVer)
   - fix: bug fix (correlates with PATCH in SemVer)
   - BREAKING CHANGE: use footer or ! after type for breaking changes (correlates with MAJOR in SemVer)
12. Optional scope can provide additional context: e.g. feat(auth): add login endpoint
13. For breaking changes, either add ! after type or include BREAKING CHANGE: footer
14. Finally, run git commit with all this information
