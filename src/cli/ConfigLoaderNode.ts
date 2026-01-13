/**
 * ConfigLoaderNode - Load configuration using Node.js filesystem APIs
 * Used by CLI tools that run outside the browser
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  LoadedConfig,
  SimulationConfig,
  EconomyConfig,
  AgentsConfig,
  CityConfig,
  TransportConfig,
  OrgTemplate,
  AgentTemplate,
  LocationTemplate,
  BuildingTemplate,
  EntityTemplate,
} from '../config/ConfigLoader';

// Re-export types for convenience
export type { LoadedConfig } from '../config/ConfigLoader';

/**
 * Get the project root directory (where data/ folder lives)
 */
function getProjectRoot(): string {
  // When running from project root via npm script, process.cwd() is the project root
  // This should work for `npm run sim:test` invocations
  return process.cwd();
}

/**
 * Load a JSON file from the data directory
 */
function loadJson<T>(relativePath: string): T {
  const fullPath = join(getProjectRoot(), relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Load all template files from a directory
 */
function loadTemplates<T extends EntityTemplate>(relativePath: string): T[] {
  const fullPath = join(getProjectRoot(), relativePath);
  const files = readdirSync(fullPath).filter(f => f.endsWith('.json'));

  const templates: T[] = [];
  for (const file of files) {
    const filePath = join(fullPath, file);
    const content = readFileSync(filePath, 'utf-8');
    templates.push(JSON.parse(content) as T);
  }

  return templates;
}

/**
 * Load all configuration from the data/ folder (Node.js version)
 */
export function loadConfigSync(): LoadedConfig {
  // Load config files
  const simulation = loadJson<SimulationConfig>('data/config/simulation.json');
  const economy = loadJson<EconomyConfig>('data/config/economy.json');
  const agents = loadJson<AgentsConfig>('data/config/agents.json');
  const city = loadJson<CityConfig>('data/config/city.json');
  const transport = loadJson<TransportConfig>('data/config/transport.json');

  // Load templates
  const orgTemplates = loadTemplates<OrgTemplate>('data/templates/orgs');
  const agentTemplates = loadTemplates<AgentTemplate>('data/templates/agents');
  const locationTemplates = loadTemplates<LocationTemplate>('data/templates/locations');
  const buildingTemplates = loadTemplates<BuildingTemplate>('data/templates/buildings');

  // Build lookup maps
  const locationTemplateMap: Record<string, LocationTemplate> = {};
  for (const template of locationTemplates) {
    locationTemplateMap[template.id] = template;
  }

  const agentTemplateMap: Record<string, AgentTemplate> = {};
  for (const template of agentTemplates) {
    agentTemplateMap[template.id] = template;
  }

  const orgTemplateMap: Record<string, OrgTemplate> = {};
  for (const template of orgTemplates) {
    orgTemplateMap[template.id] = template;
  }

  const buildingTemplateMap: Record<string, BuildingTemplate> = {};
  for (const template of buildingTemplates) {
    buildingTemplateMap[template.id] = template;
  }

  return {
    simulation,
    economy,
    agents,
    city,
    transport,
    templates: {
      orgs: orgTemplates,
      agents: agentTemplates,
      locations: locationTemplates,
      buildings: buildingTemplates,
    },
    locationTemplates: locationTemplateMap,
    agentTemplates: agentTemplateMap,
    orgTemplates: orgTemplateMap,
    buildingTemplates: buildingTemplateMap,
  };
}
