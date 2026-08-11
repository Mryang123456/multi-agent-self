import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    '用法：node scripts/runtime-init.mjs [--project <name>] [--target <path>] [--force] [--json]',
    '',
    '示例：',
    '  node scripts/runtime-init.mjs --project my-project',
    '  node scripts/runtime-init.mjs --project my-project --force'
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    project: 'my-project',
    target: path.resolve(root, 'runtime/services.local.json'),
    force: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project' && argv[index + 1]) options.project = argv[++index];
    else if (arg === '--target' && argv[index + 1]) options.target = path.resolve(argv[++index]);
    else if (arg === '--force') options.force = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`未知或不完整参数：${arg}\n\n${usage()}`);
    }
  }

  if (!/^[a-z0-9][a-z0-9._-]{1,78}$/i.test(options.project)) {
    throw new Error('project 只能包含字母、数字、点、下划线和短横线，并且不能以符号开头。');
  }

  return options;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function replaceProjectName(registry, project) {
  return {
    ...registry,
    updatedAt: new Date().toISOString(),
    services: registry.services.map((service) => ({ ...service, project }))
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = path.resolve(root, 'runtime/services.local.example.json');
  const targetExists = await exists(options.target);

  if (targetExists && !options.force) {
    const result = {
      ok: true,
      action: 'skipped',
      reason: 'target-exists',
      target: options.target,
      hint: '如需重建，请加 --force。'
    };
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`已存在：${options.target}`);
      console.log('未覆盖。本机配置通常不应被自动重写；如需重建请加 --force。');
    }
    return;
  }

  await mkdir(path.dirname(options.target), { recursive: true });

  if (options.project === 'example-project') {
    await copyFile(source, options.target);
  } else {
    const registry = JSON.parse(await readFile(source, 'utf8'));
    await writeFile(options.target, `${JSON.stringify(replaceProjectName(registry, options.project), null, 2)}\n`, 'utf8');
  }

  const result = {
    ok: true,
    action: targetExists ? 'overwritten' : 'created',
    source,
    target: options.target,
    project: options.project,
    nextSteps: [
      '按本机实际端口和健康检查修改 runtime/services.local.json',
      '运行 node scripts/runtime-status.mjs',
      '运行 node scripts/runtime-health.mjs'
    ]
  };

  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${targetExists ? '已重建' : '已创建'}：${options.target}`);
    console.log(`项目名：${options.project}`);
    console.log('下一步：按本机实际情况修改端口和健康检查，然后运行 runtime-status/runtime-health。');
  }
}

main().catch((error) => {
  console.error(`runtime-init: ${error.message}`);
  process.exitCode = 1;
});
