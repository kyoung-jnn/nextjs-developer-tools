import { cp, rm, writeFile } from 'node:fs/promises';
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const preview = process.argv.includes('--preview');
await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', {
  recursive: true,
  filter: (source) => preview || !source.endsWith('panel-preview.html'),
});
if (preview)
  await writeFile(
    'dist/panel-preview.html',
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Payload preview</title><link rel="stylesheet" href="panel-preview.css"></head><body><div id="root"></div><script src="panel-preview.js"></script></body></html>',
  );
const common = {
  bundle: true,
  target: 'chrome120',
  sourcemap: true,
  logLevel: 'info',
  loader: { '.txt': 'text' },
};
const jobs = [
  {
    entryPoints: {
      hook: 'src/content/hook.ts',
      bridge: 'src/content/bridge.ts',
      devtools: 'src/devtools/devtools.ts',
      panel: 'src/panel/main.tsx',
      popup: 'src/popup/main.ts',
      options: 'src/options/main.tsx',
      'panel-worker': 'src/panel/worker.ts',
      ...(preview ? { 'panel-preview': 'src/panel/preview.tsx' } : {}),
    },
    outdir: 'dist',
    format: 'iife',
  },
  { entryPoints: ['src/background/index.ts'], outfile: 'dist/background.js', format: 'esm' },
];
for (const options of jobs) {
  if (watch) {
    const ctx = await context({ ...common, ...options });
    await ctx.watch();
  } else await build({ ...common, ...options });
}
if (watch) {
  const { watch: watchFiles } = await import('node:fs');
  watchFiles('public', { recursive: true }, () => {
    cp('public', 'dist', {
      recursive: true,
      filter: (source) => preview || !source.endsWith('panel-preview.html'),
    }).catch(console.error);
  });
}
