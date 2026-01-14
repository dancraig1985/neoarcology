#!/usr/bin/env npx tsx
/**
 * generate-manifest.ts - Generate a manifest of all template files
 *
 * Run this script after adding new template files:
 *   npm run generate:manifest
 *
 * This creates data/manifest.json which the browser ConfigLoader uses
 * to know which template files exist (since browsers can't enumerate directories).
 */

import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

interface Manifest {
  generated: string;
  templates: {
    orgs: string[];
    agents: string[];
    locations: string[];
    buildings: string[];
  };
}

function listJsonFiles(dir: string): string[] {
  try {
    return readdirSync(join(DATA_DIR, dir))
      .filter(f => f.endsWith('.json'))
      .sort();
  } catch {
    console.warn(`Warning: Directory not found: ${dir}`);
    return [];
  }
}

const manifest: Manifest = {
  generated: new Date().toISOString(),
  templates: {
    orgs: listJsonFiles('templates/orgs'),
    agents: listJsonFiles('templates/agents'),
    locations: listJsonFiles('templates/locations'),
    buildings: listJsonFiles('templates/buildings'),
  },
};

const outputPath = join(DATA_DIR, 'manifest.json');
writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');

console.log('Generated manifest.json:');
console.log(`  - orgs: ${manifest.templates.orgs.length} files`);
console.log(`  - agents: ${manifest.templates.agents.length} files`);
console.log(`  - locations: ${manifest.templates.locations.length} files`);
console.log(`  - buildings: ${manifest.templates.buildings.length} files`);
