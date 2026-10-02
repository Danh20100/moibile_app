import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface FlowDefinition {
  maestroFile: string;
  assertionFile: string;
}

const FLOW_DEFINITIONS: Record<string, FlowDefinition> = {
  'DISC-01': {
    maestroFile: 'tests/e2e/maestro/discovery.yaml',
    assertionFile: 'tests/e2e/assertions/discovery.ts',
  },
  'DISC-02': {
    maestroFile: 'tests/e2e/maestro/listing-detail.yaml',
    assertionFile: 'tests/e2e/assertions/discovery.ts',
  },
};

function run(
  command: string,
  args: string[],
  shell = false,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

function sleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function resolveAdbCommand(): string {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdkRoot) {
    const candidate = join(
      sdkRoot,
      'platform-tools',
      process.platform === 'win32' ? 'adb.exe' : 'adb',
    );
    if (existsSync(candidate)) return candidate;
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const candidate = join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
    if (existsSync(candidate)) return candidate;
  }
  return 'adb';
}

function prepareAndroidDevice(): void {
  const adb = resolveAdbCommand();
  run(adb, ['wait-for-device']);
  run(adb, ['shell', 'am', 'force-stop', 'dev.mobile.maestro']);
  run(adb, ['shell', 'am', 'force-stop', 'dev.mobile.maestro.test']);
  sleep(750);
}

function runMaestro(flowFile: string, env: NodeJS.ProcessEnv): void {
  prepareAndroidDevice();
  if (process.platform !== 'win32') {
    run('maestro', ['test', flowFile], false, env);
    return;
  }

  const userProfile = process.env.USERPROFILE;
  const installed = userProfile
    ? join(userProfile, 'maestro', 'maestro', 'bin', 'maestro.bat')
    : undefined;
  const maestroCommand = installed && existsSync(installed) ? installed : 'maestro';
  const commandLine = `call ${maestroCommand} test ${flowFile}`;
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], false, env);
}

function runNodeScript(file: string): void {
  run(process.execPath, ['--env-file=.env', '--import', 'tsx', file]);
}

function main(): void {
  const flowId = process.argv[2]?.trim().toUpperCase();
  if (!flowId) {
    throw new Error(
      `Usage: pnpm e2e:flow <FLOW_ID>\nSupported: ${Object.keys(FLOW_DEFINITIONS).join(', ')}`,
    );
  }

  const flow = FLOW_DEFINITIONS[flowId];
  if (!flow) {
    throw new Error(
      `Flow ${flowId} is not executable yet. Supported: ${Object.keys(FLOW_DEFINITIONS).join(', ')}`,
    );
  }

  console.log(`\n=== ${flowId}: reset ===`);
  runNodeScript('tests/e2e/seed/reset.ts');
  console.log(`\n=== ${flowId}: seed ===`);
  runNodeScript('tests/e2e/seed/seed.ts');

  console.log(`\n=== ${flowId}: Android / Maestro ===`);
  const maestroEnv = {
    ...process.env,
    MAESTRO_CLI_NO_ANALYTICS: process.env.MAESTRO_CLI_NO_ANALYTICS ?? '1',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED:
      process.env.MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED ?? 'true',
  };
  runMaestro(flow.maestroFile, maestroEnv);

  console.log(`\n=== ${flowId}: API + PostgreSQL + invariants ===`);
  runNodeScript(flow.assertionFile);
  console.log(`\n=== ${flowId}: PASS ===`);
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
