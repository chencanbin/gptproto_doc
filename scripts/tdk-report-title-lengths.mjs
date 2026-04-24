#!/usr/bin/env node
/**
 * 按当前 buildMintlifyModelPageTitle 规则统计 title 字符长度（UTF-16 码元，与 JS .length 一致）。
 * 另模拟「页面 title + 默认后缀」总长（用于对照 Mintlify `name` 拼接，实际分隔符以 Mintlify 为准）。
 * 用法：node scripts/tdk-report-title-lengths.mjs [阈值默认60]
 * npm：npm run tdk:report:title-lengths -- 55
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildMintlifyModelPageTitle,
  parseModelDocsMdxPath,
} from './lib/allapi-mate-key.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const ALLAPI = path.join(REPO, 'docs/allapi')
const API_DOCS = path.join(REPO, 'docs/api')

const THRESHOLD = parseInt(process.argv[2] || '60', 10) || 60

function listMdx(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name)
    if (name.isDirectory()) out.push(...listMdx(p))
    else if (name.name.endsWith('.mdx')) out.push(p)
  }
  return out
}

const files = [...listMdx(ALLAPI), ...listMdx(API_DOCS)]
const rows = []
for (const abs of files) {
  const parsed = parseModelDocsMdxPath(abs)
  if (!parsed) continue
  const title = buildMintlifyModelPageTitle(parsed)
  rows.push({ rel: path.relative(REPO, abs).replace(/\\/g, '/'), len: title.length, title })
}

rows.sort((a, b) => b.len - a.len)
const over = rows.filter((r) => r.len > THRESHOLD)
const byLen = [...rows].sort((a, b) => a.len - b.len)
const median = byLen.length ? byLen[Math.floor(byLen.length / 2)].len : 0
const hist = {}
for (const r of rows) {
  const b = Math.floor(r.len / 10) * 10
  hist[b] = (hist[b] || 0) + 1
}

console.log(`Parsed ${rows.length} model MDX paths (allapi + api).`)
console.log(`Title length > ${THRESHOLD}: ${over.length} (${((100 * over.length) / rows.length).toFixed(1)}%)`)
console.log(
  `min=${byLen[0]?.len ?? 0} max=${byLen[byLen.length - 1]?.len ?? 0} median=${median}`
)
console.log('\nLength buckets (by floor len/10*10):')
for (const k of Object.keys(hist).sort((a, b) => Number(a) - Number(b))) {
  console.log(`  ${k}-${Number(k) + 9}: ${hist[k]}`)
}
console.log(`\nTop 15 longest (${THRESHOLD}+ chars):`)
for (const r of over.slice(0, 15)) {
  console.log(`  ${r.len}\t${r.rel}`)
  console.log(`      ${r.title}`)
}

/** 与 docs.json `name` 为「GPTProto」或「API」且拼接符为 ` - ` 时的总长对照（仅统计用） */
const VIRTUAL = [
  [' - GPTProto', 'title + " - GPTProto"'],
  [' - API', 'title + " - API"'],
]
console.log(`\n--- 若完整标题 = 页面 title + 后缀（总长 > ${THRESHOLD}）---`)
for (const [suffix, label] of VIRTUAL) {
  const fullLens = rows.map((r) => ({
    rel: r.rel,
    len: r.title.length + suffix.length,
    full: `${r.title}${suffix}`,
  }))
  const overV = fullLens.filter((x) => x.len > THRESHOLD)
  const maxRow = fullLens.reduce((a, b) => (a.len >= b.len ? a : b), fullLens[0])
  console.log(
    `${label}: ${overV.length} (${((100 * overV.length) / rows.length).toFixed(1)}%)  max=${maxRow?.len ?? 0}`
  )
  if (overV.length) {
    fullLens.sort((a, b) => b.len - a.len)
    console.log(`  longest: ${fullLens[0].len}  ${fullLens[0].rel}`)
    console.log(`           ${fullLens[0].full}`)
  }
}
