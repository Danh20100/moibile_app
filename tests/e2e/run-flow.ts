import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

function capture(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 15_000,
  });
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function sleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function resolveAdbCommand(): string {
  const sdkRoot = resolveSdkRoot();
  if (sdkRoot) {
    const candidate = join(
      sdkRoot,
      'platform-tools',
      process.platform === 'win32' ? 'adb.exe' : 'adb',
    );
    if (existsSync(candidate)) return candidate;
  }
  return 'adb';
}

function resolveSdkRoot(): string | undefined {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const candidate = join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function waitUntil(label: string, timeoutMs: number, ready: () => boolean): void {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ready()) return;
    sleep(500);
  }
  throw new Error(`${label} not ready within ${timeoutMs}ms`);
}

function leftoverMaestroPids(): number[] {
  if (process.platform !== 'win32') return [];
  const output = capture('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -and $_.CommandLine -match 'maestro' } | Select-Object -ExpandProperty ProcessId",
  ]);
  return output
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function waitForPreviousMaestroExit(): void {
  const deadline = Date.now() + 15_000;
  while (leftoverMaestroPids().length > 0 && Date.now() < deadline) sleep(500);
  for (const pid of leftoverMaestroPids()) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' });
  }
}

function prepareAndroidDevice(): void {
  const adb = resolveAdbCommand();
  spawnSync(adb, ['start-server'], { encoding: 'utf8' });
  waitUntil('Android device online', 60_000, () => {
    spawnSync(adb, ['wait-for-device'], { encoding: 'utf8', timeout: 10_000 });
    const state = capture(adb, ['get-state']).split(/\s+/).pop() ?? '';
    if (state === 'offline' || state === 'unknown') {
      spawnSync(adb, ['reconnect'], { encoding: 'utf8' });
      sleep(1000);
      return false;
    }
    if (state !== 'device') return false;
    return capture(adb, ['shell', 'getprop', 'sys.boot_completed']) === '1';
  });
}

function runMaestro(flowFile: string, env: NodeJS.ProcessEnv): void {
  waitForPreviousMaestroExit();
  prepareAndroidDevice();
  const sdkRoot = resolveSdkRoot();
  const sessionDir = mkdtempSync(join(tmpdir(), 'maestro-session-'));
  const maestroEnv: NodeJS.ProcessEnv = {
    ...env,
    ANDROID_HOME: sdkRoot ?? env.ANDROID_HOME,
    ANDROID_SDK_ROOT: sdkRoot ?? env.ANDROID_SDK_ROOT,
    MAESTRO_CLI_NO_ANALYTICS: env.MAESTRO_CLI_NO_ANALYTICS ?? '1',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED:
      env.MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED ?? 'true',
    MAESTRO_HOME: sessionDir,
  };
  try {
    if (process.platform !== 'win32') {
      run('maestro', ['test', flowFile], maestroEnv);
      return;
    }
    const userProfile = process.env.USERPROFILE;
    const installed = userProfile
      ? join(userProfile, 'maestro', 'maestro', 'bin', 'maestro.bat')
      : undefined;
    const maestroCommand = installed && existsSync(installed) ? installed : 'maestro';
    run(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `call ${maestroCommand} test ${flowFile}`],
      maestroEnv,
    );
  } finally {
    rmSync(sessionDir, { recursive: true, force: true });
  }
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
  runMaestro(flow.maestroFile, {
    ...process.env,
    MAESTRO_CLI_NO_ANALYTICS: process.env.MAESTRO_CLI_NO_ANALYTICS ?? '1',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED:
      process.env.MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED ?? 'true',
  });

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
