import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const originalExec = childProcess.exec;

childProcess.exec = (command, options, callback) => {
  let resolvedOptions = options;
  let resolvedCallback = callback;

  if (typeof resolvedOptions === 'function') {
    resolvedCallback = resolvedOptions;
    resolvedOptions = undefined;
  }

  if (String(command).trim().toLowerCase() === 'net use') {
    const done = resolvedCallback ?? (() => {});
    queueMicrotask(() => done(null, '', ''));
    return {
      kill() {},
      pid: undefined,
    };
  }

  return originalExec(command, resolvedOptions, resolvedCallback);
};

syncBuiltinESMExports();
