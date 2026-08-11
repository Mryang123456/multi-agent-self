import net from 'node:net';
import { collectStatus, loadRegistry } from './runtime-status.mjs';

function options(argv) {
  const result = { json: false, registry: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--json') result.json = true;
    else if (argv[index] === '--registry' && argv[index + 1]) result.registry = argv[++index];
    else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  return result;
}

function tcpCheck(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok, detail) => {
      socket.destroy();
      resolve({ ok, detail });
    };
    socket.setTimeout(timeoutMs, () => finish(false, 'timeout'));
    socket.once('connect', () => finish(true, 'connected'));
    socket.once('error', (error) => finish(false, error.code ?? 'connection-error'));
  });
}

async function httpCheck(health) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), health.timeoutMs ?? 3000);
  try {
    const response = await fetch(health.url, { method: 'GET', signal: controller.signal, redirect: 'manual' });
    const expected = health.expectedStatus ?? 200;
    return { ok: response.status === expected, detail: `HTTP ${response.status} (expected ${expected})` };
  } catch (error) {
    return { ok: false, detail: error.name === 'AbortError' ? 'timeout' : 'request-error' };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkService(service) {
  const health = service.health ?? { type: 'tcp', timeoutMs: 2000 };
  const result = health.type === 'http'
    ? await httpCheck(health)
    : await tcpCheck(service.host, service.port, health.timeoutMs ?? 2000);
  return { name: service.name, required: service.required, ok: result.ok, check: health.type, detail: result.detail };
}

async function main() {
  const config = options(process.argv.slice(2));
  const status = await collectStatus(config.registry);
  const { registry } = await loadRegistry(config.registry ?? status.source);
  const probes = await Promise.all(registry.services.map((service) => checkService(service)));
  const probeByKey = new Map(probes.map((probe, index) => [`${registry.services[index].project}:${probe.name}`, probe]));
  const checks = probes.map((probe, index) => {
    const service = registry.services[index];
    const failedDependencies = (service.dependencies ?? []).filter((name) => !probeByKey.get(`${service.project}:${name}`)?.ok);
    if (!failedDependencies.length) return probe;
    return {
      ...probe,
      ok: false,
      detail: `${probe.detail}; unhealthy dependencies: ${failedDependencies.join(', ')}`
    };
  });
  const ok = checks.every((check) => check.ok || !check.required);
  const result = { ok, source: status.source, fallback: status.fallback, checks };
  if (config.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Registry: ${result.source}${result.fallback ? ' (example fallback)' : ''}`);
    console.table(checks);
    console.log(`Overall: ${ok ? 'healthy' : 'unhealthy'}`);
  }
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`runtime-health: ${error.message}`);
  process.exitCode = 1;
});
