#!/usr/bin/env node

/**
 * Read-only CortexMD module/dependency audit.
 *
 * This script never writes files. It reports the current source graph so later
 * architecture work can be compared with a frozen Wave 0 atlas.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const WARNING = 'CURRENT ARCHITECTURE CHARACTERIZATION — NOT A TARGET ARCHITECTURE OR SCIENTIFIC VALIDATION';
const CHARACTERIZATION_BASELINE_COMMIT = '6d98af672fe9c7dc4a8709734fec9b8d9a10cd9b';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const srcRoot = path.join(root, 'src');
const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];
const parseableExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const heavyPackages = ['three', '@anthropic-ai/sdk', '@supabase/supabase-js', '@supabase/ssr'];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(absolute) : [absolute];
    })
    .sort();
}

function relative(absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function resolveInternal(fromAbsolute, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = path.join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromAbsolute), specifier);
  else return null;

  const candidates = [base];
  for (const extension of sourceExtensions) candidates.push(`${base}${extension}`);
  for (const extension of sourceExtensions) candidates.push(path.join(base, `index${extension}`));
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function exportedName(node) {
  if ('name' in node && node.name && ts.isIdentifier(node.name)) return node.name.text;
  return null;
}

function analyzeSource(absolute) {
  const sourceText = fs.readFileSync(absolute, 'utf8');
  const source = ts.createSourceFile(absolute, sourceText, ts.ScriptTarget.Latest, true, scriptKind(absolute));
  const imports = [];
  const exports = [];
  const sideEffects = [];
  let directive = null;

  for (const statement of source.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      if (statement.expression.text === 'use client' || statement.expression.text === 'use server') {
        directive = statement.expression.text;
      }
    }

    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const typeOnly = Boolean(statement.importClause?.isTypeOnly)
        || Boolean(statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
          && statement.importClause.namedBindings.elements.length > 0
          && statement.importClause.namedBindings.elements.every((element) => element.isTypeOnly));
      imports.push({ specifier: statement.moduleSpecifier.text, kind: 'import', typeOnly });
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push({ specifier: statement.moduleSpecifier.text, kind: 're-export', typeOnly: statement.isTypeOnly });
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        exports.push(...statement.exportClause.elements.map((element) => element.name.text));
      } else {
        exports.push('*');
      }
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      const name = exportedName(statement);
      if (name) exports.push(name);
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) exports.push(declaration.name.text);
        }
      }
    }
    if (ts.isExportAssignment(statement)) exports.push('default');

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (initializer && (ts.isCallExpression(initializer) || ts.isNewExpression(initializer) || ts.isAwaitExpression(initializer))) {
          sideEffects.push(`top-level ${ts.isNewExpression(initializer) ? 'construction' : 'call'} in ${declaration.name.getText(source)}`);
        }
      }
    } else if (ts.isExpressionStatement(statement) && !ts.isStringLiteral(statement.expression)) {
      sideEffects.push('top-level expression');
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        imports.push({ specifier: node.arguments[0].text, kind: 'dynamic-import', typeOnly: false });
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        imports.push({ specifier: node.arguments[0].text, kind: 'require', typeOnly: false });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  return { sourceText, directive, imports, exports: [...new Set(exports)].sort(), sideEffects: [...new Set(sideEffects)] };
}

function runtimeFor(file, directive) {
  if (!parseableExtensions.has(path.extname(file))) return file.endsWith('.css') ? 'client-style' : 'asset/data';
  if (file.startsWith('src/scripts/')) return 'build-time diagnostic';
  if (file.startsWith('src/visualization/brain/')) return 'client';
  if (directive === 'use client') return 'client';
  if (directive === 'use server' || file.includes('/app/api/') || file === 'src/proxy.ts'
    || file.endsWith('/supabase-server.ts') || file.endsWith('/admin-session.ts') || file === 'src/i18n/request.ts') return 'server';
  return 'shared/server-default';
}

function layerFor(file) {
  if (file.startsWith('src/visualization/brain/core/')) return 'visualization/brain/core';
  if (file.startsWith('src/domains/pharmacology/model/')) return 'domain/pharmacology/model';
  if (file.startsWith('src/domains/pharmacology/validation/')) return 'domain/pharmacology/validation';
  if (file.startsWith('src/domains/pharmacology/repository/')) return 'domain/pharmacology/repository';
  if (file.startsWith('src/domains/pharmacology/compatibility/')) return 'domain/pharmacology/compatibility';
  if (file === 'src/domains/pharmacology/README.md') return 'domain/pharmacology/documentation';
  if (file.startsWith('src/app/api/')) return 'application/API';
  if (file.startsWith('src/app/')) return 'application/route';
  if (file.startsWith('src/components/')) return `presentation/${file.split('/')[2]}`;
  if (file.startsWith('src/hooks/')) return 'application/hooks';
  if (file.startsWith('src/lib/indicators/')) return 'domain/derived-indicators';
  if (file.startsWith('src/lib/admin/')) return 'application/admin';
  if (file.startsWith('src/lib/')) return 'application/shared-services';
  if (file.startsWith('src/data/')) return 'data/current-records';
  if (file.startsWith('src/types/')) return 'domain/types';
  if (file.startsWith('src/constants/')) return 'domain/policy-constants';
  if (file.startsWith('src/messages/')) return 'presentation/localization';
  if (file.startsWith('src/styles/')) return 'presentation/styles';
  if (file.startsWith('src/i18n/')) return 'application/localization';
  if (file.startsWith('src/scripts/')) return 'diagnostic/migration';
  if (file === 'src/proxy.ts') return 'application/request-boundary';
  return 'asset/other';
}

function primaryResponsibility(file) {
  const base = path.basename(file).replace(/\.(tsx?|jsx?|mts|cts|mjs|cjs|json|css|ico)$/, '');
  if (file.startsWith('src/visualization/brain/core/')) return `Own the current brain ${base} runtime seam`;
  if (file.startsWith('src/domains/pharmacology/model/')) return `Define canonical pharmacology ${base} value contracts`;
  if (file.startsWith('src/domains/pharmacology/validation/')) return `Validate canonical pharmacology ${base} values`;
  if (file.startsWith('src/domains/pharmacology/repository/')) return `Define the canonical pharmacology ${base} read contract`;
  if (file.startsWith('src/domains/pharmacology/compatibility/')) return 'Project current-compatible V1 records behind the private canonical read adapter';
  if (file === 'src/domains/pharmacology/README.md') return 'Document the canonical pharmacology domain boundary';
  if (file.includes('/app/api/')) return `Handle the ${file.replace(/^src\/app\/api\//, '').replace(/\/route\.ts$/, '')} API boundary`;
  if (file.endsWith('/page.tsx')) return `Render/orchestrate the ${file.replace(/^src\/app\//, '').replace(/\/page\.tsx$/, '') || 'dashboard'} route`;
  if (file.endsWith('/layout.tsx')) return `Define the ${file.replace(/^src\/app\//, '').replace(/\/layout\.tsx$/, '') || 'root'} route layout`;
  if (file.endsWith('/actions.ts')) return 'Execute admin server actions';
  if (file.startsWith('src/components/')) return `Render and coordinate the ${base} UI`;
  if (file.startsWith('src/hooks/')) return `Own client state/effects for ${base.replace(/^use/, '')}`;
  if (file.startsWith('src/lib/indicators/')) return `Calculate or support the ${base} indicator`;
  if (file.startsWith('src/lib/')) return `Provide ${base} application/domain utilities`;
  if (file.startsWith('src/data/')) return `Define current ${base} records and lookup behavior`;
  if (file.startsWith('src/types/')) return `Define ${base} TypeScript contracts`;
  if (file.startsWith('src/constants/')) return `Define ${base} calculation/display policy constants`;
  if (file.startsWith('src/messages/')) return `Provide ${base} locale messages`;
  if (file.startsWith('src/styles/')) return `Define ${base} presentation constants`;
  if (file.startsWith('src/i18n/')) return `Configure ${base} localization behavior`;
  if (file.startsWith('src/scripts/')) return `Run the ${base} migration/diagnostic workflow`;
  if (file.endsWith('.css')) return 'Define global application styles';
  if (file.endsWith('.ico')) return 'Provide the application favicon';
  if (file === 'src/proxy.ts') return 'Apply request security headers and route policy';
  return `Own the ${base} module`;
}

function proposedDomain(file) {
  if (file.startsWith('src/visualization/brain/')) return 'retain in src/visualization/brain';
  if (file.startsWith('src/domains/pharmacology/')) return 'retain in src/domains/pharmacology';
  if (file === 'src/data/drugs.ts') return 'src/domains/pharmacology/adapters/legacy-v1-data (temporary)';
  if (file === 'src/data/drugs.v2.ts') return 'src/domains/pharmacology/data/canonical-input (after review)';
  if (file === 'src/types/pharmacology.ts') return 'src/domains/pharmacology/model';
  if (file.startsWith('src/lib/indicators/') || file === 'src/lib/pharmacology.ts' || file === 'src/lib/sigma1.ts') return 'src/domains/pharmacology/calculations or heuristics';
  if (file.startsWith('src/constants/receptor-weights')) return 'src/domains/pharmacology/calculations/policy';
  if (file.startsWith('src/data/regional-density') || file.startsWith('src/data/brainRegions')) return 'src/domains/brain/data with pharmacology projections';
  if (file.startsWith('src/components/')) return file.replace(/^src\/components\//, 'src/presentation/').replace(/\/[^/]+$/, '');
  if (file.startsWith('src/app/api/')) return 'src/application/api plus domain serializers';
  if (file.startsWith('src/hooks/')) return 'src/application/state';
  if (file.startsWith('src/data/')) return 'domain-owned data module (future boundary review)';
  if (file.startsWith('src/lib/')) return 'domain/application service selected by responsibility';
  return 'retain unless a separate reason-to-change boundary is approved';
}

function plannedWave(file, v1, v2, pharmacology) {
  if (file.startsWith('src/visualization/brain/core/')) return 'NV-0 current-behavior seam; replacement deferred to later NV waves';
  if (file === 'src/components/Brain3D/BrainCanvas.tsx') return 'NV-0 React integration boundary; loading, asset and semantic changes deferred';
  if (file.startsWith('src/domains/pharmacology/repository/')
    || file.startsWith('src/domains/pharmacology/compatibility/')
    || file === 'src/domains/pharmacology/README.md') return 'Wave 2 additive read boundary; no production consumer switch';
  if (file.startsWith('src/domains/pharmacology/model/')
    || file.startsWith('src/domains/pharmacology/validation/')) return 'Wave 1 additive model/validation; no production read switch';
  if (file.startsWith('src/scripts/')) return 'Wave 0 diagnostics; destructive migration script disposition in Wave 8';
  if (file === 'src/types/pharmacology.ts' || file === 'src/data/drugs.v2.ts') return 'future reviewed adapter/migration input; not canonicalized in Wave 1';
  if (file === 'src/data/drugs.ts') return 'Wave 8 deletion only after all gates';
  if (file.includes('/api/chat/') || file.includes('/api/profile/') || file.includes('TreatmentHistory') || file.includes('useScheme')) return pharmacology ? 'Wave 6 persistence/API/AI' : 'outside bounded pharmacology migration';
  if (file.includes('DrugCatalog') || file.includes('ActiveScheme') || file.includes('DoseSlider')) return 'Wave 5 behavior-critical dose/warning UI';
  if (file.includes('RightPanel') || file.includes('ZonePopup')) return 'Wave 6 regional behavior';
  if (file.startsWith('src/lib/indicators/') || file === 'src/lib/pharmacology.ts' || file === 'src/lib/sigma1.ts'
    || file.includes('BottomBar') || file.includes('PresetComparison') || file.includes('CascadeOverlay')) return 'Wave 4 calculations/dual-read';
  if (v2 || pharmacology) return 'Wave 3 narrow projections or later risk-selected wave';
  if (v1) return 'Wave 5–6 according to behavior';
  return 'outside Phase 1 pharmacology scope';
}

function rootArea(file) {
  const parts = file.split('/');
  return parts.slice(0, file.startsWith('src/app/') ? 3 : 2).join('/');
}

const files = walk(srcRoot)
  .filter((file) => path.basename(file) !== '.DS_Store')
  .map(relative);
const raw = new Map();
for (const file of files) {
  const absolute = path.join(root, file);
  if (parseableExtensions.has(path.extname(file))) raw.set(file, analyzeSource(absolute));
  else raw.set(file, { sourceText: file.endsWith('.json') || file.endsWith('.css') ? fs.readFileSync(absolute, 'utf8') : '', directive: null, imports: [], exports: [], sideEffects: file.endsWith('.css') ? ['global style definitions'] : [] });
}

const unresolvedInternal = [];
const moduleInfo = new Map();
for (const file of files) {
  const absolute = path.join(root, file);
  const analyzed = raw.get(file);
  const edges = analyzed.imports.map((entry) => {
    const resolved = resolveInternal(absolute, entry.specifier);
    if (!resolved && (entry.specifier.startsWith('.') || entry.specifier.startsWith('@/'))) {
      unresolvedInternal.push({ from: file, specifier: entry.specifier, kind: entry.kind });
    }
    return { ...entry, resolved: resolved ? relative(resolved) : null };
  });
  moduleInfo.set(file, {
    ...analyzed,
    file,
    layer: layerFor(file),
    runtime: runtimeFor(file, analyzed.directive),
    edges,
    internalDependencies: [...new Set(edges.filter((edge) => edge.resolved).map((edge) => edge.resolved))].sort(),
    runtimeInternalDependencies: [...new Set(edges.filter((edge) => edge.resolved && !edge.typeOnly).map((edge) => edge.resolved))].sort(),
    externalDependencies: [...new Set(edges.filter((edge) => !edge.resolved && !edge.specifier.startsWith('.') && !edge.specifier.startsWith('@/')).map((edge) => edge.specifier))].sort(),
  });
}

const reverse = new Map(files.map((file) => [file, []]));
for (const [file, info] of moduleInfo) {
  for (const dependency of info.internalDependencies) {
    if (reverse.has(dependency)) reverse.get(dependency).push(file);
  }
}
for (const consumers of reverse.values()) consumers.sort();

const closureCache = new Map();
function closure(file, visiting = new Set()) {
  if (closureCache.has(file)) return closureCache.get(file);
  if (visiting.has(file)) return new Set();
  const nextVisiting = new Set(visiting).add(file);
  const result = new Set();
  for (const dependency of moduleInfo.get(file)?.runtimeInternalDependencies ?? []) {
    result.add(dependency);
    for (const nested of closure(dependency, nextVisiting)) result.add(nested);
  }
  closureCache.set(file, result);
  return result;
}

const cycleSet = new Set();
function findCycles(start, current, stack, onStack) {
  for (const dependency of moduleInfo.get(current)?.runtimeInternalDependencies ?? []) {
    if (dependency === start) {
      const cycle = [...stack, start];
      const nodes = cycle.slice(0, -1);
      const rotations = nodes.map((_, index) => [...nodes.slice(index), ...nodes.slice(0, index)].join(' -> '));
      cycleSet.add(rotations.sort()[0]);
    } else if (!onStack.has(dependency) && dependency >= start) {
      findCycles(start, dependency, [...stack, dependency], new Set(onStack).add(dependency));
    }
  }
}
for (const file of files) findCycles(file, file, [file], new Set([file]));
const circularDependencies = [...cycleSet].sort();

const testFiles = fs.existsSync(path.join(root, 'tests'))
  ? walk(path.join(root, 'tests')).filter((file) => parseableExtensions.has(path.extname(file)))
  : [];
const directlyTested = new Set();
const transitivelyTested = new Set();
for (const test of testFiles) {
  const analyzed = analyzeSource(test);
  for (const entry of analyzed.imports) {
    const resolved = resolveInternal(test, entry.specifier);
    if (!resolved || !resolved.startsWith(srcRoot)) continue;
    const sourceFile = relative(resolved);
    directlyTested.add(sourceFile);
    transitivelyTested.add(sourceFile);
    for (const nested of closure(sourceFile)) transitivelyTested.add(nested);
  }
}

const v1File = 'src/data/drugs.ts';
const v2File = 'src/data/drugs.v2.ts';
const scientificDataFiles = new Set([
  v1File, v2File, 'src/data/regional-density.ts', 'src/data/brainRegions.ts', 'src/data/acb-scale.ts',
  'src/constants/receptor-weights.ts',
]);
const persistenceMarkers = [/localStorage|supabase|\/app\/api\/|useScheme|activeScheme|cortexmd_(?:scheme|preset)|user_presets|user_treatment_history|scheme_history|\bdose_mg\b/i];
const aiMarkers = [/\/api\/chat\/|\/Chat\/|aiClient|Anthropic/i];
const visualizationMarkers = [/\/Brain3D\/|\/visualization\/brain\/|Cascade|RegionalDensity|ZonePopup|\bthree\b|brainRegions/i];

function dependencyState(file, predicate) {
  if (predicate(file)) return 'direct/self';
  return [...closure(file)].some(predicate) ? 'transitive' : 'none';
}

function externalClosure(file) {
  const values = new Set(moduleInfo.get(file)?.externalDependencies ?? []);
  for (const dependency of closure(file)) {
    for (const external of moduleInfo.get(dependency)?.externalDependencies ?? []) values.add(external);
  }
  return values;
}

const serverClientBoundaryRisks = [];
const heavyClientDependencyRisks = [];
const deepCrossDomainImports = [];
for (const [file, info] of moduleInfo) {
  if (info.runtime === 'client') {
    for (const dependency of closure(file)) {
      if (moduleInfo.get(dependency)?.runtime === 'server') serverClientBoundaryRisks.push({ client: file, reachesServer: dependency });
    }
    const heavy = [...externalClosure(file)].filter((specifier) => heavyPackages.some((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`)));
    const fullData = [v1File, v2File].filter((candidate) => candidate === file || closure(file).has(candidate));
    if (heavy.length || fullData.length) heavyClientDependencyRisks.push({ client: file, heavyPackages: heavy.sort(), fullScientificData: fullData });
  }
  for (const edge of info.edges.filter((candidate) => candidate.resolved)) {
    if (rootArea(file) !== rootArea(edge.resolved) && (edge.specifier.includes('../..') || edge.specifier.startsWith('@/'))) {
      deepCrossDomainImports.push({ from: file, to: edge.resolved, specifier: edge.specifier });
    }
  }
}

const barrelModules = files.filter((file) => /\/index\.(ts|tsx|js|jsx)$/.test(file)).map((file) => ({
  file,
  reExports: [...new Set(moduleInfo.get(file).edges.filter((edge) => edge.kind === 're-export').map((edge) => edge.resolved ?? edge.specifier))],
  consumers: reverse.get(file),
}));

function noteState(file, markers) {
  const local = `${file}\n${raw.get(file).sourceText}`;
  if (markers.some((marker) => marker.test(local))) return 'direct/self';
  return [...closure(file)].some((dependency) => {
    const nested = `${dependency}\n${raw.get(dependency)?.sourceText ?? ''}`;
    return markers.some((marker) => marker.test(nested));
  }) ? 'transitive' : 'none';
}

const modules = files.map((file) => {
  const info = moduleInfo.get(file);
  const reachable = closure(file);
  const v1 = file === v1File ? 'source/self' : reachable.has(v1File) || info.runtimeInternalDependencies.includes(v1File) ? (info.runtimeInternalDependencies.includes(v1File) ? 'direct' : 'transitive') : 'none';
  const v2 = file === v2File ? 'source/self' : reachable.has(v2File) || info.runtimeInternalDependencies.includes(v2File) ? (info.runtimeInternalDependencies.includes(v2File) ? 'direct' : 'transitive') : 'none';
  const scientific = dependencyState(file, (candidate) => scientificDataFiles.has(candidate));
  const canonicalKnowledgeVocabulary = file === 'src/domains/pharmacology/model/knowledge.ts';
  const heuristic = file === 'src/lib/pharmacology.ts' || file === 'src/lib/sigma1.ts' || file.startsWith('src/lib/indicators/')
    || (!canonicalKnowledgeVocabulary && parseableExtensions.has(path.extname(file))
      && /heuristic|approximation|fallback|placeholder/i.test(info.sourceText));
  const persistence = noteState(file, persistenceMarkers);
  const ai = noteState(file, aiMarkers);
  const visualization = noteState(file, visualizationMarkers);
  const coverage = directlyTested.has(file) ? 'direct test import' : transitivelyTested.has(file) ? 'transitive test reach' : 'no current import-graph test reach';
  const risks = [];
  if (v1 !== 'none' && v2 !== 'none') risks.push('dual V1/V2 reach');
  if (info.runtime === 'client' && (v1 !== 'none' || v2 !== 'none')) risks.push('full pharmacology data in client graph');
  if (info.sideEffects.length) risks.push('top-level side effect/construction');
  if (coverage === 'no current import-graph test reach') risks.push('no import-graph test reach');
  if (heuristic && scientific !== 'none') risks.push('scientific data and derived/heuristic behavior share dependency cone');
  if (persistence !== 'none' && (v1 !== 'none' || v2 !== 'none')) risks.push('persistence/API and pharmacology contract coupled');
  const secondary = [];
  if (heuristic) secondary.push('derived or heuristic behavior');
  if (persistence === 'direct/self') secondary.push('persistence/API contract');
  if (ai === 'direct/self') secondary.push('AI behavior');
  if (visualization === 'direct/self') secondary.push('visualization behavior');
  const pharmacology = v1 !== 'none' || v2 !== 'none' || scientific !== 'none';
  const responsibilityDetails = [primaryResponsibility(file)];
  if (scientific !== 'none') responsibilityDetails.push(`${scientific} scientific-data dependency`);
  if (heuristic) responsibilityDetails.push('derived/heuristic current behavior');
  if (persistence !== 'none') responsibilityDetails.push(`${persistence} persistence/API contract`);
  if (ai !== 'none') responsibilityDetails.push(`${ai} AI behavior`);
  if (visualization !== 'none') responsibilityDetails.push(`${visualization} visualization behavior`);
  const architecturalMix = [];
  if (file.startsWith('src/components/') && scientific !== 'none') architecturalMix.push('CALCULATION + UI', 'DOMAIN + REACT');
  if (scientific !== 'none' && heuristic) architecturalMix.push('SCIENTIFIC FACT + HEURISTIC');
  if (info.runtime === 'client' && serverClientBoundaryRisks.some((risk) => risk.client === file)) architecturalMix.push('SERVER + CLIENT');
  if (info.runtime === 'client' && persistence === 'direct/self') architecturalMix.push('PERSISTENCE + VIEW LOGIC');
  if (file.startsWith('src/data/') && heuristic) architecturalMix.push('SOURCE DATA + CALCULATION');
  return {
    path: file,
    layerDomain: info.layer,
    runtime: info.runtime,
    primaryResponsibility: primaryResponsibility(file),
    responsibilityDetails: [...new Set(responsibilityDetails)],
    secondaryResponsibilities: secondary,
    architecturalMix: [...new Set(architecturalMix)],
    importantExports: info.exports,
    importantInputs: info.internalDependencies,
    importantOutputs: info.exports.length ? info.exports : ['module side effect/data consumed through framework convention'],
    sideEffects: info.sideEffects,
    directDependencies: [...info.internalDependencies, ...info.externalDependencies],
    importantConsumers: reverse.get(file),
    v1Dependency: v1,
    v2Dependency: v2,
    scientificSourceDataDependency: scientific,
    derivedHeuristicBehavior: heuristic ? 'yes — current behavior only; review module details' : 'none detected by source heuristic',
    persistenceApiDependency: persistence,
    aiDependency: ai,
    visualizationDependency: visualization,
    testCoverage: coverage,
    knownGaps: coverage === 'no current import-graph test reach' ? ['no current import path from tests; framework/E2E coverage may still exist'] : [],
    knownRisks: risks,
    proposedFutureDomainModule: proposedDomain(file),
    plannedMigrationWave: plannedWave(file, v1 !== 'none', v2 !== 'none', pharmacology),
  };
});

const productionModules = modules.filter((module) => module.runtime !== 'build-time diagnostic');
const directV1 = productionModules.filter((module) => module.v1Dependency === 'direct');
const directV2 = productionModules.filter((module) => module.v2Dependency === 'direct');
const directDual = productionModules.filter((module) => module.v1Dependency === 'direct' && module.v2Dependency === 'direct');
const transitiveV1 = productionModules.filter((module) => module.v1Dependency === 'direct' || module.v1Dependency === 'transitive');
const transitiveV2 = productionModules.filter((module) => module.v2Dependency === 'direct' || module.v2Dependency === 'transitive');
const transitiveDual = productionModules.filter((module) => ['direct', 'transitive'].includes(module.v1Dependency) && ['direct', 'transitive'].includes(module.v2Dependency));
const pharmacologyCone = productionModules.filter((module) => module.v1Dependency !== 'none' || module.v2Dependency !== 'none' || module.scientificSourceDataDependency !== 'none');
const multiResponsibilityModules = modules
  .filter((module) => module.runtime !== 'build-time diagnostic'
    && parseableExtensions.has(path.extname(module.path))
    && module.secondaryResponsibilities.length >= 2)
  .map((module) => module.path);

let workingTreeBaseCommit = 'unavailable';
try {
  workingTreeBaseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
} catch {
  // Read-only report remains usable outside Git.
}

const report = {
  warning: WARNING,
  repositoryRoot: root,
  characterizationBaselineCommit: CHARACTERIZATION_BASELINE_COMMIT,
  workingTreeBaseCommit,
  summary: {
    sourceFilesCatalogued: modules.length,
    productionModulesCatalogued: productionModules.length,
    buildTimeDiagnosticModules: modules.length - productionModules.length,
    internalEdges: [...moduleInfo.values()].reduce((total, info) => total + info.internalDependencies.length, 0),
    externalImportSpecifiers: [...new Set([...moduleInfo.values()].flatMap((info) => info.externalDependencies))].sort(),
    directV1ProductionConsumers: directV1.length,
    directV2ProductionConsumers: directV2.length,
    directDualProductionConsumers: directDual.length,
    transitiveV1ProductionConsumers: transitiveV1.length,
    transitiveV2ProductionConsumers: transitiveV2.length,
    transitiveDualProductionConsumers: transitiveDual.length,
    pharmacologyDependencyModules: pharmacologyCone.length,
    circularDependencyCount: circularDependencies.length,
    unresolvedInternalImportCount: unresolvedInternal.length,
    serverClientBoundaryRiskCount: serverClientBoundaryRisks.length,
    barrelModuleCount: barrelModules.length,
    heavyClientDependencyRiskCount: heavyClientDependencyRisks.length,
    deepCrossDomainImportCount: deepCrossDomainImports.length,
    topLevelSideEffectModuleCount: modules.filter((module) => module.sideEffects.length).length,
    multiResponsibilityModuleCount: multiResponsibilityModules.length,
  },
  findings: {
    circularDependencies,
    unresolvedInternalImports: unresolvedInternal,
    serverClientBoundaryRisks,
    barrelModules,
    heavyClientDependencyRisks,
    deepCrossDomainImports,
    topLevelSideEffectModules: modules.filter((module) => module.sideEffects.length).map((module) => ({ path: module.path, sideEffects: module.sideEffects })),
    multiResponsibilityModules,
    pharmacologyDependencyCone: pharmacologyCone.map((module) => module.path),
  },
  modules,
};

if (process.argv.includes('--assert')) {
  const failures = [];
  if (report.summary.sourceFilesCatalogued !== files.length) failures.push('not every src file was catalogued');
  if (new Set(modules.map((module) => module.path)).size !== files.length) failures.push('catalog paths are not unique');
  if (unresolvedInternal.length) failures.push(`${unresolvedInternal.length} internal imports did not resolve`);
  if (failures.length) {
    console.error(JSON.stringify({ warning: WARNING, failures, summary: report.summary }, null, 2));
    process.exit(1);
  }
}

if (process.argv.includes('--catalog-json')) {
  console.log(JSON.stringify({
    warning: report.warning,
    characterizationBaselineCommit: report.characterizationBaselineCommit,
    workingTreeBaseCommit: report.workingTreeBaseCommit,
    summary: report.summary,
    modules: report.modules,
  }, null, 2));
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(JSON.stringify({ warning: WARNING, summary: report.summary, findings: report.findings }, null, 2));
}
