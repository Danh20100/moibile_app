import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = process.cwd();
const flowsDir = join(root, 'tests', 'e2e', 'flows');
const casesDir = join(root, 'tests', 'e2e', 'cases');
const backlogDir = join(root, 'docs', 'backlogs', 'v1');

function yamlFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name) => join(directory, name));
}

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1]!).filter(Boolean);
}

const flowFiles = yamlFiles(flowsDir);
const caseFiles = yamlFiles(casesDir);
const flowText = flowFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const caseText = caseFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

const flowIds = new Set(matches(flowText, /^\s*- id:\s*([A-Z]+-\d+)\s*$/gm));
const caseIds = matches(caseText, /^\s*- id:\s*([A-Z]+-\d+-[A-Z]\d+|NOTIF-[A-Z]\d+)\s*$/gm);
const caseFlowRefs = matches(caseText, /^\s*flow:\s*([A-Z]+-\d+)\s*$/gm);

assert.ok(flowIds.size > 0, 'No atomic V1 flows found');
assert.ok(caseIds.length > 0, 'No V1 E2E cases found');
assert.equal(new Set(caseIds).size, caseIds.length, 'Duplicate E2E case IDs detected');

const unknownFlowRefs = [...new Set(caseFlowRefs)].filter((id) => !flowIds.has(id));
assert.deepEqual(
  unknownFlowRefs,
  [],
  `Cases reference unknown flows: ${unknownFlowRefs.join(', ')}`,
);

const coveredFlows = new Set(caseFlowRefs);
const uncoveredFlows = [...flowIds].filter((id) => !coveredFlows.has(id)).sort();
assert.deepEqual(
  uncoveredFlows,
  [],
  `Atomic flows without test cases: ${uncoveredFlows.join(', ')}`,
);

const backlogFiles = readdirSync(backlogDir)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .sort();
const uncoveredBacklogs = backlogFiles.filter(
  (name) => !caseText.includes(`docs/backlogs/v1/${name}`),
);
assert.deepEqual(
  uncoveredBacklogs,
  [],
  `V1 backlog files missing from E2E case sources: ${uncoveredBacklogs.join(', ')}`,
);

const requiredNotificationEvents = [
  'new-inquiry',
  'payment-due',
  'payment-confirmed',
  'new-incident',
  'incident-status-changed',
  'tenancy-notice-issued',
  'move-out',
  'review-or-report-moderation',
] as const;
const notificationCase = readFileSync(join(casesDir, 'notifications.yaml'), 'utf8');
const coveredNotificationEvents = new Set(
  matches(notificationCase, /^\s*event:\s*([a-z0-9-]+)\s*$/gm),
);
const missingNotificationEvents = requiredNotificationEvents.filter(
  (event) => !coveredNotificationEvents.has(event),
);
assert.deepEqual(
  missingNotificationEvents,
  [],
  `Frozen Notification use cases missing: ${missingNotificationEvents.join(', ')}`,
);

const crossActorPath = join(root, 'tests', 'e2e', 'journeys', 'CX-v1-cross-actor.yaml');
assert.ok(existsSync(crossActorPath), 'Cross-actor V1 journey matrix is missing');
const crossActorText = readFileSync(crossActorPath, 'utf8');
for (const id of ['CX-01', 'CX-02', 'CX-03', 'CX-04', 'CX-05', 'CX-06']) {
  assert.ok(crossActorText.includes(`id: ${id}`), `Missing cross-actor journey ${id}`);
}

console.log(
  `V1 E2E coverage PASS: ${flowIds.size} atomic flows, ${caseIds.length} cases, ` +
    `${backlogFiles.length} backlog files, ${requiredNotificationEvents.length} frozen notification use cases.`,
);
console.log(`Case files: ${caseFiles.map((file) => basename(file)).join(', ')}`);
