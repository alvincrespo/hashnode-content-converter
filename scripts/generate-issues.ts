#!/usr/bin/env node

/**
 * GitHub Issue Generator
 * Automatically creates GitHub issues and milestones from TRANSITION.md documentation.
 *
 * Usage:
 *   npx ts-node scripts/generate-issues.ts [--dry-run] [--phase=<number>]
 *
 * Options:
 *   --dry-run    Preview changes without creating issues
 *   --phase=<n>  Create issues for specific phase only
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Phase {
  number: number;
  title: string;
  description: string;
  steps: Step[];
}

interface Step {
  number: string; // e.g., "3.1", "3.2"
  title: string;
  isComplete: boolean;
  description: string;
}

interface MilestoneInfo {
  phaseNumber: number;
  title: string;
}

// Configuration
const DOCS_PATH = path.join(__dirname, '..', 'docs', 'TRANSITION.md');
const DRY_RUN = process.argv.includes('--dry-run');
const PHASE_FILTER = process.argv.find((arg) => arg.startsWith('--phase='))?.split('=')[1];

function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const colors = {
    info: '\x1b[36m', // cyan
    success: '\x1b[32m', // green
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
    reset: '\x1b[0m',
  };

  const prefix = {
    info: 'ℹ',
    success: '✓',
    warn: '⚠',
    error: '✗',
  };

  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

/**
 * Parse TRANSITION.md to extract phases and steps
 */
function parseTransitionDoc(): Phase[] {
  const content = fs.readFileSync(DOCS_PATH, 'utf-8');
  const phases: Phase[] = [];

  // Match phase sections: ### Phase X: Title ✅/❌
  const phaseRegex = /### Phase (\d+): ([^\n]+)(✅|❌)?/g;
  let phaseMatch;

  while ((phaseMatch = phaseRegex.exec(content)) !== null) {
    const phaseNumber = parseInt(phaseMatch[1], 10);
    const phaseTitle = phaseMatch[2].trim();
    const isComplete = phaseMatch[3] === '✅';

    // Find steps within this phase
    const nextPhaseIndex = content.indexOf(
      `### Phase ${phaseNumber + 1}:`,
      phaseMatch.index,
    );
    const phaseSectionEnd = nextPhaseIndex === -1 ? content.length : nextPhaseIndex;
    const phaseSection = content.substring(phaseMatch.index, phaseSectionEnd);

    const steps: Step[] = [];
    const stepRegex = /#### Step (\d+\.\d+): ([^\n]+)(✅)?/g;
    let stepMatch;

    while ((stepMatch = stepRegex.exec(phaseSection)) !== null) {
      const stepNumber = stepMatch[1];
      const stepTitle = stepMatch[2].trim();
      const stepIsComplete = stepMatch[3] === '✅';

      // Extract step description (lines after the step title until next step or section)
      const stepSectionStart = stepMatch.index + stepMatch[0].length;
      const nextStepIndex = phaseSection.indexOf('#### Step', stepSectionStart);
      const stepSectionEnd = nextStepIndex === -1 ? phaseSection.length : nextStepIndex;
      const stepDescription = phaseSection
        .substring(stepSectionStart, stepSectionEnd)
        .trim()
        .split('\n')
        .slice(0, 20) // Get first 20 lines as description
        .join('\n');

      steps.push({
        number: stepNumber,
        title: stepTitle,
        isComplete: stepIsComplete,
        description: stepDescription,
      });
    }

    phases.push({
      number: phaseNumber,
      title: phaseTitle,
      description: `Phase ${phaseNumber}: ${phaseTitle}`,
      steps,
    });
  }

  return phases;
}

/**
 * Get all existing milestones
 * Note: gh CLI may not support milestone commands in all versions
 */
function getExistingMilestones(): Map<number, string> {
  try {
    // Try to list issues with milestone filter to detect existing milestones
    const output = execSync('gh issue list --state all --json milestone --limit 100', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const issues = JSON.parse(output) as Array<{ milestone?: { title: string } }>;
    const map = new Map<number, string>();

    issues.forEach((issue) => {
      if (issue.milestone) {
        const match = issue.milestone.title.match(/Phase (\d+)/);
        if (match) {
          const phaseNum = parseInt(match[1], 10);
          map.set(phaseNum, issue.milestone.title);
        }
      }
    });

    return map;
  } catch {
    // Silently fail - milestone command may not be available in this gh version
    return new Map();
  }
}

/**
 * Get all existing issues
 */
function getExistingIssues(): Set<string> {
  try {
    const output = execSync('gh issue list --state all --json title --limit 100', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const issues = JSON.parse(output) as Array<{ title: string }>;
    return new Set(issues.map((i) => i.title));
  } catch {
    // Silently fail - will attempt to create issues anyway
    return new Set();
  }
}

/**
 * Create a milestone for a phase
 * Note: gh CLI in older versions may not support milestone commands
 */
function createMilestone(phase: Phase, dryRun: boolean): boolean {
  const milestoneTitle = `Phase ${phase.number}: ${phase.title}`;

  if (dryRun) {
    log(`[DRY RUN] Would create milestone: "${milestoneTitle}"`);
    return true;
  }

  try {
    // Try to create milestone using gh API if CLI command is not available
    execSync(
      `gh api repos/:owner/:repo/milestones --input - <<< '{"title":"${milestoneTitle}","description":"Phase ${phase.number} implementation tasks"}'`,
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: '/bin/bash',
      },
    );
    log(`Created milestone: "${milestoneTitle}"`, 'success');
    return true;
  } catch (error) {
    // Milestones are optional - just warn if creation fails
    log(
      `Note: Milestone creation skipped (gh version may not support it). Issues will be created without milestone assignment.`,
      'warn',
    );
    return false;
  }
}

/**
 * Create an issue for a step
 */
function createIssue(
  phase: Phase,
  step: Step,
  dryRun: boolean,
  existingIssues: Set<string>,
): boolean {
  const issueTitle = `[Phase ${phase.number}] Step ${step.number}: ${step.title}`;

  // Check if issue already exists
  if (existingIssues.has(issueTitle)) {
    log(`Issue already exists: "${issueTitle}"`, 'warn');
    return true;
  }

  // Create issue body with task checklist
  const taskLines = step.description
    .split('\n')
    .filter((line) => line.match(/^-/)) // Extract bullet points
    .slice(0, 10);

  const issueBody = `## Step ${step.number}: ${step.title}

### Description
${step.description}

### Tasks
${
  taskLines.length > 0
    ? taskLines.map((line) => `- [ ] ${line.replace(/^-\s*/, '')}`).join('\n')
    : '- [ ] Implement functionality\n- [ ] Write unit tests\n- [ ] Write integration tests\n- [ ] Update documentation'
}

### Documentation
See [docs/TRANSITION.md](../docs/TRANSITION.md#phase-${phase.number}-${phase.title.toLowerCase().replace(/\s+/g, '-')})

### Success Criteria
- Code implemented and follows project guidelines
- Unit tests written with 90%+ coverage for new code
- Type-safe implementation (no \`any\` types)
- Documentation updated if needed
`;

  if (dryRun) {
    log(`[DRY RUN] Would create issue: "${issueTitle}"`);
    return true;
  }

  try {
    // Create issue - milestone assignment will be optional if not available
    const issueCmd = `gh issue create --title "${issueTitle.replace(/"/g, '\\"')}" --body "${issueBody.replace(/"/g, '\\"')}"`;

    execSync(issueCmd, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
    });
    log(`Created issue: "${issueTitle}"`, 'success');
    return true;
  } catch (error) {
    log(`Failed to create issue: ${(error as any).message}`, 'error');
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  log('GitHub Issue Generator', 'info');
  log(`Parsing ${DOCS_PATH}`, 'info');

  const phases = parseTransitionDoc();

  if (phases.length === 0) {
    log('No phases found in TRANSITION.md', 'error');
    process.exit(1);
  }

  log(`Found ${phases.length} phases`, 'success');

  // Filter phases if --phase parameter provided
  const phasesToProcess = PHASE_FILTER
    ? phases.filter((p) => p.number === parseInt(PHASE_FILTER, 10))
    : phases.filter((p) => p.number >= 3); // Skip phases 1-2 (already complete)

  if (phasesToProcess.length === 0) {
    log(`No phases to process`, 'warn');
    process.exit(0);
  }

  // Count incomplete steps
  const incompleteSteps = phasesToProcess.flatMap((p) =>
    p.steps.filter((s) => !s.isComplete),
  );

  log(`Found ${incompleteSteps.length} incomplete steps`, 'success');

  if (DRY_RUN) {
    log('\n🔍 DRY RUN MODE - No changes will be made\n', 'warn');
  }

  const existingMilestones = getExistingMilestones();
  const existingIssues = getExistingIssues();

  // Create milestones
  log('\n📌 Creating Milestones...', 'info');
  let milestonesCreated = 0;

  for (const phase of phasesToProcess) {
    const milestoneTitle = `Phase ${phase.number}: ${phase.title}`;

    if (!existingMilestones.has(phase.number)) {
      if (createMilestone(phase, DRY_RUN)) {
        milestonesCreated++;
      }
    } else {
      log(`Milestone already exists: "${milestoneTitle}"`, 'warn');
    }
  }

  // Create issues
  log('\n📝 Creating Issues...', 'info');
  let issuesCreated = 0;

  for (const phase of phasesToProcess) {
    const incompleteStepsInPhase = phase.steps.filter((s) => !s.isComplete);

    if (incompleteStepsInPhase.length === 0) {
      log(`Phase ${phase.number}: All steps complete ✅`, 'success');
      continue;
    }

    log(`\nPhase ${phase.number}: ${phase.title}`);

    for (const step of incompleteStepsInPhase) {
      if (createIssue(phase, step, DRY_RUN, existingIssues)) {
        issuesCreated++;
      }
    }
  }

  // Summary
  log('\n📊 Summary', 'info');
  log(`Milestones: ${milestonesCreated} created`, 'success');
  log(`Issues: ${issuesCreated} created`, 'success');

  if (DRY_RUN) {
    log('\nTo create issues for real, run without --dry-run flag', 'info');
  }
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
