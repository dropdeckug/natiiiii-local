/**
 * Dependency doctrine — the platform's fixed rules about dependency graphs.
 *
 * A STATIC document, never model-generated. It is embedded in the repair
 * agent's platform context (Tool 8) and in the runner-executed repair analyst
 * so both reason from the same rules instead of inventing conventions.
 */

export const DEPENDENCY_DOCTRINE = `## Dependency doctrine (authoritative)

### Package manager
- npm is the platform package manager. If a project ships pnpm/yarn/bun
  lockfiles, the matching manager is used, but never two at once — delete the
  extra lockfiles rather than reconciling them.
- Remove a "packageManager" field that names a manager the workflow will not run.

### Lockfiles
- A lockfile is only authoritative when its checksum matches the sealed graph.
  Any drift (plugins toggled, manifest edited, synthetic manifest) means the
  lockfile must be regenerated, not repaired by hand.
- "npm ci" is valid only with an in-sync lockfile. When in doubt:
  delete lockfile -> npm install --package-lock-only -> npm ci.

### Versions and peers
- Never upgrade a dependency that no finding requires.
- Peer conflicts in AI-generated projects are almost always over-strict npm 7+
  resolution, not a real incompatibility: --legacy-peer-deps first, dedupe after.
- react and react-dom must resolve to a single, identical version. A nested
  duplicate React is a blocking defect.
- @capacitor/* packages must share one major line (core, cli, android, and every
  official plugin).
- Build tooling (vite, the framework plugin, typescript) is pinned by the
  platform version matrix; a project pin that contradicts it is replaced.

### Registry reality
- A 404 or "invalid package name" is a manifest defect. No install flag fixes
  it — the package name itself must be corrected by the source repair agent.
- Never publish, log in, or authenticate against a registry.

### Server-only code
- Backend packages (express, prisma, mongoose, fs-extra, bcrypt, node native
  addons) never belong in the web bundle. Exclude the backend workspace instead
  of installing them.
- In a monorepo the frontend workspace is the install root; backend folders are
  ignored entirely.

### Lifecycle scripts
- postinstall/preinstall scripts of native packages are not needed to produce a
  web bundle; --ignore-scripts is an acceptable repair for ELIFECYCLE.

### Non-negotiable
- Never touch .github/workflows, keystores, secrets, or .env values.
- Never mass-reformat, restyle, or refactor while repairing dependencies.
`;
