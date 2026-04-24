#!/usr/bin/env node
/**
 * 从 GPTProto CMS 拉取 /blueCatAI/server/c/model-scene/detail?model=&scene=
 *
 * 与主站一致：优先使用响应里的 **data.meta**（字符串则 JSON.parse），不要用错成 mate。
 * 解析后的对象结构（ModelPriceDetailMetaContent）：
 *   - **parsed.meta** —— TDK（title / description / keywords / openGraph…），用于 MDX frontmatter 的 SEO
 *   - **parsed.description** —— 正文用的短说明（与 TDK 的 meta.description 不是同一字段）
 *   - **parsed.content** —— 富文本 HTML
 *
 * 若无 data.meta 再回退 data.mate。
 *
 * scene 使用与主站一致：文件名去掉 -response / -chat / -request 后的值（见 scripts/lib/allapi-mate-key.mjs）。
 *
 * 环境变量：
 *   GPTPROTO_API_BASE   必填，如 https://your-api-host（无末尾斜杠，与 gptproto 前端 apiBase 一致）
 *   GPTPROTO_AUTH_HEADER  可选，如 "Bearer xxx" 或 Cookie 等，会放入请求 Authorization
 *
 * 用法：
 *   node scripts/sync-mate-from-api.mjs --dry-run
 *   node scripts/sync-mate-from-api.mjs --limit=10
 *   GPTPROTO_API_BASE=... node scripts/sync-mate-from-api.mjs
 *
 * 默认**只写 TDK**（title / description / keywords）。title：仅路径段 + 可选 openai/gptproto（**不含站点名**；站点名见 docs.json `name`，由 Mintlify 拼接）：
 *   GPT-4.1 - Image To Text - Response - openai
 *   GPT-4.1 - Image To Text（official-format）
 * 同步时会顺带**去掉** MDX 里历史遗留的 CMS 同步块（__sync_mate_* / ModelPageDescription 等）。
 * 仅按路径重写 **title**：**--tdk-titles-from-path**（无需 GPTPROTO_API_BASE）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildMintlifyModelPageTitle,
  parseAllapiMdxPath,
  parseModelDocsMdxPath,
} from './lib/allapi-mate-key.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const ALLAPI = path.join(REPO, 'docs/allapi')
const API_DOCS = path.join(REPO, 'docs/api')

const MATE_MARK_START = '{/* __sync_mate_start__ */}'
const MATE_MARK_END = '{/* __sync_mate_end__ */}'

function parseLimit(argv) {
  const eq = argv.find((a) => a.startsWith('--limit='))
  if (eq) {
    const n = parseInt(eq.split('=')[1], 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const i = argv.indexOf('--limit')
  if (i >= 0 && argv[i + 1]) {
    const n = parseInt(argv[i + 1], 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  return undefined
}

function yamlSq(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

function listMdx(dir) {
  const out = []
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name)
    if (name.isDirectory()) out.push(...listMdx(p))
    else if (name.name.endsWith('.mdx')) out.push(p)
  }
  return out
}

function parseMate(raw) {
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateSeo(s, max = 158) {
  const t = (s || '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

/** 与主站 ModelPriceDetailMetaContent 一致：SEO 用 meta.description，不要用长文案 description 顶替 */
function normalizeMetaBlock(meta) {
  if (meta == null) return {}
  if (typeof meta === 'string') {
    try {
      const o = JSON.parse(meta)
      return typeof o === 'object' && o ? o : {}
    } catch {
      return {}
    }
  }
  return typeof meta === 'object' ? meta : {}
}

/**
 * TDK：只用嵌套字段 parsed.meta（与主站 seo 一致）。
 * 不要用根上的 parsed.description 填 SEO——那是内容摘要。
 */
function extractSeo(parsed) {
  if (!parsed) return { description: '', keywords: [] }
  const meta = normalizeMetaBlock(parsed.meta)
  const og = meta.openGraph && typeof meta.openGraph === 'object' ? meta.openGraph : {}
  const tw = meta.twitter && typeof meta.twitter === 'object' ? meta.twitter : {}

  let description =
    (typeof meta.description === 'string' && meta.description.trim()) ||
    (typeof og.description === 'string' && og.description.trim()) ||
    (typeof tw.description === 'string' && tw.description.trim()) ||
    ''

  if (!description && typeof parsed.content === 'string' && parsed.content.trim()) {
    description = truncateSeo(stripHtml(parsed.content), 158)
  }

  let keywords = []
  const mk = meta.keywords
  if (typeof mk === 'string') {
    keywords = mk.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  } else if (Array.isArray(mk)) {
    keywords = mk.map(String).map((s) => s.trim()).filter(Boolean)
  }

  return { description: truncateSeo(description, 158), keywords }
}

function stripMateMarkers(body) {
  return body.replace(
    /\{\/\* __sync_mate_start__ \*\/\}[\s\S]*?\{\/\* __sync_mate_end__ \*\/\}\s*/g,
    ''
  )
}

/** 移除旧版 ModelDocFromRegistry、ModelPageDescription 及对应 import */
function stripLegacyMateBlocks(body) {
  let c = body
  c = c.replace(/import ModelDocFromRegistry from[^\n]+\n/g, '')
  c = c.replace(/import ModelPageDescription from[^\n]+\n/g, '')
  c = c.replace(/<ModelDocFromRegistry\s+[^/]*\/>\s*/g, '')
  c = c.replace(/<ModelPageDescription[^>]*>[\s\S]*?<\/ModelPageDescription>\s*/g, '')
  return c
}

/** 去掉历史 CMS 同步块与已废弃组件，不写新正文 */
function cleanMdxBodyArtifacts(body) {
  let c = stripMateMarkers(body)
  c = stripLegacyMateBlocks(c)
  return c
}

function stripMateKeyFromFrontmatter(fmText) {
  return fmText.replace(/^mateKey:\s*.+\n?/m, '')
}

async function fetchMate(apiBase, model, scene, headers) {
  const u = new URL('/blueCatAI/server/c/model-scene/detail', apiBase)
  u.searchParams.set('model', model)
  u.searchParams.set('scene', scene)
  const res = await fetch(u.toString(), { headers })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, status: res.status, error: 'invalid json', raw: text.slice(0, 200) }
  }
  const data = json?.data ?? json
  /** 优先 data.meta（与后端约定一致）；兼容旧字段 data.mate */
  const cmsRaw =
    data?.meta ??
    data?.modelScene?.meta ??
    data?.mate ??
    data?.modelScene?.mate ??
    json?.meta ??
    json?.mate
  const mate = parseMate(cmsRaw)
  return {
    ok: res.ok && !!mate,
    status: res.status,
    mate,
    msg: json?.message || json?.msg,
  }
}

function upsertFrontmatter(fmText, { title, description, keywords }) {
  let out = stripMateKeyFromFrontmatter(fmText)

  if (title != null && String(title).trim() !== '') {
    const t = String(title).trim()
    if (/^title:\s/m.test(out)) {
      out = out.replace(/^title:\s.*$/m, `title: ${yamlSq(t)}`)
    } else {
      out = `title: ${yamlSq(t)}\n${out}`
    }
  }

  if (description !== undefined) {
    if (/^description:\s/m.test(out)) {
      out = out.replace(/^description:\s.*$/m, `description: ${yamlSq(description)}`)
    } else if (/^title:\s/m.test(out)) {
      out = out.replace(/(^title:[^\n]+\n)/, `$1description: ${yamlSq(description)}\n`)
    } else {
      out = `description: ${yamlSq(description)}\n${out}`
    }
  }

  if (keywords && keywords.length) {
    const block = `keywords:\n${keywords.map((k) => `  - ${yamlSq(k)}`).join('\n')}\n`
    if (/^keywords:\n(?:  - [^\n]+\n)+/m.test(out)) {
      out = out.replace(/^keywords:\n(?:  - [^\n]+\n)+/m, block)
    } else {
      out = out.replace(/(description:[^\n]+\n)/, `$1${block}`)
    }
  }

  return out
}

async function main() {
  const dry = process.argv.includes('--dry-run')
  const mdxOnly = process.argv.includes('--mdx-only')
  const tdkTitlesFromPath = process.argv.includes('--tdk-titles-from-path')
  const verbose = process.argv.includes('--verbose')
  const limit = parseLimit(process.argv)
  const apiBase = process.env.GPTPROTO_API_BASE || ''
  const auth = process.env.GPTPROTO_AUTH_HEADER

  const files = listMdx(ALLAPI)
  /** @type {Map<string, { model: string, apiScene: string, paths: string[] }>} */
  const byKey = new Map()

  for (const abs of files) {
    const parsed = parseAllapiMdxPath(abs)
    if (!parsed) continue
    const { mateKey, model, apiScene } = parsed
    if (!byKey.has(mateKey)) {
      byKey.set(mateKey, { model, apiScene, paths: [] })
    }
    byKey.get(mateKey).paths.push(abs)
  }

  if (dry) {
    let entries = [...byKey.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )
    if (limit) {
      entries = entries.slice(0, limit)
      console.log(`Unique mateKey count: ${byKey.size} (showing first ${limit} with --limit)`)
    } else {
      console.log(`Unique mateKey count: ${byKey.size}`)
    }
    for (const [k, v] of (limit ? entries : entries.slice(0, 20))) {
      console.log(
        `- ${k}  (model=${v.model}, scene=${v.apiScene}, pages=${v.paths.length})`
      )
    }
    if (!limit && byKey.size > 20) console.log(`  ... and ${byKey.size - 20} more`)
    if (!apiBase) {
      console.log('\nSet GPTPROTO_API_BASE for live fetch (non-dry-run).')
    }
    return
  }

  if (tdkTitlesFromPath) {
    let n = 0
    const tdkFiles = [...listMdx(ALLAPI), ...listMdx(API_DOCS)].sort((a, b) =>
      a.localeCompare(b)
    )
    for (const abs of tdkFiles) {
      const parsed = parseModelDocsMdxPath(abs)
      if (!parsed) continue
      if (limit && n >= limit) break
      const raw = fs.readFileSync(abs, 'utf8')
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
      if (!fmMatch) continue
      const pageTitle = buildMintlifyModelPageTitle(parsed)
      const newFm = upsertFrontmatter(fmMatch[1], { title: pageTitle })
      const out = `---\n${newFm}\n---\n${raw.slice(fmMatch[0].length)}`
      fs.writeFileSync(abs, out, 'utf8')
      n++
    }
    console.log(
      limit
        ? `--tdk-titles-from-path: updated title only in ${n} MDX files (--limit=${limit}).`
        : `--tdk-titles-from-path: updated title only in ${n} MDX files.`
    )
    return
  }

  if (mdxOnly) {
    let n = 0
    for (const abs of files) {
      const parsed = parseAllapiMdxPath(abs)
      if (!parsed) continue
      let raw = fs.readFileSync(abs, 'utf8')
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
      if (!fmMatch) continue
      const newFm = stripMateKeyFromFrontmatter(fmMatch[1])
      const body = cleanMdxBodyArtifacts(raw.slice(fmMatch[0].length))
      const out = `---\n${newFm}\n---\n${body}`
      fs.writeFileSync(abs, out, 'utf8')
      n++
    }
    console.log(
      `--mdx-only: stripped mateKey / registry blocks from ${n} MDX files (no API).`
    )
    return
  }

  if (!apiBase) {
    console.error('Missing GPTPROTO_API_BASE (或使用 --mdx-only 清理旧版块)')
    process.exit(1)
  }

  const headers = { Accept: 'application/json' }
  if (auth) headers.Authorization = auth

  /** @type {Record<string, { description: string, keywords: string[] }>} */
  const seoByKey = {}

  let keysEntries = [...byKey.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  if (limit) {
    keysEntries = keysEntries.slice(0, limit)
    console.log(
      `--limit=${limit}: only fetching and updating these mateKeys (alphabetical order)`
    )
  }
  const processedMateKeys = new Set(keysEntries.map(([k]) => k))

  let printedMateSample = false
  for (let i = 0; i < keysEntries.length; i++) {
    const [mateKey, { model, apiScene }] = keysEntries[i]
    process.stderr.write(
      `\r[${i + 1}/${keysEntries.length}] ${mateKey}                    `
    )
    const result = await fetchMate(apiBase, model, apiScene, headers)
    if (result.ok && result.mate) {
      if (!printedMateSample && process.argv.includes('--print-mate-keys')) {
        console.log('\n[--print-mate-keys] first mate object keys:', Object.keys(result.mate))
        const mm = normalizeMetaBlock(result.mate.meta)
        console.log('[--print-mate-keys] meta.description preview:', (mm.description || '').slice(0, 120))
        printedMateSample = true
      }
      const seo = extractSeo(result.mate)
      seoByKey[mateKey] = seo
      if (verbose) {
        console.log(
          `\nOK ${mateKey}\n  SEO description (${seo.description.length} chars): ${seo.description}\n  keywords: ${seo.keywords.join(', ')}`
        )
      }
    } else {
      process.stderr.write(
        `\nWARN ${mateKey}: status=${result.status} ${result.msg || result.error || ''}\n`
      )
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  process.stderr.write('\n')

  console.log(
    `Fetched SEO for ${Object.keys(seoByKey).length} mateKeys (TDK + strip legacy mate blocks in MDX).`
  )

  let mdxUpdated = 0
  for (const abs of files) {
    const parsed = parseAllapiMdxPath(abs)
    if (!parsed) continue
    const { mateKey } = parsed
    if (limit && !processedMateKeys.has(mateKey)) continue
    const seo = seoByKey[mateKey]
    let raw = fs.readFileSync(abs, 'utf8')
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch) continue

    const existingDesc = fmMatch[1].match(/^description:\s*(.+)$/m)
    const existingDescVal = existingDesc
      ? existingDesc[1].replace(/^['"]|['"]$/g, '').trim()
      : ''

    const desc =
      (seo?.description && seo.description.trim()) ||
      existingDescVal ||
      'GPTProto API endpoint documentation.'

    const pageTitle = buildMintlifyModelPageTitle(parsed)

    let newFm = fmMatch[1]
    newFm = upsertFrontmatter(newFm, {
      title: pageTitle,
      description: desc,
      keywords:
        seo?.keywords && seo.keywords.length > 0 ? seo.keywords : undefined,
    })

    let body = cleanMdxBodyArtifacts(raw.slice(fmMatch[0].length))

    const out = `---\n${newFm}\n---\n${body}`
    fs.writeFileSync(abs, out, 'utf8')
    mdxUpdated++
  }

  console.log(
    limit
      ? `Updated ${mdxUpdated} MDX files (mateKeys in this run only).`
      : `Updated ${mdxUpdated} MDX files (TDK + cleaned legacy blocks).`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
