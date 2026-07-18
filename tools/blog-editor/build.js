const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

// Copy KaTeX assets to vendor directory
const katexDist = path.join(__dirname, 'node_modules/katex/dist')
const vendorKatex = path.join(__dirname, 'vendor/katex')
fs.mkdirSync(vendorKatex, { recursive: true })
fs.cpSync(path.join(katexDist, 'katex.min.css'), path.join(vendorKatex, 'katex.min.css'))
fs.cpSync(path.join(katexDist, 'katex.min.js'), path.join(vendorKatex, 'katex.min.js'))
if (fs.existsSync(path.join(katexDist, 'fonts'))) {
  fs.cpSync(path.join(katexDist, 'fonts'), path.join(vendorKatex, 'fonts'), { recursive: true })
}

const isWatch = process.argv.includes('--watch')

const config = {
  entryPoints: [
    'src/editor.js',
    'src/dashboard.js',
  ],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  sourcemap: true,
  target: ['es2020'],
  logLevel: 'info',
}

if (isWatch) {
  esbuild.context(config).then(ctx => {
    ctx.watch()
    console.log('Watching for changes...')
  })
} else {
  esbuild.build(config).then(() => {
    console.log('Build complete.')
  })
}
