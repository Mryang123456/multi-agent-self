import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function options(argv) {
  const result = { json: false, registry: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--json') result.json = true;
    else if (argv[index] === '--registry' && argv[index + 1]) result.registry = argv[++index];
    else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  return result;
}

function validateRegistry(registry) {
  if (!registry || registry.version !== 1 || !Array.isArray(registry.services) || registry.services.length === 0) {
    throw new Error('Unsupported registry shape');
  }
  const keys = new Set();
  for (const service of registry.services) {
    if (!service || typeof service.project !== 'string' || !service.project || typeof service.name !== 'string' || !service.name) {
      throw new Error('Every service requires non-empty project and name fields');
    }
    if (typeof service.host !== 'string' || !service.host || !Number.isInteger(service.port) || service.port < 1 || service.port > 65535) {
      throw new Error(`Invalid endpoint for ${service.project}/${service.name}`);
    }
    const key = `${service.project}:${service.name}`;
    if (keys.has(key)) throw new Error(`Duplicate service: ${key}`);
    keys.add(key);
    if (service.health?.type === 'http' && typeof service.health.url !== 'string') {
      throw new Error(`HTTP health URL missing for ${key}`);
    }
  }
  for (const service of registry.services) {
    for (const dependency of service.dependencies ?? []) {
      if (!keys.has(`${service.project}:${dependency}`)) {
        throw new Error(`Unknown dependency ${service.project}:${dependency} for ${service.project}:${service.name}`);
      }
    }
  }
}

export async function loadRegistry(requestedPath) {
  const localPath = path.resolve(root, 'runtime/services.local.json');
  const examplePath = path.resolve(root, 'runtime/services.local.example.json');
  const candidates = requestedPath ? [path.resolve(requestedPath)] : [localPath, examplePath];
  let lastError;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await readFile(candidate, 'utf8'));
      validateRegistry(parsed);
      return { registry: parsed, source: candidate, fallback: !requestedPath && candidate === examplePath };
    } catch (error) {
      lastError = error;
      if (error?.code !== 'ENOENT') throw new Error(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(`Registry not found: ${lastError?.message ?? 'no candidate'}`);
}

function pidState(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return 'untracked';
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    return error?.code === 'EPERM' ? 'alive-uninspectable' : 'missing';
  }
}

export async function collectStatus(requestedPath) {
  const loaded = await loadRegistry(requestedPath);
  const services = loaded.registry.services.map((service) => ({
    project: service.project,
    name: service.name,
    kind: service.kind,
    endpoint: `${service.host}:${service.port}`,
    pid: service.pid ?? null,
    pidState: pidState(service.pid),
    ownerAgent: service.ownerAgent ?? null,
    sessionId: service.sessionId ?? null,
    buildId: service.buildId ?? null,
    required: service.required,
    dependencies: service.dependencies ?? []
  }));
  return { source: loaded.source, fallback: loaded.fallback, updatedAt: loaded.registry.updatedAt ?? null, services };
}

async function main() {
  const config = options(process.argv.slice(2));
  const result = await collectStatus(config.registry);
  if (config.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Registry: ${result.source}${result.fallback ? ' (example fallback)' : ''}`);
    console.table(result.services);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`runtime-status: ${error.message}`);
    process.exitCode = 1;
  });
}
