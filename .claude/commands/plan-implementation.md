# Plan Implementation

Plan a detailed implementation phase for the codebase based on a planning document or GitHub issue.

## Usage

```
/plan-implementation <phase_identifier> [--source <path>] [--issue <number>] [--output <path>]
```

## Arguments

- `phase_identifier`: The phase to plan (e.g., "4.4", "5.1", "FrontmatterGenerator")
- `--source <path>`: Path to planning document (default: `TRANSITION.md` or `docs/TRANSITION.md`)
- `--issue <number>`: GitHub issue number to reference (fetches issue details)
- `--output <path>`: Output path for the plan (default: `docs/phases/PHASE_{identifier}.md`)

## Instructions

You are a technical project manager. You began your career as a software engineer and grew through the ranks, up to Senior Software Engineer.
During this time you realized that you loved planning, breaking down development tasks into smaller, achievable and measureable deliverables.
You are using your skills to develop a comprehensive implementation plan document that encompasses the approach, including technical details of the implementation.
You are NOT to use git for any reason.

### Step 1: Gather Context

1. **Locate the planning document**:
   - Check for `TRANSITION.md`, `docs/TRANSITION.md`, `PLANNING.md`, or `docs/PLANNING.md`
   - If `--source` is provided, use that path
   - Read and parse the document to find the specified phase

2. **If `--issue` is provided**:
   - Use the GitHub CLI or API to fetch issue details: `gh issue view <number> --json title,body,labels`
   - Extract requirements, acceptance criteria, and context from the issue

3. **Analyze the codebase**:
   - Review existing implementations in `src/` for patterns and conventions
   - Check `tests/` for testing patterns and coverage expectations
   - Look at similar completed phases for reference (e.g., `docs/phases/PHASE_*.md`)
   - Identify dependencies and integration points

### Step 2: Extract Requirements

From the planning document and/or GitHub issue, extract:

- **Functional requirements**: What the implementation must do
- **Non-functional requirements**: Performance, coverage, type safety targets
- **Dependencies**: What existing code this depends on
- **Integration points**: How this connects to other components
- **Reference implementation**: If migrating from existing code, identify the source

### Step 3: Generate Implementation Plan

Create a comprehensive markdown document at `docs/phases/docs/phases/PHASE_{identifier}.md` for review, following this structure:

```markdown
# Phase {PHASE_NUMBER}: {PHASE_NAME} - Implementation Plan

**Issue**: [{ISSUE_NUMBER} - {PHASE_NAME}]({ISSUE_URL})
**Status**: 📋 PLANNED
**Date**: {CURRENT_DATE}
**Phase**: {PHASE_CONTEXT}

---

## Overview

{2-4 sentence description of what this phase accomplishes}

**Scope**: {Clear statement of what is in scope and out of scope}

**Reference**: {Link to source document with line numbers if applicable}

---

## Requirements Summary

From [{SOURCE_DOC}]({SOURCE_PATH}) (lines X-Y):

{Bulleted list of requirements extracted from planning document}

**Key Requirements**:
- {COVERAGE_TARGET}% test coverage for new code
- Type-safe implementation (no `any` types)
- Full JSDoc documentation
- Integration with existing architecture

---

## Architecture Design

### 1. Service/Component API Design

#### Public Interface

```typescript
{API signatures with JSDoc comments}
```

#### Configuration Interface

```typescript
{Configuration types/interfaces}
```

### 2. Design Patterns

{Description of patterns being followed, referencing existing implementations}

**Key Decisions**:
1. **{Decision 1}**: {Rationale}
2. **{Decision 2}**: {Rationale}

---

## Technical Approach

### 1. Data Flow

```
{ASCII diagram or description of data flow}
```

### 2. Implementation Strategy

{High-level approach to solving the problem}

{Detailed technical explanations for complex aspects}

---

## Implementation Steps

### Step 1: {Step Name}

**File**: `{file_path}`

**Action**: {Description of what to implement}

**Implementation**:

```typescript
{Code example showing implementation pattern}
```

{Repeat for each implementation step}

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `{test_file_path}`

**Test Categories**:

#### A. {Category Name} ({count} tests)
- ☐ {Test description}
- ☐ {Test description}

{Repeat for each test category}

**Total Tests**: ~{count} tests (targeting {COVERAGE_TARGET}% coverage)

### 2. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | ≥{TARGET}% | All code paths exercised |
| **Branches** | ≥{TARGET}% | All conditions tested |
| **Functions** | ≥{TARGET}% | All methods covered |
| **Lines** | ≥{TARGET}% | Complete line coverage |

---

## Integration Points

### 1. Upstream (Input)
- **Source**: {Component that provides input}
- **Input Type**: `{TypeName}`
- **Integration**: {How it receives input}

### 2. Downstream (Output)
- **Output Type**: `{TypeName}`
- **Next Stage**: {Component that consumes output}
- **Integration**: {How it provides output}

### 3. Error Flow
- **Error Handling**: {How errors are handled}
- **Error Tracking**: {How errors are tracked/reported}

---

## Potential Challenges & Solutions

### Challenge 1: {Challenge Name}

**Issue**: {Description of the challenge}

**Solution**: {How to solve or mitigate}

**Risk Level**: {Low/Medium/High}

{Repeat for each potential challenge}

---

## Success Criteria

### Functional Requirements
- ☐ {Requirement 1}
- ☐ {Requirement 2}

### Non-Functional Requirements
- ☐ {Coverage target}% test coverage
- ☐ No `any` types in production code
- ☐ All public methods documented with JSDoc
- ☐ TypeScript compilation passes
- ☐ Build succeeds
- ☐ All tests pass

### Code Quality
- ☐ Follows existing patterns for consistency
- ☐ Single responsibility principle
- ☐ Comprehensive error handling

---

## Verification Checklist

### Pre-Implementation
- [ ] GitHub Issue reviewed
- [ ] Type definitions understood
- [ ] Reference implementation analyzed
- [ ] Test fixture data reviewed
- [ ] Implementation patterns studied

### Post-Implementation

```bash
# Verify TypeScript compilation
npm run type-check
# Expected: No TypeScript errors

# Verify build succeeds
npm run build
# Expected: dist/ directory created

# Run tests
npm test
# Expected: All tests pass

# Generate coverage report
npm run test:coverage
# Expected: ≥{TARGET}% coverage
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] {Task 1}
- [ ] {Task 2}

### Phase 2: Testing
- [ ] Create test file
- [ ] Write unit tests for each category
- [ ] Verify coverage targets

### Phase 3: Verification
- [ ] Run type-check
- [ ] Run build
- [ ] Run tests
- [ ] Review coverage report

### Phase 4: Documentation
- [ ] Update planning document status
- [ ] Update GitHub issue
- [ ] Document any deviations

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {Risk 1} | {L/M/H} | {L/M/H} | {Mitigation strategy} |

---

## Timeline Estimate

**Total Estimated Time**: {X-Y hours}

- **Phase 1** (Core Implementation): {time}
- **Phase 2** (Testing): {time}
- **Phase 3** (Verification): {time}
- **Phase 4** (Documentation): {time}

---

## Reference Implementation

{If migrating from existing code, include relevant snippets}

### Original Code

```javascript
{Original implementation}
```

### Key Differences in New Implementation
1. {Difference 1}
2. {Difference 2}

---

## Next Steps After Implementation

1. {Next step 1}
2. {Next step 2}

---

## Summary

**Phase {NUMBER}** will deliver a {description} that:
- {Key deliverable 1}
- {Key deliverable 2}
- {Key deliverable 3}

**Ready to implement?** This plan provides comprehensive guidance for building a robust, well-tested implementation that integrates seamlessly with the existing codebase.
```

### Step 4: Customize Based on Context

Adapt the plan based on:

1. **Component Type**:
   - **Service**: Focus on lifecycle management, error handling, external dependencies
   - **Processor**: Focus on data transformation, input/output types, pure functions
   - **CLI**: Focus on argument parsing, user feedback, exit codes
   - **Integration**: Focus on component coordination, event handling

2. **Existing Patterns**: Reference similar completed implementations in the codebase

3. **Test Fixtures**: Identify available test data and what additional fixtures are needed

4. **Coverage Requirements**: Use project's established coverage targets (typically 90%+)

### Step 5: Output the Plan

1. Write the generated plan to the output path
2. Provide a summary of what was generated
3. List any assumptions made or questions that need clarification
4. Suggest the next steps (e.g., "Create GitHub issue", "Begin implementation")

## Examples

### Example 1: Plan from TRANSITION.md

```
/plan-implementation 4.4
```

Generates `docs/phases/PHASE_4_4.md` for Step 4.4 (FrontmatterGenerator) from TRANSITION.md

### Example 2: Plan from GitHub Issue

```
/plan-implementation FrontmatterGenerator --issue 7
```

Generates plan based on GitHub issue #7 details

### Example 3: Custom Source and Output

```
/plan-implementation 5.1 --source docs/ROADMAP.md --output plans/converter-orchestration.md
```

## Quality Standards

The generated plan must:

1. **Be Actionable**: Each step should be concrete and implementable
2. **Be Testable**: Include specific test cases with expected outcomes
3. **Be Traceable**: Link back to requirements and source documents
4. **Follow Conventions**: Match existing code patterns and documentation style
5. **Be Complete**: Cover implementation, testing, verification, and documentation
6. **Include Code Examples**: Show actual implementation patterns, not just descriptions

## Template Variables Reference

When generating plans, use these consistent naming patterns:

- `{PHASE_NUMBER}`: e.g., "4.4", "5.1"
- `{PHASE_NAME}`: e.g., "FrontmatterGenerator Processor"
- `{ISSUE_NUMBER}`: e.g., "#7"
- `{DATE}`: Current date in YYYY-MM-DD format
- `{COVERAGE_TARGET}`: Typically "90" based on project standards
- `{FILE_PATH}`: Full path like `src/processors/frontmatter-generator.ts`
- `{TEST_FILE_PATH}`: Full path like `tests/unit/frontmatter-generator.test.ts`
