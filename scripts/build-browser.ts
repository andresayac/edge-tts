import { build } from 'esbuild';
import { rmSync, existsSync, mkdirSync } from 'node:fs';

const now = Date.now();

// Limpiar directorio dist/browser si existe
if (existsSync('dist/browser')) {
    rmSync('dist/browser', { recursive: true });
}

mkdirSync('dist/browser', { recursive: true });

console.info('🚀 Building browser bundles...');

// Build ESM (para import moderno)
await build({
    entryPoints: ['src/browser/EdgeTTS.browser.ts'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/browser/edge-tts.esm.js',
    platform: 'browser',
    target: ['es2020'],
    minify: false,
    sourcemap: true,
});

console.info('✅ ESM bundle created');

// Build ESM minified
await build({
    entryPoints: ['src/browser/EdgeTTS.browser.ts'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/browser/edge-tts.esm.min.js',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: true,
});

console.info('✅ ESM minified bundle created');

// Build UMD (para <script> tradicional)
await build({
    entryPoints: ['src/browser/EdgeTTS.browser.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'EdgeTTSModule',
    outfile: 'dist/browser/edge-tts.umd.js',
    platform: 'browser',
    target: ['es2020'],
    minify: false,
    sourcemap: true,
    footer: {
        js: 'window.EdgeTTS = EdgeTTSModule.EdgeTTS; window.EdgeTTSVoice = EdgeTTSModule.Voice;'
    }
});

console.info('✅ UMD bundle created');

// Build UMD minified
await build({
    entryPoints: ['src/browser/EdgeTTS.browser.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'EdgeTTSModule',
    outfile: 'dist/browser/edge-tts.umd.min.js',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: true,
    footer: {
        js: 'window.EdgeTTS = EdgeTTSModule.EdgeTTS; window.EdgeTTSVoice = EdgeTTSModule.Voice;'
    }
});

console.info('✅ UMD minified bundle created');

console.info(`\n🎉 Browser bundles completed in ${Date.now() - now}ms\n`);
console.info('📦 Generated files:');
console.info('  - dist/browser/edge-tts.esm.js (ESM)');
console.info('  - dist/browser/edge-tts.esm.min.js (ESM minified)');
console.info('  - dist/browser/edge-tts.umd.js (UMD for <script> tag)');
console.info('  - dist/browser/edge-tts.umd.min.js (UMD minified)');
