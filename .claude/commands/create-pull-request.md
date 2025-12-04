---
description: Create pull request for current branch
allowed-tools: Bash(git pr list:*), Bash(git pr create:*)
---

Using the github cli, or gh, you will do the following:

1. Verify that a pull request for the exisiting branch doesn't exist
2. If a pull request exists, output a friendly message with a link to the pull request, otherwise continue with step 3
3. If a pull request does not exist for the current branch, create it
4. Once the pull request is created, output a friendly message with a link to the newly created pull request
