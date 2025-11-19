# Phase {PHASE_NUMBER}: {PHASE_NAME} - {PHASE_DOC_TYPE}

<!--
TEMPLATE VARIABLES REFERENCE
============================

HEADER SECTION:
- {PHASE_NUMBER}: Phase identifier (e.g., "1", "3.3", "4.1")
- {PHASE_NAME}: Short descriptive name (e.g., "Project Setup", "Logger Service", "PostParser Processor")
- {PHASE_DOC_TYPE}: Document type - "Implementation Plan" or "Completion Report"
- {PHASE_STATUS}: Current status - "🔄 IN PROGRESS", "✅ COMPLETE", "⏸️ BLOCKED", "📋 PLANNED"
- {ISSUE_NUMBER}: GitHub issue number (e.g., "#3")
- {ISSUE_URL}: Full GitHub issue URL
- {DATE_STARTED}: Start date in YYYY-MM-DD format (e.g., "2025-11-06")
- {DATE_COMPLETED}: Completion date in YYYY-MM-DD format (e.g., "2025-11-19")
- {PULL_REQUEST_NUMBER}: PR number if applicable (e.g., "#32")
- {PULL_REQUEST_URL}: Full PR URL if applicable

OVERVIEW SECTION:
- {PHASE_DESCRIPTION}: 2-4 sentence description of what this phase accomplishes
- {PHASE_SCOPE}: Clear statement of what is in scope and out of scope
- {REFERENCE_DOC}: Link to source document (e.g., "[TRANSITION.md](TRANSITION.md) (lines 298-309)")

REQUIREMENTS SECTION:
- {REQUIREMENTS_LIST}: Bulleted list of requirements from planning documents
- {COVERAGE_TARGET}: Test coverage target percentage (e.g., "90%+")

ARCHITECTURE SECTION:
- {API_DESIGN}: Class/interface signatures and public API
- {CONFIG_INTERFACE}: Configuration interface definitions
- {DESIGN_PATTERNS}: Design patterns used and rationale
- {TECHNICAL_APPROACH}: High-level approach to solving the problem
- {DATA_FLOW}: Description or diagram of data flow

IMPLEMENTATION SECTION:
- {STEP_NUMBER}: Step identifier (e.g., "1", "2.1", "4.3")
- {STEP_NAME}: Step name (e.g., "Create Type Definitions")
- {STEP_STATUS}: "✅ COMPLETE", "🔄 IN PROGRESS", "⏸️ BLOCKED", "📋 PENDING"
- {STEP_DESCRIPTION}: Detailed description of what the step involves
- {STEP_PRIORITY}: Priority order if sequential work is required
- {CODE_EXAMPLES}: Code snippets showing implementation pattern
- {FILE_PATHS}: Absolute or relative file paths being modified

TESTING SECTION:
- {TEST_FILE_PATH}: Path to test file (e.g., "tests/unit/post-parser.test.ts")
- {TEST_CATEGORY}: Test category name (e.g., "Successful Parsing", "Error Handling")
- {TEST_COUNT}: Number of tests in category or total
- {TEST_DESCRIPTION}: What the test verifies
- {COVERAGE_ACHIEVED}: Actual coverage percentage achieved (e.g., "98.36%")

VERIFICATION SECTION:
- {VERIFICATION_COMMAND}: Command to run (e.g., "npm run type-check")
- {EXPECTED_RESULT}: Expected output (e.g., "✅ No TypeScript errors")
- {ACTUAL_RESULT}: Actual output from running command
- {VERIFICATION_STATUS}: "✅ Pass" or "❌ Fail"

SUCCESS CRITERIA:
- {FUNCTIONAL_REQUIREMENT}: Functional requirement description
- {NON_FUNCTIONAL_REQUIREMENT}: Non-functional requirement description (performance, coverage, etc.)
- {CODE_QUALITY_REQUIREMENT}: Code quality requirement (no `any` types, JSDoc complete, etc.)

INTEGRATION SECTION:
- {UPSTREAM_COMPONENT}: Components that provide input
- {DOWNSTREAM_COMPONENT}: Components that consume output
- {INTEGRATION_PATTERN}: Code example of how component integrates

CHALLENGES SECTION:
- {CHALLENGE_NAME}: Name of potential challenge
- {CHALLENGE_DESCRIPTION}: What makes this challenging
- {SOLUTION_APPROACH}: How to solve or mitigate the challenge
- {RISK_LEVEL}: "Low", "Medium", "High"

DECISIONS SECTION:
- {DECISION_NUMBER}: Decision identifier
- {DECISION_QUESTION}: The question being answered
- {DECISION_OPTIONS}: Options considered
- {DECISION_RATIONALE}: Why the chosen option was selected
- {DECISION_RESULT}: Final decision made

SUMMARY SECTION:
- {ACCOMPLISHMENTS_LIST}: Bulleted list of what was accomplished
- {FILES_CREATED}: List of new files with paths
- {FILES_MODIFIED}: List of modified files with paths
- {NEXT_PHASE}: Next phase identifier and name
- {NEXT_ACTIONS}: What should happen next

Example Values:
==============
{PHASE_NUMBER} → "4.1"
{PHASE_NAME} → "PostParser Processor Implementation"
{PHASE_DOC_TYPE} → "Implementation Plan"
{PHASE_STATUS} → "✅ COMPLETE"
{ISSUE_NUMBER} → "#4"
{DATE_STARTED} → "2025-11-07"
{DATE_COMPLETED} → "2025-11-19"
{STEP_STATUS} → "✅ COMPLETE"
{COVERAGE_ACHIEVED} → "100%"
{VERIFICATION_STATUS} → "✅ Pass"
-->

**Issue**: [{ISSUE_NUMBER} - {PHASE_NAME}]({ISSUE_URL})
**Status**: {PHASE_STATUS}
**Date Started**: {DATE_STARTED}
**Date Completed**: {DATE_COMPLETED}
**Pull Request**: [{PULL_REQUEST_NUMBER}]({PULL_REQUEST_URL})

---

## Overview

{PHASE_DESCRIPTION}

**Scope**: {PHASE_SCOPE}

**Reference**: {REFERENCE_DOC}

**Progress**:
- {STEP_STATUS} Step {STEP_NUMBER}: {STEP_NAME}

---

## Requirements Summary

From {REFERENCE_DOC}:

{REQUIREMENTS_LIST}

**Key Requirements**:
- {COVERAGE_TARGET} test coverage for new code
- Type-safe implementation (no `any` types)
- Full JSDoc documentation
- Integration with existing architecture

---

## Architecture Design

### 1. Service/Component API Design

#### Public Interface

```typescript
{API_DESIGN}
```

#### Configuration Interface

```typescript
{CONFIG_INTERFACE}
```

### 2. Design Patterns

{DESIGN_PATTERNS}

**Key Decisions**:
1. **{DECISION_QUESTION}**: {DECISION_RESULT}
2. **{DECISION_QUESTION}**: {DECISION_RESULT}

---

## Technical Approach

### 1. Data Flow

```
{DATA_FLOW}
```

### 2. Implementation Strategy

{TECHNICAL_APPROACH}

---

## Implementation Steps

### Step {STEP_NUMBER}: {STEP_NAME}

**Status**: {STEP_STATUS}

**File**: `{FILE_PATHS}`

**Action**: {STEP_DESCRIPTION}

**Implementation**:

```typescript
{CODE_EXAMPLES}
```

**Priority Order**:
1. {STEP_PRIORITY}

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `{TEST_FILE_PATH}`

**Test Categories**:

#### {TEST_CATEGORY} ({TEST_COUNT} tests)
- ✅ {TEST_DESCRIPTION}

**Total Tests**: {TEST_COUNT} (targeting {COVERAGE_TARGET} coverage)

### 2. Test Coverage Targets

Following project standards:

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | ≥{COVERAGE_TARGET} | All code paths exercised |
| **Branches** | ≥{COVERAGE_TARGET} | All conditions tested |
| **Functions** | ≥{COVERAGE_TARGET} | All methods covered |
| **Lines** | ≥{COVERAGE_TARGET} | Complete line coverage |

**Expected Results**: Based on similar services, should achieve {COVERAGE_ACHIEVED} coverage with comprehensive test suite.

---

## Integration Points

### 1. Upstream (Input)
- **Source**: {UPSTREAM_COMPONENT}
- **Input Type**: `{TYPE_NAME}`
- **Integration**: {INTEGRATION_PATTERN}

### 2. Downstream (Output)
- **Output Type**: `{TYPE_NAME}`
- **Next Stage**: {DOWNSTREAM_COMPONENT}
- **Integration**: {INTEGRATION_PATTERN}

### 3. Error Flow
- **Error Handling**: {ERROR_HANDLING_APPROACH}
- **Error Tracking**: {ERROR_TRACKING_APPROACH}

---

## Architectural Decisions

### Decision {DECISION_NUMBER}: {DECISION_QUESTION}

**Question**: {DECISION_QUESTION}

**Analysis**:

**Arguments FOR {OPTION_NAME}:**
- {ARGUMENT}

**Arguments AGAINST {OPTION_NAME}:**
- {ARGUMENT}

**Decision: {DECISION_RESULT}**

**Rationale**:
1. {RATIONALE_POINT}

**When to revisit**: {REVISIT_CONDITIONS}

---

## Potential Challenges & Solutions

### Challenge {CHALLENGE_NUMBER}: {CHALLENGE_NAME}

**Issue**: {CHALLENGE_DESCRIPTION}

**Solution**: {SOLUTION_APPROACH}

**Risk Level**: {RISK_LEVEL}

---

## Verification Checklist

### Pre-Implementation Checklist
- [ ] GitHub Issue reviewed
- [ ] Type definitions understood
- [ ] Reference implementation analyzed
- [ ] Test fixture data reviewed
- [ ] Implementation patterns studied

### Implementation Verification

```bash
# Verify TypeScript compilation
{VERIFICATION_COMMAND}
# Expected: {EXPECTED_RESULT}

# Verify build succeeds
{VERIFICATION_COMMAND}
# Expected: {EXPECTED_RESULT}

# Run tests
{VERIFICATION_COMMAND}
# Expected: {EXPECTED_RESULT}

# Generate coverage report
{VERIFICATION_COMMAND}
# Expected: {EXPECTED_RESULT}
```

### Verification Table (Actual Results)

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript compilation | {VERIFICATION_STATUS} | {ACTUAL_RESULT} |
| Build process | {VERIFICATION_STATUS} | {ACTUAL_RESULT} |
| Unit tests passing | {VERIFICATION_STATUS} | {ACTUAL_RESULT} |
| Statement coverage ≥{COVERAGE_TARGET} | {VERIFICATION_STATUS} | {COVERAGE_ACHIEVED} |
| Branch coverage ≥{COVERAGE_TARGET} | {VERIFICATION_STATUS} | {COVERAGE_ACHIEVED} |
| Function coverage ≥{COVERAGE_TARGET} | {VERIFICATION_STATUS} | {COVERAGE_ACHIEVED} |
| Line coverage ≥{COVERAGE_TARGET} | {VERIFICATION_STATUS} | {COVERAGE_ACHIEVED} |
| No `any` types used | {VERIFICATION_STATUS} | {ACTUAL_RESULT} |
| JSDoc documentation | {VERIFICATION_STATUS} | {ACTUAL_RESULT} |

---

## Success Criteria

### Functional Requirements
- ✅ {FUNCTIONAL_REQUIREMENT}

### Non-Functional Requirements
- ✅ {NON_FUNCTIONAL_REQUIREMENT}

### Code Quality Requirements
- ✅ {CODE_QUALITY_REQUIREMENT}

### Integration Requirements
- ✅ Exports properly defined
- ✅ Integrates with existing type system
- ✅ Ready for integration into pipeline

---

## What Was Accomplished

### Implementation
- ✅ {ACCOMPLISHMENT}

### Testing & Verification
- ✅ {ACCOMPLISHMENT}

### Documentation
- ✅ {ACCOMPLISHMENT}

---

## Technical Highlights

### {HIGHLIGHT_NAME}

{HIGHLIGHT_DESCRIPTION}

**Benefits**:
- {BENEFIT}

---

## Reference Implementation Comparison

### Original Script

```javascript
{ORIGINAL_CODE}
```

**Characteristics**:
- {CHARACTERISTIC}

### New Implementation

```typescript
{NEW_CODE}
```

**Improvements**:
- ✅ {IMPROVEMENT}

---

## Implementation Results

**Completed Actions**:
1. ✅ {ACTION}

**Test Coverage Achieved**:
- Statements: {COVERAGE_ACHIEVED} (target: ≥{COVERAGE_TARGET})
- Branches: {COVERAGE_ACHIEVED} (target: ≥{COVERAGE_TARGET})
- Functions: {COVERAGE_ACHIEVED} (target: ≥{COVERAGE_TARGET})
- Lines: {COVERAGE_ACHIEVED} (target: ≥{COVERAGE_TARGET})

**Files Created/Modified**:
- ✅ [{FILE_PATHS}]({FILE_PATHS}) - {FILE_DESCRIPTION}

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {RISK_NAME} | {RISK_LEVEL} | {RISK_LEVEL} | {MITIGATION_STRATEGY} |

---

## Timeline Estimate

**Total Estimated Time**: {TIME_ESTIMATE}

- **Phase 1** ({PHASE_NAME}): {TIME_ESTIMATE}
  - {TASK_NAME}: {TIME_ESTIMATE}

---

## Next Steps

After Phase {PHASE_NUMBER} completion:

### **Phase {NEXT_PHASE_NUMBER}: {NEXT_PHASE_NAME}**
- {NEXT_PHASE_DESCRIPTION}

---

## Files to Create/Modify

### New Files
- [ ] [{FILE_PATHS}]({FILE_PATHS}) - {FILE_DESCRIPTION}

### Modified Files
- [ ] [{FILE_PATHS}]({FILE_PATHS}) - {MODIFICATION_DESCRIPTION}

### Verification Files (after completion)
- [ ] [{FILE_PATHS}]({FILE_PATHS}) - {FILE_DESCRIPTION}

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] {TASK_DESCRIPTION}

### Phase 2: Testing
- [ ] {TASK_DESCRIPTION}

### Phase 3: Verification
- [ ] {TASK_DESCRIPTION}

### Phase 4: Documentation
- [ ] {TASK_DESCRIPTION}

---

## Summary

**Phase {PHASE_NUMBER} Status**: {PHASE_STATUS}

**Implementation Completed**:
- ✅ {ACCOMPLISHMENT}

**Scope**:
- {SCOPE_ITEM}

**Quality Targets**:
- {QUALITY_TARGET}

**Deliverables**:
- {DELIVERABLE}

---

**Phase {PHASE_NUMBER} Start Date**: {DATE_STARTED}
**Phase {PHASE_NUMBER} Completion Date**: {DATE_COMPLETED}
**Phase {PHASE_NUMBER} Status**: {PHASE_STATUS}
**Pull Request**: [{PULL_REQUEST_NUMBER}]({PULL_REQUEST_URL})

**Next Action**: {NEXT_ACTIONS}
