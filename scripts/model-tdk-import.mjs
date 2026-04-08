#!/usr/bin/env node
/**
 * 从 CSV 批量写回各 MDX 的 description、keywords（可选 title）
 * CSV 需含列：mate_key（必填）, description, keywords；可选 title, rel_path
 *
 * keywords 列：英文逗号分隔；若某项含逗号，请在 CSV 中用双引号包裹该单元格。
 *
 * 用法：
 *   node scripts/model-tdk-import.mjs scripts/data/model-tdk-export.csv
 *   node scripts/model-tdk-import.mjs --dry-run path/to.csv
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseAllapiMdxPath } from './lib/allapi-mate-key.mjs'
import { parseCsvWithHeader } from './lib/csv.mjs'
import { upsertFrontmatterTdk } from './lib/mdx-frontmatter-tdk.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const ALLAPI = path.join(REPO, 'docs/allapi')

function listMdx(dir) {
  const out = []
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name)
    if (name.isDirectory()) out.push(...listMdx(p))
    else if (name.name.endsWith('.mdx')) out.push(p)
  }
  return out
}

/** 关键词：含 `|` 则按 `|` 拆；否则按英文逗号拆（CSV 单元格内逗号请用整列双引号包裹） */
function splitKeywords(cell) {
  const s = String(cell ?? '').trim()
  if (!s) return []
  if (s.includes('|')) {
    return s
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

async function main() {
  const argv = process.argv.slice(2)
  const dry = argv.includes('--dry-run')
  const args = argv.filter((a) => !a.startsWith('--'))
  const csvPath = args[0] ? path.resolve(REPO, args[0]) : null
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage: node scripts/model-tdk-import.mjs [--dry-run] <path-to.csv>')
    process.exit(1)
  }

  const { records } = parseCsvWithHeader(fs.readFileSync(csvPath, 'utf8'))
  const byKey = new Map()
  for (const r of records) {
    const k = (r.mate_key || r.mateKey || '').trim()
    if (k) byKey.set(k, r)
  }

  const files = listMdx(ALLAPI)
  let n = 0
  let skip = 0

  for (const abs of files) {
    const parsed = parseAllapiMdxPath(abs)
    if (!parsed) continue
    const row = byKey.get(parsed.mateKey)
    if (!row) {
      skip++
      continue
    }

    const raw = fs.readFileSync(abs, 'utf8')
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch) continue

    /** 仅写入非空单元格，避免空 CSV 格误清空已有 TDK */
    const patch = {}
    const title = String(row.title ?? '').trim()
    if (title) patch.title = title
    const desc = String(row.description ?? '').trim()
    if (desc) patch.description = desc
    const kwRaw = String(row.keywords ?? '').trim()
    if (kwRaw) patch.keywords = splitKeywords(kwRaw)

    if (Object.keys(patch).length === 0) continue

    const newFm = upsertFrontmatterTdk(fmMatch[1], patch)
    const out = `---\n${newFm}\n---\n${raw.slice(fmMatch[0].length)}`

    if (dry) {
      console.log(`[dry-run] ${parsed.mateKey}`)
    } else {
      fs.writeFileSync(abs, out, 'utf8')
    }
    n++
  }

  console.log(
    dry
      ? `[dry-run] would update ${n} files (${skip} MDX had no matching mate_key in CSV).`
      : `Updated ${n} MDX files (${skip} files not listed in CSV).`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
