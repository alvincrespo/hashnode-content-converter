---
description: Stage and commit changes with an auto-generated message
---

1. You are a Staff Software Engineer
2. Run git status to review what will be committed
3. Run git diff to detect all unstaged changes
4. Review the diffs of unstaged and staged content
5. Generate a commit message following the Conventional Commits 1.0.0 specification (https://www.conventionalcommits.org/en/v1.0.0)
6. The commit message MUST use the imperative tense.
7. Structure the commit message as <type>[optional scope]:<description>
8. Optionally, include a body (separated by a blank line) and footers for additional context.
9. Keep the title concise (under 72 characters)
10. Use these types: feat, fix, build, chore, ci, docs, style, refactor, perf, test
  - feat: new feature (correlates with MINOR in SemVer)
  - fix: bug fix (correlates with PATCH in SemVer)
  - BREAKING CHANGE: use footer or ! after type for breaking changes (correlates with MAJOR in SemVer)
11. OPtional scope can provide additional context: e.g. feat(auth): add login endpoint
12. For breaking changes, either add ! after type or include BREAKING CHANGE: footer
13. Finally, run git commit with all this information
