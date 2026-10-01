#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const [component, requested, skipVersionBump = 'false'] = process.argv.slice(2);
if (!['server', 'web'].includes(component) || !/^\d+\.\d+\.\d+$/.test(requested || '') || !['true', 'false'].includes(skipVersionBump)) {
  console.error('Usage: node scripts/check-deploy-version.js server|web MAJOR.MINOR.PATCH true|false');
  process.exit(1);
}

const expected = JSON.parse(readFileSync(`${component}/package.json`, 'utf8')).version;
if (requested !== expected) {
  console.error(`Requested ${component} version ${requested} must match ${component}/package.json (${expected}).`);
  process.exit(1);
}

const compare = (a, b) => {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
};

const tags = execFileSync('git', ['tag', '--list', `${component}/v*`], { encoding: 'utf8' })
  .trim().split('\n')
  .map((tag) => tag.match(new RegExp(`^${component}/v(\\d+\\.\\d+\\.\\d+)$`))?.[1])
  .filter(Boolean);
const latest = tags.sort(compare).at(-1);
if (skipVersionBump === 'true') {
  if (requested !== latest) {
    console.error(`${component} version must match the latest deployed tag (${latest || 'none'}) when skipping a version bump.`);
    process.exit(1);
  }
  console.log(`${component} ${requested} will be redeployed without a new version tag.`);
  process.exit(0);
}
if (compare(requested, latest || '1.0.0') <= 0) {
  console.error(`${component} version must be greater than ${latest || '1.0.0'}.`);
  process.exit(1);
}
console.log(`${component} ${requested} is newer than ${latest || '1.0.0'}.`);
