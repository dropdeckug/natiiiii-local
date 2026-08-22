/**
 * NativeBridge Build Tools
 * 
 * Intelligent tool modules that the build system calls at each stage.
 * Each tool is self-contained, composable, and produces structured logs.
 * 
 * PHASE 1: Pre-Build Intelligence
 *   1. projectScanner    — Detect framework, deps, build scripts
 *   2. compatibilityChecker — Validate project can build for target
 *   3. dependencyResolver — Analyze deps, decide install strategy
 *   4. pluginWirer       — Map plugins to permissions, deps, code
 *   5. configGenerator   — Generate configs from version matrix
 * 
 * PHASE 2: Build Execution
 *   6. sourceBundler     — Bundle source into ZIP
 *   7. cloudBuilder      — (edge function) Push to GitHub, trigger CI
 *   8. versionPatcher    — (in-workflow) Patch SDK/AGP/Gradle versions
 * 
 * PHASE 3: Error Handling & Quality
 *   9. buildErrorParser  — Classify Gradle/npm errors
 *  10. artifactDownloader — Download APK from CI
 *  12. manifestMerger    — Merge Android manifest entries
 *  14. buildLogger       — Stream logs to store + DB
 */

export { scanProject, scanResultToLogs, type ProjectScanResult } from "./projectScanner";
export { checkCompatibility, compatibilityToLogs, type CompatibilityResult } from "./compatibilityChecker";
export { resolveDependencies, dependencyResolutionToLogs, type DependencyResolution } from "./dependencyResolver";
export { wirePlugins, pluginWiringToLogs, type PluginWiringResult } from "./pluginWirer";
export { generateBuildConfig, configToLogs, type GeneratedConfig } from "./configGenerator";
export { bundleSource, bundleResultToLogs, type BundleResult } from "./sourceBundler";
export { parseBuildError, parsedErrorToLogs, type ParsedBuildError } from "./buildErrorParser";
export { downloadArtifact, cleanupRepo, type ArtifactResult } from "./artifactDownloader";
export { mergeManifest, mergeResultToLogs, type ManifestMergeResult } from "./manifestMerger";
export { BuildLogger } from "./buildLogger";
export { validateApkArtifact, validationToLogs, type ApkValidationResult } from "./apkValidator";
export { planPluginInjections, applyInjectionPlan, injectionPlanToLogs, resolvePluginIds, type InjectionPlan } from "./pluginCodeInjector";
export { validateProjectForBuild, validationToLogs as projectValidationToLogs, type ValidationResult } from "./projectValidator";
export { indexProject, planProjectGrounding, projectIndexToLogs, repairHtmlBoilerplate, synthesizeStaticPackage, type ProjectIndex, type GroundingResult } from "./projectIndexer";
