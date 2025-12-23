# TypeScript 2025 Conventions Migration Plan

**Document Version**: 1.0
**Created**: 2025-01-06
**Project**: @alvincrespo/hashnode-content-converter
**Status**: Draft - Awaiting Review

---

## Executive Summary

This document outlines a comprehensive migration plan to align the `@alvincrespo/hashnode-content-converter` package with 2025 TypeScript best practices and modern Node.js standards. The codebase is already following many current conventions (kebab-case naming, Vitest testing, strict TypeScript), but there are strategic opportunities to improve developer experience, future-proof the package, and align with ecosystem standards.

### Goals
- **Improve Developer Experience**: Better IDE support, clearer imports, enhanced type safety
- **Future-Proof**: Prepare for ESM-first ecosystem while maintaining backward compatibility
- **Align with Ecosystem**: Follow patterns used by modern TypeScript libraries
- **Maintain Stability**: No breaking changes for current users without clear migration paths

### Migration Strategy
Changes are categorized by priority and can be implemented incrementally:
- **HIGH**: Critical improvements with immediate DX impact
- **MEDIUM**: Modernization that prepares for future ecosystem shifts
- **LOW**: Optional enhancements for developer convenience

---

## Current State Assessment

### ✅ Already Following Best Practices
- Kebab-case file naming
- Vitest testing framework with V8 coverage
- Strict TypeScript configuration
- Clear directory structure (processors/services/types)
- Minimal production dependencies
- Comprehensive type definitions

### ⚠️ Areas for Improvement
- Missing `exports` field in package.json
- Using namespace imports (`import * as fs`) instead of `node:` protocol
- CommonJS-only distribution (no ESM option)
- Type-aware linting not enabled
- ES2020 target instead of ES2022+
- Limited JSDoc on public APIs

---

## HIGH PRIORITY ITEMS

Critical improvements with significant DX impact and future-proofing benefits.

---

### HP-1: Add `exports` Field to package.json

**Priority**: HIGH
**Effort**: Low (30 minutes)
**Breaking Changes**: None (backward compatible)
**Dependencies**: None

#### Current State
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

#### Target State
```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  }
}
```

#### Why This Matters
- **Prevents Deep Imports**: Users can only import from public API (`@alvincrespo/hashnode-content-converter`), not internal paths
- **Future ESM Support**: Prepares for dual-format publishing (Phase 2)
- **Better IDE Support**: Modern IDEs use `exports` for auto-import suggestions
- **Node.js Recommendation**: Official Node.js best practice since v12.7.0

#### Implementation Steps

1. **Update package.json**
   ```bash
   # Edit package.json
   ```

   Add the `exports` field as shown in Target State above. Initially, point both `require` and `import` to the same `.js` file since we're still CJS-only.

2. **Validate the change**
   ```bash
   # Test that imports still work
   npm run build
   node -e "const pkg = require('./dist/index.js'); console.log(pkg)"

   # Test that deep imports are blocked
   node -e "try { require('@alvincrespo/hashnode-content-converter/dist/services/logger'); } catch(e) { console.log('✓ Deep imports blocked'); }"
   ```

3. **Update documentation**
   - Add note to README.md about public API exports
   - Document that internal paths are not part of the public API

#### Validation Checklist
- [ ] Package builds successfully
- [ ] Main entry point (`dist/index.js`) is still importable
- [ ] Deep imports are blocked (expected behavior)
- [ ] TypeScript type definitions resolve correctly
- [ ] CLI bin still works (`hashnode-converter --help`)

#### Rollback Procedure
Remove the `exports` field from package.json and rebuild.

#### References
- [Node.js Package Entry Points](https://nodejs.org/api/packages.html#package-entry-points)
- [TypeScript Package.json Exports](https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports)

---

### HP-2: Migrate to `node:` Protocol for Built-in Imports

**Priority**: HIGH
**Effort**: Medium (1-2 hours)
**Breaking Changes**: None (internal refactor only)
**Dependencies**: None

#### Current State
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
```

#### Target State
```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { get } from 'node:https';
```

#### Why This Matters
- **Clarity**: Clearly distinguishes Node.js built-ins from npm packages
- **Bundler Compatibility**: Modern bundlers recognize `node:` and handle externalization correctly
- **ESM Requirement**: Required when migrating to ESM (Phase 2)
- **IDE Support**: Better auto-completion and documentation in modern IDEs
- **Official Recommendation**: Node.js best practice since v16.0.0

#### Implementation Steps

1. **Create migration script** (optional but recommended)
   ```bash
   # Create scripts/migrate-node-imports.sh
   cat > scripts/migrate-node-imports.sh << 'EOF'
   #!/bin/bash
   # Migrate Node.js built-in imports to node: protocol

   find src tests -name "*.ts" -type f -exec sed -i '' \
     -e "s/from 'fs'/from 'node:fs'/g" \
     -e "s/from 'path'/from 'node:path'/g" \
     -e "s/from 'https'/from 'node:https'/g" \
     -e "s/from 'stream'/from 'node:stream'/g" \
     -e "s/from 'events'/from 'node:events'/g" \
     {} +
   EOF

   chmod +x scripts/migrate-node-imports.sh
   ```

2. **Manually refactor imports** (recommended for accuracy)

   Files to update:
   - `src/services/image-downloader.ts`
   - `src/services/file-writer.ts`
   - `src/services/logger.ts`
   - `src/processors/*.ts` (when implemented)
   - `tests/**/*.test.ts`

   For each file:
   ```typescript
   // Before
   import * as fs from 'fs';
   import * as path from 'path';

   // After - prefer named imports
   import { writeFile, mkdir } from 'node:fs/promises';
   import { join, dirname } from 'node:path';
   ```

3. **Convert namespace imports to named imports**

   This is a good opportunity to modernize from `import * as` to specific named imports:

   ```typescript
   // Before
   import * as fs from 'fs';
   fs.promises.writeFile(...)

   // After
   import { writeFile } from 'node:fs/promises';
   writeFile(...)
   ```

4. **Update test mocks**
   ```typescript
   // In tests/unit/*.test.ts
   // Before
   vi.mock('https');

   // After
   vi.mock('node:https');
   ```

#### File-by-File Migration Guide

**src/services/image-downloader.ts**
```typescript
// Current imports
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

// New imports
import { get, RequestOptions } from 'node:https';
import { createWriteStream } from 'node:fs';
import { dirname } from 'node:path';

// Update references
// https.get() → get()
// fs.createWriteStream() → createWriteStream()
// path.dirname() → dirname()
```

**src/services/file-writer.ts**
```typescript
// Current imports
import * as fs from 'fs';
import * as path from 'path';

// New imports
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// Update references accordingly
```

**src/services/logger.ts**
```typescript
// Current imports
import * as fs from 'fs';
import * as path from 'path';

// New imports
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
```

**tests/mocks/mocks.ts**
```typescript
// Update all mocks
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
// etc.
```

5. **Run tests**
   ```bash
   npm run type-check
   npm test
   ```

6. **Run build**
   ```bash
   npm run build
   ```

#### Validation Checklist
- [ ] All imports use `node:` prefix for built-ins
- [ ] Type-checking passes
- [ ] All tests pass
- [ ] Build completes successfully
- [ ] No `import * as` statements for Node.js built-ins (converted to named imports)

#### Common Pitfalls
- **Mock paths in tests**: Remember to update `vi.mock('fs')` to `vi.mock('node:fs')`
- **Type imports**: TypeScript may auto-import without `node:` prefix - manually fix
- **IDE auto-imports**: Configure IDE to prefer `node:` protocol

#### Rollback Procedure
1. Revert changes using git: `git checkout -- src/ tests/`
2. Run tests to confirm rollback: `npm test`

#### References
- [Node.js ES Modules - node: Imports](https://nodejs.org/api/esm.html#node-imports)
- [Node.js Best Practices - Import Protocol](https://github.com/goldbergyoni/nodebestpractices#-61-prefer-native-js-methods-over-user-land-utils-like-lodash)

---

### HP-3: Enable Type-Aware ESLint Linting

**Priority**: HIGH
**Effort**: Medium (1-2 hours)
**Breaking Changes**: May reveal new linting errors requiring fixes
**Dependencies**: None

#### Current State
```javascript
// eslint.config.mjs - basic TypeScript linting
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended
);
```

#### Target State
```javascript
// eslint.config.mjs - type-aware linting
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

#### Why This Matters
- **Catch Type-Level Bugs**: Detects issues like `Promise<T>` used without `await`, unsafe type assertions, nullable reference bugs
- **Beyond `strict` Mode**: Finds bugs that TypeScript's strict mode misses
- **Prevent Runtime Errors**: Catches common mistakes like mismatched promise handling
- **Industry Standard**: Used by major TypeScript projects (Angular, NestJS, etc.)

#### Implementation Steps

1. **Read current ESLint configuration**
   ```bash
   cat eslint.config.mjs
   ```

2. **Update eslint.config.mjs**
   ```javascript
   import eslint from '@eslint/js';
   import tseslint from '@typescript-eslint/eslint-plugin';
   import tsparser from '@typescript-eslint/parser';

   export default [
     eslint.configs.recommended,
     {
       files: ['**/*.ts'],
       plugins: {
         '@typescript-eslint': tseslint,
       },
       languageOptions: {
         parser: tsparser,
         parserOptions: {
           project: './tsconfig.json',
           tsconfigRootDir: import.meta.dirname,
         },
       },
       rules: {
         // Type-aware rules
         '@typescript-eslint/await-thenable': 'error',
         '@typescript-eslint/no-floating-promises': 'error',
         '@typescript-eslint/no-misused-promises': 'error',
         '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
         '@typescript-eslint/prefer-nullish-coalescing': 'warn',
         '@typescript-eslint/prefer-optional-chain': 'warn',
         '@typescript-eslint/require-await': 'warn',
         '@typescript-eslint/no-unsafe-assignment': 'warn',
         '@typescript-eslint/no-unsafe-member-access': 'warn',
         '@typescript-eslint/no-unsafe-call': 'warn',
         '@typescript-eslint/no-unsafe-return': 'warn',
       },
     },
     {
       files: ['**/*.test.ts'],
       rules: {
         // Relax some rules for tests
         '@typescript-eslint/no-unsafe-assignment': 'off',
         '@typescript-eslint/no-unsafe-member-access': 'off',
       },
     },
     {
       ignores: ['dist/', 'coverage/', 'node_modules/', '*.js', '*.mjs'],
     },
   ];
   ```

3. **Add lint script to package.json**
   ```json
   {
     "scripts": {
       "lint": "eslint . --ext .ts",
       "lint:fix": "eslint . --ext .ts --fix"
     }
   }
   ```

4. **Run linting to discover issues**
   ```bash
   npm run lint
   ```

5. **Fix discovered issues**

   Common issues you may encounter:

   **Floating Promises**
   ```typescript
   // Before (error: floating promise)
   async function processImages() {
     images.forEach(img => downloadImage(img)); // ❌
   }

   // After
   async function processImages() {
     await Promise.all(images.map(img => downloadImage(img))); // ✓
   }
   ```

   **Unnecessary Type Assertions**
   ```typescript
   // Before (warning: unnecessary assertion)
   const value = someFunction() as string; // TypeScript already knows it's string

   // After
   const value = someFunction(); // ✓
   ```

   **Missing await**
   ```typescript
   // Before (error: await-thenable)
   async function foo() {
     const result = asyncFunction(); // ❌ returns Promise<T>
     return result;
   }

   // After
   async function foo() {
     const result = await asyncFunction(); // ✓ returns T
     return result;
   }
   ```

6. **Update CI/CD** (if applicable)
   ```yaml
   # .github/workflows/ci.yml
   - name: Lint
     run: npm run lint
   ```

#### Validation Checklist
- [ ] ESLint runs without errors
- [ ] Type-aware rules are active (verify by checking rule output)
- [ ] All discovered issues are fixed or explicitly disabled with justification
- [ ] Tests still pass
- [ ] Build completes successfully

#### Performance Considerations
Type-aware linting is slower because it requires TypeScript compilation. For large projects:
- Consider running only on pre-commit hooks
- Use `--cache` flag for faster subsequent runs
- Exclude test files if linting becomes too slow

#### Rollback Procedure
1. Revert `eslint.config.mjs` to previous version
2. Remove added lint scripts from package.json

#### References
- [typescript-eslint Type-Aware Linting](https://typescript-eslint.io/getting-started/typed-linting)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)

---

## MEDIUM PRIORITY ITEMS

Modernization improvements that prepare for ecosystem shifts and improve long-term maintainability.

---

### MP-1: Migrate to Dual-Format Publishing (ESM + CJS)

**Priority**: MEDIUM
**Effort**: High (4-8 hours)
**Breaking Changes**: None if done correctly (dual-format maintains CJS compatibility)
**Dependencies**: Requires HP-1 (exports field) and HP-2 (node: imports)

#### Current State
- CommonJS-only output (`"module": "commonjs"`)
- `.js` files in `dist/`
- CJS consumers only

#### Target State
- Dual-format output (ESM + CJS)
- `.mjs` files for ESM, `.cjs` files for CJS
- Both ESM and CJS consumers supported
- `"type": "module"` in package.json
- Source code uses ESM syntax

#### Why This Matters
- **Ecosystem Shift**: npm ecosystem is moving to ESM-first (Vite, Next.js 13+, etc.)
- **Tree Shaking**: ESM enables better dead code elimination in bundlers
- **Future-Proof**: Node.js 18+ has stable ESM support, CJS is legacy
- **Modern Tooling**: Many tools default to ESM (Vitest already supports it)
- **Top-Level Await**: Enables modern async patterns without IIFE wrappers

#### Migration Strategy
This is a complex migration. We'll use a phased approach:

**Phase 1**: Prepare Source Code (Low Risk)
**Phase 2**: Configure Build for Dual Output (Medium Risk)
**Phase 3**: Test and Publish (High Risk)

#### Phase 1: Prepare Source Code

1. **Update package.json**
   ```json
   {
     "type": "module",
     "main": "./dist/index.cjs",
     "module": "./dist/index.mjs",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "types": "./dist/index.d.ts",
         "import": "./dist/index.mjs",
         "require": "./dist/index.cjs"
       },
       "./package.json": "./package.json"
     }
   }
   ```

2. **Ensure all imports use `node:` protocol**
   - This is required for ESM
   - Already completed in HP-2

3. **Update file extensions in source code**
   - Rename test files: `*.test.ts` → keep as `.ts` (Vitest handles this)
   - Update relative imports to include `.js` extension:

   ```typescript
   // Before
   import { Converter } from './converter';

   // After (ESM requires explicit extensions)
   import { Converter } from './converter.js';
   ```

   **Note**: Use `.js` extension even though files are `.ts`. TypeScript will resolve correctly.

4. **Update all relative imports**

   Files to update:
   ```bash
   # Find all imports without extensions
   grep -r "from '\\./" src/ --include="*.ts" | grep -v "\.js'"
   ```

   Add `.js` extension to all relative imports:
   ```typescript
   // src/converter.ts
   import { PostParser } from './processors/post-parser.js';
   import { ImageProcessor } from './processors/image-processor.js';
   import { ConversionOptions } from './types/converter-options.js';
   ```

#### Phase 2: Configure Dual-Format Build

5. **Install build tool for dual-format output**
   ```bash
   npm install --save-dev tsup
   ```

6. **Create tsup.config.ts**
   ```typescript
   import { defineConfig } from 'tsup';

   export default defineConfig({
     entry: ['src/index.ts', 'src/cli/convert.ts'],
     format: ['esm', 'cjs'],
     dts: true,
     splitting: false,
     sourcemap: true,
     clean: true,
     outExtension({ format }) {
       return {
         js: format === 'esm' ? '.mjs' : '.cjs',
       };
     },
   });
   ```

7. **Update build scripts in package.json**
   ```json
   {
     "scripts": {
       "build": "tsup",
       "dev": "tsup --watch",
       "type-check": "tsc --noEmit"
     }
   }
   ```

8. **Update tsconfig.json for ESM**
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "esModuleInterop": true,
       "allowSyntheticDefaultImports": true
     }
   }
   ```

#### Phase 3: Test Dual-Format Output

9. **Build both formats**
   ```bash
   npm run build
   ```

   Verify output:
   ```bash
   ls -la dist/
   # Expected:
   # index.mjs       (ESM)
   # index.cjs       (CJS)
   # index.d.ts      (TypeScript declarations)
   # cli/convert.mjs
   # cli/convert.cjs
   ```

10. **Test ESM consumption**
    ```bash
    # Create test file
    cat > test-esm.mjs << 'EOF'
    import { Converter } from './dist/index.mjs';
    console.log('ESM import works:', typeof Converter);
    EOF

    node test-esm.mjs
    ```

11. **Test CJS consumption**
    ```bash
    # Create test file
    cat > test-cjs.cjs << 'EOF'
    const { Converter } = require('./dist/index.cjs');
    console.log('CJS require works:', typeof Converter);
    EOF

    node test-cjs.cjs
    ```

12. **Update CLI shebang**
    ```bash
    # dist/cli/convert.mjs should have:
    #!/usr/bin/env node

    # dist/cli/convert.cjs should have:
    #!/usr/bin/env node
    ```

13. **Test CLI in both formats**
    ```bash
    node dist/cli/convert.mjs --help
    node dist/cli/convert.cjs --help
    ```

14. **Run full test suite**
    ```bash
    npm run type-check
    npm test
    npm run build
    ```

#### Validation Checklist
- [ ] Source code uses ESM syntax (import/export)
- [ ] All relative imports have `.js` extensions
- [ ] `node:` protocol used for all built-ins
- [ ] Build produces both `.mjs` and `.cjs` files
- [ ] Both formats are consumable (tested manually)
- [ ] CLI works with both formats
- [ ] Type definitions (`.d.ts`) are generated
- [ ] All tests pass
- [ ] Package.json `exports` correctly maps both formats
- [ ] No breaking changes for existing CJS consumers

#### Common Pitfalls

**File Extensions in Imports**
```typescript
// ❌ Wrong - will fail at runtime in ESM
import { Foo } from './foo';

// ✓ Correct - explicit .js extension
import { Foo } from './foo.js';
```

**__dirname in ESM**
```typescript
// ❌ Wrong - __dirname not available in ESM
const dir = __dirname;

// ✓ Correct - use import.meta
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
```

**Dynamic Imports**
```typescript
// CJS
const mod = require('./dynamic');

// ESM
const mod = await import('./dynamic.js');
```

#### Rollback Procedure
1. Revert package.json changes
2. Remove `tsup.config.ts`
3. Restore original build scripts
4. Remove `.js` extensions from imports
5. Rebuild: `npm run build`

#### Alternative: Keep CommonJS
If ESM migration proves too complex or risky:
- Keep `"module": "commonjs"`
- Focus on other high/medium priority items
- Revisit ESM in 6-12 months when ecosystem stabilizes further

#### References
- [TypeScript ESM Handbook](https://www.typescriptlang.org/docs/handbook/modules/theory.html#the-ecmascript-module-standard)
- [Node.js Dual Package Hazard](https://nodejs.org/api/packages.html#dual-package-hazard)
- [tsup Documentation](https://tsup.egoist.dev/)
- [Pure ESM Package Guide](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

---

### MP-2: Upgrade TypeScript Target to ES2022

**Priority**: MEDIUM
**Effort**: Low (30 minutes)
**Breaking Changes**: None (ES2022 is supported by Node.js 18+)
**Dependencies**: None

#### Current State
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"]
  }
}
```

#### Target State
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "verbatimModuleSyntax": true
  }
}
```

#### Why This Matters
- **Modern Language Features**: Access to class fields, top-level await, `.at()` method, etc.
- **Native Support**: Node.js 18+ natively supports ES2022
- **Better Performance**: Native features are faster than transpiled equivalents
- **Smaller Output**: Less transpilation = smaller bundle size
- **`verbatimModuleSyntax`**: Enforces explicit `import type` for type-only imports (better tree-shaking)

#### ES2022 Features You'll Gain

**Top-Level Await**
```typescript
// ES2022 - no IIFE wrapper needed
const data = await fetchConfig();
export const config = processConfig(data);
```

**Class Fields**
```typescript
// ES2022 - native class fields
class Logger {
  private logFile = './logs/app.log'; // ✓ Native
  #privateField = 'secret'; // ✓ Native private fields
}
```

**Array.at() Method**
```typescript
// ES2022 - cleaner negative indexing
const last = array.at(-1); // Instead of array[array.length - 1]
```

**Error.cause**
```typescript
// ES2022 - better error chaining
throw new Error('Download failed', { cause: originalError });
```

#### Implementation Steps

1. **Update tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2022"],
       "module": "commonjs",
       "verbatimModuleSyntax": true,
       // ... rest of config
     }
   }
   ```

2. **Update tsconfig.build.json**
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2022"]
     },
     "exclude": ["node_modules", "dist", "tests", "vitest.config.ts", "**/*.test.ts"]
   }
   ```

3. **Add explicit type imports** (if using `verbatimModuleSyntax`)
   ```typescript
   // Before
   import { ConversionOptions, ConversionResult } from './types';

   // After - separate type-only imports
   import type { ConversionOptions, ConversionResult } from './types';
   import { Converter } from './converter';
   ```

   Or use inline syntax:
   ```typescript
   import { type ConversionOptions, Converter } from './types';
   ```

4. **Run type-check**
   ```bash
   npm run type-check
   ```

   If you see errors like:
   ```
   'X' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled
   ```

   Fix by adding `import type` or `type` prefix as shown above.

5. **Run tests**
   ```bash
   npm test
   ```

6. **Build**
   ```bash
   npm run build
   ```

7. **Verify Node.js compatibility**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

#### Optional: Adopt ES2022 Features

**Refactor to use top-level await** (if migrating to ESM)
```typescript
// src/cli/convert.ts
// Before
async function main() {
  const result = await converter.convert();
  console.log(result);
}
main().catch(console.error);

// After (ES2022 + ESM)
const result = await converter.convert();
console.log(result);
```

**Use `.at()` for array access**
```bash
# Find candidates for refactoring
grep -r "\[.*length - 1\]" src/ --include="*.ts"
```

```typescript
// Before
const lastItem = items[items.length - 1];

// After (ES2022)
const lastItem = items.at(-1);
```

**Use Error.cause for better error tracking**
```typescript
// In error handling code
try {
  await downloadImage(url);
} catch (error) {
  throw new Error(`Failed to download ${url}`, { cause: error });
}
```

#### Validation Checklist
- [ ] tsconfig.json updated to ES2022
- [ ] Type-checking passes
- [ ] All tests pass
- [ ] Build completes successfully
- [ ] If using `verbatimModuleSyntax`, all type imports are explicit
- [ ] Output code runs on Node.js 18+ without issues

#### Rollback Procedure
Revert tsconfig.json and tsconfig.build.json to ES2020:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"]
  }
}
```

Remove `verbatimModuleSyntax` if it causes issues.

#### References
- [TypeScript 5.0 - verbatimModuleSyntax](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#verbatimmodulesyntax)
- [ES2022 Features](https://2ality.com/2022/06/ecmascript-2022.html)
- [Node.js ES2022 Support](https://node.green/#ES2022)

---

### MP-3: Add JSDoc to Public API Exports

**Priority**: MEDIUM
**Effort**: Medium (2-3 hours)
**Breaking Changes**: None (documentation only)
**Dependencies**: None

#### Current State
Minimal or no JSDoc comments on public exports in `src/index.ts` and exported classes.

#### Target State
Comprehensive JSDoc on all public APIs for better IDE IntelliSense and auto-generated documentation.

#### Why This Matters
- **Developer Experience**: Users get inline documentation in their IDE
- **API Discoverability**: Users understand available options without reading source
- **Generated Docs**: Enables tools like TypeDoc to generate API documentation
- **Type Annotations**: JSDoc supplements TypeScript types with descriptions

#### Implementation Steps

1. **Install TypeDoc** (optional, for doc generation)
   ```bash
   npm install --save-dev typedoc
   ```

2. **Add documentation script**
   ```json
   {
     "scripts": {
       "docs": "typedoc src/index.ts --out docs/api"
     }
   }
   ```

3. **Document main entry point** (`src/index.ts`)
   ```typescript
   /**
    * @packageDocumentation
    * @module @alvincrespo/hashnode-content-converter
    *
    * Converts Hashnode blog exports to framework-agnostic Markdown with YAML frontmatter.
    *
    * @example
    * ```typescript
    * import { Converter } from '@alvincrespo/hashnode-content-converter';
    *
    * const converter = new Converter();
    * const result = await converter.convertAllPosts('./export.json', './output');
    * console.log(`Converted ${result.converted} posts`);
    * ```
    */

   export { Converter } from './converter.js';
   export * from './types/hashnode-schema.js';
   export * from './types/converter-options.js';
   export * from './types/conversion-result.js';
   ```

4. **Document Converter class** (`src/converter.ts`)
   ```typescript
   /**
    * Main orchestrator for converting Hashnode blog exports to Markdown.
    *
    * Coordinates the entire conversion pipeline:
    * - Parsing Hashnode posts
    * - Transforming markdown
    * - Downloading images
    * - Generating frontmatter
    * - Writing output files
    *
    * @example
    * ```typescript
    * const converter = new Converter({
    *   skipExisting: true,
    *   downloadDelayMs: 500
    * });
    *
    * const result = await converter.convertAllPosts(
    *   './hashnode-export.json',
    *   './blog-posts'
    * );
    * ```
    */
   export class Converter {
     /**
      * Creates a new Converter instance.
      *
      * @param options - Configuration options for the conversion process
      */
     constructor(private options?: ConversionOptions) {}

     /**
      * Converts all posts from a Hashnode export file.
      *
      * @param exportPath - Path to the Hashnode export JSON file
      * @param outputDir - Directory where converted posts will be written
      * @returns Summary of the conversion including counts and errors
      *
      * @throws {Error} If export file doesn't exist or is invalid JSON
      *
      * @example
      * ```typescript
      * const result = await converter.convertAllPosts(
      *   './my-blog-export.json',
      *   './posts'
      * );
      * console.log(`Success: ${result.converted}, Failed: ${result.errors.length}`);
      * ```
      */
     async convertAllPosts(
       exportPath: string,
       outputDir: string
     ): Promise<ConversionResult> {
       // Implementation
     }
   }
   ```

5. **Document interfaces** (`src/types/converter-options.ts`)
   ```typescript
   /**
    * Configuration options for image downloading.
    */
   export interface ImageDownloadOptions {
     /**
      * Delay in milliseconds between image downloads to avoid rate limiting.
      * @default 100
      */
     downloadDelayMs?: number;

     /**
      * Number of retry attempts for failed downloads.
      * @default 3
      */
     maxRetries?: number;

     /**
      * Timeout in milliseconds for each download attempt.
      * @default 30000
      */
     timeoutMs?: number;
   }

   /**
    * Configuration options for the Logger service.
    */
   export interface LoggerConfig {
     /**
      * Directory where log files will be written.
      * @default './logs'
      */
     logDir?: string;

     /**
      * Base name for the log file.
      * @default 'conversion.log'
      */
     logFileName?: string;

     /**
      * Whether to output logs to console in addition to file.
      * @default true
      */
     consoleOutput?: boolean;
   }

   /**
    * Main configuration options for the conversion process.
    */
   export interface ConversionOptions {
     /**
      * Skip conversion if output file already exists.
      * @default false
      */
     skipExisting?: boolean;

     /**
      * Options for image downloading behavior.
      */
     imageOptions?: ImageDownloadOptions;

     /**
      * Options for logging configuration.
      */
     loggerConfig?: LoggerConfig;
   }
   ```

6. **Document result types** (`src/types/conversion-result.ts`)
   ```typescript
   /**
    * Result of a single post conversion attempt.
    */
   export interface PostConversionResult {
     /**
      * Slug of the post that was converted.
      */
     slug: string;

     /**
      * Whether the conversion was successful.
      */
     success: boolean;

     /**
      * Error message if conversion failed.
      */
     error?: string;
   }

   /**
    * Summary result of converting all posts.
    */
   export interface ConversionResult {
     /**
      * Number of posts successfully converted.
      */
     converted: number;

     /**
      * Number of posts skipped (e.g., already exist).
      */
     skipped: number;

     /**
      * Array of errors that occurred during conversion.
      */
     errors: Array<{
       /** Slug of the post that failed */
       slug: string;
       /** Error message */
       message: string;
     }>;

     /**
      * Total time taken for conversion in milliseconds.
      */
     durationMs: number;
   }
   ```

7. **Document service classes**

   **ImageDownloader** (`src/services/image-downloader.ts`)
   ```typescript
   /**
    * Downloads images from URLs with retry logic and error handling.
    *
    * Handles transient network failures by retrying downloads and
    * tracks permanent failures (like HTTP 403) separately.
    */
   export class ImageDownloader {
     /**
      * Downloads a single image from a URL to a local file path.
      *
      * @param url - The URL of the image to download
      * @param outputPath - Local filesystem path where image will be saved
      * @returns Result indicating success/failure and HTTP status
      *
      * @example
      * ```typescript
      * const downloader = new ImageDownloader({ maxRetries: 3 });
      * const result = await downloader.download(
      *   'https://cdn.hashnode.com/res/image.png',
      *   './images/image.png'
      * );
      * if (result.success) {
      *   console.log('Downloaded successfully');
      * }
      * ```
      */
     async download(url: string, outputPath: string): Promise<DownloadResult> {
       // Implementation
     }
   }
   ```

8. **Generate documentation**
   ```bash
   npm run docs
   ```

   This creates `docs/api/` with HTML documentation.

9. **Add to .gitignore**
   ```
   # Generated documentation
   docs/api/
   ```

#### JSDoc Best Practices

**DO**:
- Document all public exports
- Include `@example` for non-obvious usage
- Use `@default` for optional parameters
- Add `@throws` for error conditions
- Use `@deprecated` for deprecated APIs

**DON'T**:
- Document private/internal methods (unless complex)
- Repeat information already in type signatures
- Write novels - keep descriptions concise
- Over-document obvious parameters

#### Validation Checklist
- [ ] All public classes have JSDoc
- [ ] All public methods have JSDoc
- [ ] All interfaces have JSDoc
- [ ] All interface properties have JSDoc
- [ ] At least one `@example` per major class/function
- [ ] TypeDoc generates docs without errors (if using TypeDoc)
- [ ] IDE shows helpful tooltips when hovering over exports

#### Testing JSDoc
Create a test file to verify IDE experience:
```typescript
// test-jsdoc.ts
import { Converter, ConversionOptions } from '@alvincrespo/hashnode-content-converter';

const options: ConversionOptions = {
  // Hover over properties - should see descriptions
  skipExisting: true,
};

const converter = new Converter(options);
// Hover over convertAllPosts - should see full documentation
converter.convertAllPosts('./export.json', './output');
```

#### Rollback Procedure
No rollback needed - JSDoc is additive and doesn't affect runtime behavior.

#### References
- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [TSDoc Standard](https://tsdoc.org/)
- [TypeDoc Documentation](https://typedoc.org/)

---

## LOW PRIORITY ITEMS

Optional enhancements that improve developer experience but are not critical.

---

### LP-1: Add tsup for Optimized Builds

**Priority**: LOW
**Effort**: Low (1 hour)
**Breaking Changes**: None (changes build output only)
**Dependencies**: None (but pairs well with MP-1 for dual-format)

#### Current State
Using TypeScript compiler (tsc) directly for builds.

#### Target State
Using tsup for faster builds, automatic minification, and dual-format support.

#### Why This Matters
- **Zero Config**: Sensible defaults for TypeScript libraries
- **Faster Builds**: Uses esbuild internally (10-100x faster than tsc)
- **Dual Format**: Easy ESM + CJS output (useful for MP-1)
- **Minification**: Optional production optimizations
- **DTS Bundling**: Can bundle all `.d.ts` files into single file

#### Implementation Steps

1. **Install tsup**
   ```bash
   npm install --save-dev tsup
   ```

2. **Create tsup.config.ts**
   ```typescript
   import { defineConfig } from 'tsup';

   export default defineConfig({
     entry: ['src/index.ts', 'src/cli/convert.ts'],
     format: ['cjs'], // Start with CJS only
     dts: true, // Generate .d.ts files
     splitting: false,
     sourcemap: true,
     clean: true,
     minify: false, // Keep readable for npm package
     target: 'node18',
     outDir: 'dist',
   });
   ```

3. **Update package.json scripts**
   ```json
   {
     "scripts": {
       "build": "tsup",
       "build:watch": "tsup --watch",
       "type-check": "tsc --noEmit"
     }
   }
   ```

4. **Build and test**
   ```bash
   npm run build
   npm test
   ```

5. **Verify output**
   ```bash
   ls -la dist/
   # Should see same structure as before but potentially faster build times
   ```

#### Benefits Over tsc

| Feature | tsc | tsup |
|---------|-----|------|
| Build Speed | Baseline | 10-100x faster |
| Minification | No | Yes (optional) |
| Dual Format | No | Yes (ESM + CJS) |
| DTS Bundling | No | Yes |
| Watch Mode | Yes | Yes |
| Type Checking | Yes | No (use tsc --noEmit) |

#### When NOT to Use tsup
- If you need incremental builds (tsc's `--incremental` flag)
- If you have complex TypeScript project references
- If build speed is already fast enough

#### Validation Checklist
- [ ] Build completes successfully
- [ ] Output files identical to tsc output (or better)
- [ ] CLI still works
- [ ] Tests pass
- [ ] Type definitions generated correctly
- [ ] Build time improved (measure with `time npm run build`)

#### Rollback Procedure
1. Remove tsup from devDependencies
2. Delete tsup.config.ts
3. Restore original build scripts in package.json

#### References
- [tsup Documentation](https://tsup.egoist.dev/)
- [esbuild Performance](https://esbuild.github.io/)

---

## Migration Order and Dependencies

To minimize risk and maximize success, implement changes in this order:

### Phase 1: Quick Wins (1-2 hours)
1. **HP-1**: Add `exports` field ✓ Low risk, immediate benefits
2. **MP-2**: Upgrade to ES2022 ✓ Low risk, enables modern features
3. **LP-1**: Add tsup (optional) ✓ Low risk, faster builds

### Phase 2: Code Quality (2-4 hours)
4. **HP-2**: Migrate to `node:` imports ✓ Medium risk, required for ESM
5. **HP-3**: Enable type-aware linting ✓ Medium risk, may reveal bugs

### Phase 3: Documentation (2-3 hours)
6. **MP-3**: Add JSDoc comments ✓ No risk, improves DX

### Phase 4: Major Migration (4-8 hours) - OPTIONAL
7. **MP-1**: ESM dual-format ✓ High risk, significant effort

**Recommended Timeline**:
- Week 1: Phase 1 + Phase 2 (HP items)
- Week 2: Phase 3 (Documentation)
- Week 3+: Evaluate MP-1 (ESM) based on ecosystem needs

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|-----------|------------|
| HP-1: exports field | Low | Backward compatible, easy rollback |
| HP-2: node: imports | Medium | Comprehensive testing, update mocks |
| HP-3: Type-aware lint | Medium | Fix issues incrementally, can disable rules |
| MP-1: ESM migration | High | Phased approach, dual-format maintains compat |
| MP-2: ES2022 target | Low | Node 18+ already supports it |
| MP-3: JSDoc | None | Documentation only, no code changes |
| LP-1: tsup | Low | Doesn't change output, easy rollback |

---

## Testing Strategy for All Changes

After each migration step:

1. **Type Check**
   ```bash
   npm run type-check
   ```

2. **Run Tests**
   ```bash
   npm test
   npm run test:coverage
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Verify CLI**
   ```bash
   node dist/cli/convert.js --help
   ```

5. **Manual Import Test**
   ```bash
   # Create test file
   cat > test-import.js << 'EOF'
   const pkg = require('./dist/index.js');
   console.log('Exported:', Object.keys(pkg));
   EOF

   node test-import.js
   rm test-import.js
   ```

6. **Check Package Integrity**
   ```bash
   npm pack --dry-run
   ```

---

## Compatibility Matrix

| Runtime | Current | After Migration |
|---------|---------|-----------------|
| Node.js 18+ | ✓ | ✓ |
| Node.js 16 | ✓ | ✓ (ES2022 supported) |
| Node.js 14 | ✓ | ❌ (EOL, ES2022 not supported) |
| TypeScript 5.x | ✓ | ✓ |
| TypeScript 4.x | ✓ | ⚠️ (verbatimModuleSyntax requires 5.0+) |
| ESM Consumers | ❌ | ✓ (after MP-1) |
| CJS Consumers | ✓ | ✓ (maintained) |

---

## Estimated Total Effort

| Priority | Items | Time | Risk |
|----------|-------|------|------|
| HIGH | 3 | 3-5 hours | Low-Medium |
| MEDIUM | 3 | 6-13 hours | Medium-High |
| LOW | 1 | 1 hour | Low |
| **TOTAL** | **7** | **10-19 hours** | **Medium** |

**Recommended Approach**: Implement HIGH priority items (5 hours) first for immediate ROI, then evaluate MEDIUM items based on ecosystem needs.

---

## Success Criteria

After completing this migration plan:

- [ ] Package exports are controlled via `exports` field
- [ ] All Node.js built-ins use `node:` protocol
- [ ] Type-aware linting catches potential bugs
- [ ] Package compiles to ES2022 output
- [ ] Public APIs have comprehensive JSDoc
- [ ] (Optional) Package supports both ESM and CJS consumers
- [ ] No breaking changes for existing users
- [ ] All tests pass with >90% coverage
- [ ] Build performance equal or better
- [ ] Documentation reflects new conventions

---

## Next Steps

1. **Review this document** - Add feedback, modify priorities, adjust timelines
2. **Create GitHub issues** - One issue per section (HP-1, HP-2, etc.)
3. **Assign priorities** - Label as `priority:high`, `priority:medium`, `priority:low`
4. **Implement incrementally** - Follow the migration order above
5. **Update CLAUDE.md** - Reflect new conventions once implemented

---

## Questions for Review

Before proceeding, please consider:

1. **ESM Migration**: Do we want dual-format (MP-1) now, or wait for more ecosystem adoption?
2. **Breaking Changes**: Are we willing to bump to v1.0.0 if any issues arise, or stay on v0.x?
3. **Build Tool**: Keep tsc-only, or adopt tsup for faster builds?
4. **Timeline**: What's the target completion date for HIGH priority items?
5. **Testing**: Any additional test scenarios needed beyond what's documented?

---

## Document Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-06 | Initial draft |

---

**End of Document**
