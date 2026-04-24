#!/usr/bin/env node
/**
 * 导出 docs/allapi 下各页的 TDK 模板 CSV（Mintlify 竖线 title，供飞书/人工填 Description、Keywords）
 *
 * 标题格式示例：… - openai（无站点后缀；站点名由 docs.json name + Mintlify 拼接）；official-format 无 openai/gptproto 段
 *
 * 用法：
 *   node scripts/model-tdk-export.mjs
 *   node scripts/model-tdk-export.mjs --out scripts/data/model-tdk.csv
 *   node scripts/model-tdk-export.mjs --write-titles   # 同时将上述格式 title 写回各 MDX 的 title:
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildMintlifyModelPageTitle,
  parseAllapiMdxPath,
} from './lib/allapi-mate-key.mjs'
import { stringifyCsvRow } from './lib/csv.mjs'
import { upsertFrontmatterTdk } from './lib/mdx-frontmatter-tdk.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const ALLAPI = path.join(REPO, 'docs/allapi')

const COLS = ['mate_key', 'rel_path', 'title', 'description', 'keywords']

function listMdx(dir) {
  const out = []
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name)
    if (name.isDirectory()) out.push(...listMdx(p))
    else if (name.name.endsWith('.mdx')) out.push(p)
  }
  return out
}

function extractDescription(fm) {
  const m = fm.match(/^description:\s*(.+)$/m)
  if (!m) return ''
  let v = m[1].trim()
  if (
    (v.startsWith("'") && v.endsWith("'")) ||
    (v.startsWith('"') && v.endsWith('"'))
  ) {
    v = v.slice(1, -1).replace(/''/g, "'")
  }
  return v
}

function extractKeywords(fm) {
  const m = fm.match(/^keywords:\n((?:  - [^\n]+\n)+)/m)
  if (!m) return []
  const out = []
  const re = /^  - (.+)$/gm
  let mm
  while ((mm = re.exec(m[1]))) {
    let k = mm[1].trim()
    if (
      (k.startsWith("'") && k.endsWith("'")) ||
      (k.startsWith('"') && k.endsWith('"'))
    ) {
      k = k.slice(1, -1).replace(/''/g, "'")
    }
    out.push(k)
  }
  return out
}

function parseOutArg(argv) {
  const i = argv.indexOf('--out')
  if (i >= 0 && argv[i + 1]) return path.resolve(REPO, argv[i + 1])
  return path.join(REPO, 'scripts/data/model-tdk-export.csv')
}

async function main() {
  const argv = process.argv.slice(2)
  const writeTitles = argv.includes('--write-titles')
  const outPath = parseOutArg(argv)

  const files = listMdx(ALLAPI).sort((a, b) => a.localeCompare(b))
  const rows = []

  for (const abs of files) {
    const parsed = parseAllapiMdxPath(abs)
    if (!parsed) continue
    const rel = path.relative(REPO, abs).replace(/\\/g, '/')
    const title = buildMintlifyModelPageTitle(parsed)
    const raw = fs.readFileSync(abs, 'utf8')
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    const fm = fmMatch ? fmMatch[1] : ''
    const description = extractDescription(fm)
    const kw = extractKeywords(fm)
    const keywordsCell = kw.join(', ')

    rows.push({
      mate_key: parsed.mateKey,
      rel_path: rel,
      title,
      description,
      keywords: keywordsCell,
    })

    if (writeTitles && fmMatch) {
      const newFm = upsertFrontmatterTdk(fmMatch[1], { title })
      const next = `---\n${newFm}\n---\n${raw.slice(fmMatch[0].length)}`
      fs.writeFileSync(abs, next, 'utf8')
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const header = stringifyCsvRow(COLS, Object.fromEntries(COLS.map((c) => [c, c])))
  const body = rows.map((r) => stringifyCsvRow(COLS, r)).join('\n')
  const bom = '\uFEFF'
  fs.writeFileSync(outPath, `${bom}${header}\n${body}\n`, 'utf8')

  console.log(
    `Exported ${rows.length} rows to ${path.relative(REPO, outPath)}`
  )
  if (writeTitles) {
    console.log('Wrote Mintlify-style titles to MDX frontmatter (--write-titles).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
