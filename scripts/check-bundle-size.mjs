import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'

const distDirectory = resolve('dist')
const html = readFileSync(join(distDirectory, 'index.html'), 'utf8')

const javascriptAssets = new Set()
for (const match of html.matchAll(/<(?:script[^>]*type="module"[^>]*src="([^"]+)"|link[^>]*rel="modulepreload"[^>]*href="([^"]+)")/g)) {
  const asset = match[1] ?? match[2]
  if (asset) javascriptAssets.add(asset)
}

const stylesheetAssets = new Set(
  [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match => match[1]),
)

function measure(asset) {
  const path = join(distDirectory, asset.replace(/^\//, ''))
  const bytes = readFileSync(path)
  return { asset, raw: statSync(path).size, gzip: gzipSync(bytes, { level: 9 }).length }
}

function report(label, assets, limits) {
  if (assets.size === 0) throw new Error(`No ${label} assets were found in dist/index.html`)
  const measurements = [...assets].map(measure)
  const totals = measurements.reduce((sum, item) => ({ raw: sum.raw + item.raw, gzip: sum.gzip + item.gzip }), { raw: 0, gzip: 0 })
  const largest = measurements.reduce((current, item) => item.raw > current.raw ? item : current)

  console.log(`${label}: ${totals.raw.toLocaleString()} B raw / ${totals.gzip.toLocaleString()} B gzip`)
  console.log(`Largest ${label.toLowerCase()} file: ${largest.asset} (${largest.raw.toLocaleString()} B raw / ${largest.gzip.toLocaleString()} B gzip)`)

  if (totals.raw > limits.totalRaw || totals.gzip > limits.totalGzip) {
    throw new Error(`${label} total exceeds the configured budget (${limits.totalRaw} B raw / ${limits.totalGzip} B gzip)`)
  }
  if (largest.raw > limits.chunkRaw || largest.gzip > limits.chunkGzip) {
    throw new Error(`Largest ${label.toLowerCase()} file exceeds the configured chunk budget (${limits.chunkRaw} B raw / ${limits.chunkGzip} B gzip)`)
  }
}

report('Initial JavaScript', javascriptAssets, {
  totalRaw: 650_000,
  totalGzip: 210_000,
  chunkRaw: 400_000,
  chunkGzip: 128_000,
})
report('Initial CSS', stylesheetAssets, {
  totalRaw: 110_000,
  totalGzip: 20_000,
  chunkRaw: 110_000,
  chunkGzip: 20_000,
})
