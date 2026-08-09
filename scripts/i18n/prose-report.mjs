/** Reports the exact same authoritative offender list as the Jest gate. */
import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const scannerPath = path.resolve('src/i18n/hardcoded-prose.ts');
const compiled = ts.transpileModule(fs.readFileSync(scannerPath, 'utf8'), {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const scannerModule = new Module(scannerPath);
scannerModule.filename = scannerPath;
scannerModule.paths = Module._nodeModulePaths(process.cwd());
scannerModule._compile(compiled, scannerPath);

const offenders = scannerModule.exports.allOffenders();
const byFile = new Map();
for (const offender of offenders) {
  const entries = byFile.get(offender.file) ?? [];
  entries.push(offender);
  byFile.set(offender.file, entries);
}

console.log(`hardcoded prose remaining: ${offenders.length}`);
for (const [file, entries] of [...byFile].sort(
  (left, right) => right[1].length - left[1].length,
)) {
  console.log(`\n${entries.length} ${file}`);
  for (const entry of entries) console.log(`  ${entry.line}: ${entry.text}`);
}

if (offenders.length > 0) process.exitCode = 1;
