# Security Consideration: Directory Traversal Protection

## Overview

This document captures a security review feedback regarding the path traversal protection in `FileWriter.sanitizeSlug()` and the rationale for the current implementation approach.

## Current Implementation

**File**: `src/services/file-writer.ts:85-91`

```typescript
// Reject parent directory traversal
if (sanitized.includes('..')) {
  throw new FileWriteError(
    `Invalid slug: parent directory traversal is not allowed (${slug})`,
    slug,
    'validate_path'
  );
}
```

## Security Review Feedback

**Reviewer Comment**:
> The path traversal check using `includes('..')` is insufficient and can be bypassed. Valid slugs like 'hello..world' or 'version-1..0' would be incorrectly rejected, while encoded patterns or path normalization could potentially bypass this check. Consider using path normalization and checking if the resolved path is within the expected directory instead.

**Suggested Implementation**:
```typescript
const resolved = path.resolve(outputDir, sanitized);
const baseDir = path.resolve(outputDir);
if (!resolved.startsWith(baseDir + path.sep)) {
  throw new FileWriteError(
    `Invalid slug: path would escape output directory (${slug})`,
    slug,
    'validate_path'
  );
}
```

## Analysis

### Reviewer's Points (Valid)

1. **False Positives**: Legitimate slugs like `hello..world` or `version-1..0` would be rejected
2. **More Robust**: Path resolution checking is more sophisticated and technically correct
3. **Industry Standard**: This is the recommended approach for web services and untrusted input

### Context: CLI Tool vs Web Service

**Current Use Case**: Personal CLI migration tool
- Users are converting **their own** Hashnode export data
- Input file is a trusted export from Hashnode
- User has explicitly chosen to run this tool
- Low threat model - no untrusted third-party input

**If This Were a Web Service**: High threat model
- Untrusted input from internet users
- Need to handle malicious edge cases
- Higher attack surface
- Path resolution approach would be **mandatory**

## Decision Rationale

### Why Current Implementation is Acceptable for CLI Tool

1. **Likelihood of False Positives**: Near zero
   - How often do Hashnode blog slugs legitimately contain `..`?
   - Typical slugs: `my-blog-post`, `getting-started`, `version-2-released`
   - Unusual slugs like `hello..world` are extremely rare in practice

2. **Defense in Depth**: Multiple security layers exist
   ```typescript
   // Layer 1: Reject absolute paths
   if (sanitized.startsWith('/')) { throw ... }

   // Layer 2: Reject '..' patterns ← Current discussion
   if (sanitized.includes('..')) { throw ... }

   // Layer 3: Replace dangerous characters
   sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '-');
   ```

3. **Simplicity**: Current approach is easier to understand and maintain
   - Clear intent: "No parent directory traversal allowed"
   - No complex path resolution logic
   - Easier for future contributors to understand

4. **Conservative by Design**: Prioritizes security over flexibility
   - Better to reject a rare edge case than risk security
   - CLI tool users can manually rename slugs if needed
   - No production impact for rejected slugs

## Recommendations

### For CLI Tool (Current)
**Status**: ✅ Keep current implementation

**Rationale**:
- Appropriate for the threat model
- Simplicity and security are prioritized
- If users report legitimate slugs being rejected, we can revisit

### For Web Service (Future)
**Status**: ⚠️ Must implement path resolution approach

**Implementation Required**:
```typescript
private sanitizeSlug(slug: string, outputDir: string): string {
  let sanitized = slug.trim();

  // Reject absolute paths
  if (sanitized.startsWith('/')) {
    throw new FileWriteError(
      `Invalid slug: absolute paths are not allowed (${slug})`,
      slug,
      'validate_path'
    );
  }

  // Replace invalid filename characters
  sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '-');

  // Ensure result is not empty
  if (sanitized.length === 0) {
    throw new FileWriteError(
      `Invalid slug: slug is empty after sanitization (original: ${slug})`,
      slug,
      'validate_path'
    );
  }

  // Check resolved path is within outputDir (CRITICAL FOR WEB SERVICE)
  const resolved = path.resolve(outputDir, sanitized);
  const baseDir = path.resolve(outputDir);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new FileWriteError(
      `Invalid slug: path would escape output directory (${slug})`,
      slug,
      'validate_path'
    );
  }

  return sanitized;
}
```

## Test Cases for Future Implementation

If migrating to path resolution approach, add these tests:

```typescript
describe('Path Resolution Security', () => {
  it('should allow slugs with .. in the name', async () => {
    const result = await fileWriter.writePost('./blog', 'hello..world', '---\n', 'content');
    expect(result).toContain('hello..world');
  });

  it('should allow version numbers with ..', async () => {
    const result = await fileWriter.writePost('./blog', 'version-1..0', '---\n', 'content');
    expect(result).toContain('version-1..0');
  });

  it('should reject paths that escape via normalization', async () => {
    await expect(
      fileWriter.writePost('./blog', 'foo/../../../etc/passwd', '---\n', 'content')
    ).rejects.toThrow('path would escape output directory');
  });

  it('should reject symbolic link attempts', async () => {
    await expect(
      fileWriter.writePost('./blog', '../symlink-target', '---\n', 'content')
    ).rejects.toThrow('path would escape output directory');
  });
});
```

## Related Files

- Implementation: `src/services/file-writer.ts:71-107`
- Tests: `tests/unit/file-writer.test.ts:42-50`
- Planning: `docs/PHASE_3_2.md:448-481`

## References

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [Node.js path.resolve() documentation](https://nodejs.org/api/path.html#path_path_resolve_paths)
- [GitHub Security Review PR #23](https://github.com/alvincrespo/hashnode-content-converter/pull/23)

## Revision History

- **2025-11-06**: Initial document created based on PR review feedback
- **Status**: Decision to keep current implementation for CLI tool use case

## Summary

The current `includes('..')` check is **intentionally conservative** for a CLI tool with a low threat model. While the reviewer's path resolution approach is technically superior and would be **required for a web service**, the current implementation is appropriate given:

1. Trusted input source (user's own Hashnode export)
2. Negligible false positive rate in practice
3. Defense-in-depth with multiple validation layers
4. Simplicity and maintainability

**Action Required**: If this tool is ever exposed as a web service or processes untrusted third-party input, **immediately implement the path resolution approach** documented in this file.
