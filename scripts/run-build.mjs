import { rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const mode = process.argv[2];

const hasNonAsciiPath = /[^\u0000-\u007f]/.test(projectRoot);
const useWindowsBatchBuild = process.platform === 'win32' && hasNonAsciiPath;

const run = (cwd, command, args) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const runDirectBuild = () => {
  run(projectRoot, process.execPath, [path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-b']);

  const viteArgs = [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'];
  if (mode) {
    viteArgs.push('--mode', mode);
  }

  run(projectRoot, process.execPath, viteArgs);
};

const runWindowsBatchBuild = () => {
  const batchPath = path.join(os.tmpdir(), `who-song-build-${process.pid}.cmd`);
  const viteModeArg = mode ? ` --mode ${mode}` : '';
  const batch = [
    '@echo off',
    'setlocal',
    'set "PROJECT_ROOT=%CD%"',
    'set "TEMP_ROOT=%TEMP%\\who-song-build-%RANDOM%%RANDOM%"',
    'if exist "%TEMP_ROOT%" rmdir /s /q "%TEMP_ROOT%"',
    'mkdir "%TEMP_ROOT%"',
    'robocopy "%PROJECT_ROOT%" "%TEMP_ROOT%" /E /XD .git dist dist-ssr node_modules >nul',
    'if errorlevel 8 exit /b %errorlevel%',
    'mklink /J "%TEMP_ROOT%\\node_modules" "%PROJECT_ROOT%\\node_modules" >nul',
    'pushd "%TEMP_ROOT%"',
    'node "%PROJECT_ROOT%\\node_modules\\typescript\\bin\\tsc" -b',
    'if errorlevel 1 exit /b %errorlevel%',
    `node "%PROJECT_ROOT%\\node_modules\\vite\\bin\\vite.js" build${viteModeArg}`,
    'if errorlevel 1 exit /b %errorlevel%',
    'if exist "%PROJECT_ROOT%\\dist" rmdir /s /q "%PROJECT_ROOT%\\dist"',
    'robocopy "%TEMP_ROOT%\\dist" "%PROJECT_ROOT%\\dist" /E',
    'if errorlevel 8 exit /b %errorlevel%',
    'popd',
    'rmdir /s /q "%TEMP_ROOT%"',
    'exit /b 0',
    '',
  ].join('\r\n');

  writeFileSync(batchPath, batch, 'utf8');

  try {
    run(projectRoot, 'cmd', ['/c', batchPath]);
  } finally {
    rmSync(batchPath, { force: true });
  }
};

if (useWindowsBatchBuild) {
  runWindowsBatchBuild();
} else {
  runDirectBuild();
}
