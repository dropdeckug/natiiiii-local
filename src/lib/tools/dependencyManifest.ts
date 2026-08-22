const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;
const SAFE_VERSION = /^(?:[~^<>=*|\s]*\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?|latest|next|workspace:[^\s]+|npm:[^\s]+)$/;

export function sanitizeDependencyManifest(pkg: any): { removed: string[]; changed: boolean } {
  const removed: string[] = [];
  let changed = false;
  for (const bucketName of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const bucket = pkg?.[bucketName];
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) continue;
    for (const [name, version] of Object.entries(bucket)) {
      if (PACKAGE_NAME.test(name) && typeof version === "string" && SAFE_VERSION.test(version)) continue;
      delete bucket[name];
      removed.push(`${name}${typeof version === "string" ? `@${version}` : ""}`);
      changed = true;
    }
  }
  return { removed, changed };
}

export { PACKAGE_NAME, SAFE_VERSION };
