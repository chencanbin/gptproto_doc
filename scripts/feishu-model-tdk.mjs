#!/usr/bin/env node
/**
 * 飞书多维表格 ↔ 本地 CSV ↔ MDX（TDK）辅助
 *
 * 需环境变量（可放在仓库根 .env，脚本会自动读取）：
 *   FEISHU_APP_ID / FEISHU_APP_SECRET
 *   FEISHU_BITABLE_APP_TOKEN — 优先使用；若为空可设 FEISHU_WIKI_NODE_TOKEN，脚本会通过 Wiki API 解析 obj_token
 *   FEISHU_WIKI_NODE_TOKEN — 知识库页面链接中 …/wiki/ 后的节点 token（可选）
 *   FEISHU_BITABLE_TABLE_ID — 与链接中 table= 一致
 *
 * 表格建议列（单行文本，列名需与之一致或设 FEISHU_COL_* 覆盖）：
 *   mate_key, rel_path, title, description, keywords
 *
 * 说明：全表拉取使用 GET records 分页（不用 search），避免飞书 search 第二页重复第一页的坑。
 *
 * 用法：
 *   node scripts/feishu-model-tdk.mjs pull [--out scripts/data/feishu-tdk.csv]
 *   node scripts/feishu-model-tdk.mjs push <local.csv> [--merge]  # 默认覆盖更新；--merge 时飞书已有非空格子不覆盖
 *   node scripts/feishu-model-tdk.mjs apply [--csv feishu-tdk.csv]  # 从 CSV 调用 model-tdk-import 写 MDX
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { stringifyCsvRow, parseCsvWithHeader } from './lib/csv.mjs'
import { loadDotEnv, REPO } from './lib/repo-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

loadDotEnv()

const API = 'https://open.feishu.cn/open-apis'
const COLS = ['mate_key', 'rel_path', 'title', 'description', 'keywords']

function colName(key) {
  const envKey = `FEISHU_COL_${key.toUpperCase()}`
  return process.env[envKey] || key
}

async function feishuFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`
  const method = opts.method || 'GET'
  const res = await fetch(url, {
    method,
    headers: {
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
    body: method === 'GET' || method === 'HEAD' ? undefined : opts.body,
  })
  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(
      `Feishu API error: ${json.code} ${json.msg || ''} ${JSON.stringify(json)}`
    )
  }
  return json
}

async function getTenantToken() {
  const appId = process.env.FEISHU_APP_ID
  const secret = process.env.FEISHU_APP_SECRET
  if (!appId || !secret) {
    throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET')
  }
  const json = await feishuFetch('/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: JSON.stringify({ app_id: appId, app_secret: secret }),
  })
  return json.tenant_access_token
}

/** 从 Wiki 节点解析多维表格 obj_token（可作 bitable 的 app_token） */
async function resolveAppTokenFromWiki(token) {
  const t = await getTenantToken()
  const url =
    `${API}/wiki/v2/spaces/get_node?token=${encodeURIComponent(token)}`
  const json = await feishuFetch(url, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const node = json.data?.node
  if (!node?.obj_token || node.obj_type !== 'bitable') {
    throw new Error(
      `Wiki node is not bitable: ${JSON.stringify(node?.obj_type)}`
    )
  }
  return node.obj_token
}

async function getBitableAppToken() {
  let app = process.env.FEISHU_BITABLE_APP_TOKEN?.trim()
  if (app) return app
  const wikiNode = process.env.FEISHU_WIKI_NODE_TOKEN?.trim()
  if (wikiNode) {
    console.log('Resolving FEISHU_BITABLE_APP_TOKEN from FEISHU_WIKI_NODE_TOKEN…')
    app = await resolveAppTokenFromWiki(wikiNode)
    console.log('Got app_token from wiki node.')
    return app
  }
  throw new Error(
    'Set FEISHU_BITABLE_APP_TOKEN or FEISHU_WIKI_NODE_TOKEN（见脚本头注释）'
  )
}

/** 确保存在 mate_key / rel_path / title / description / keywords 五列（单行文本） */
async function ensureTableFields(token, appToken, tableId) {
  const { nameToId: existing } = await listFieldsMeta(token, appToken, tableId)
  for (const c of COLS) {
    const name = colName(c)
    if (existing[name]) continue
    try {
      await feishuFetch(
        `/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ field_name: name, type: 1 }),
        }
      )
      console.log(`Created field: ${name}`)
    } catch (e) {
      if (String(e.message).includes('1254014')) continue
      throw e
    }
  }
}

function extractTextValue(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null) {
    if (typeof v.text === 'string') return v.text
    if (Array.isArray(v)) {
      return v.map(extractTextValue).filter(Boolean).join('')
    }
    if (Array.isArray(v.value)) {
      return v.value
        .map((x) => (typeof x === 'string' ? x : x?.text || ''))
        .join('')
    }
  }
  return String(v)
}

/** 将 record.fields（field_id 为键）按列名导出为 CSV 行；nameToId: 列名 → field_id */
function recordToRow(fields, nameToId) {
  const idToName = Object.fromEntries(
    Object.entries(nameToId).map(([name, id]) => [id, name])
  )
  const byName = {}
  for (const [k, val] of Object.entries(fields)) {
    const name = idToName[k] || k
    byName[name] = extractTextValue(val)
  }
  const row = {}
  for (const c of COLS) {
    const cn = colName(c)
    row[c] = byName[cn] ?? ''
  }
  return row
}

async function listFieldsMeta(token, appToken, tableId) {
  const json = await feishuFetch(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const nameToId = {}
  let primaryFieldName = null
  for (const f of json.data?.items || []) {
    nameToId[f.field_name] = f.field_id
    if (f.is_primary) primaryFieldName = f.field_name
  }
  return { nameToId, primaryFieldName }
}

/** 飞书 batch_create / batch_update 的 fields 需用「列名」为键，不能用 field_id */
function rowToFeishuFields(row, nameToId, primaryFieldName) {
  const fields = {}
  for (const c of COLS) {
    const name = colName(c)
    if (!nameToId[name]) continue
    fields[name] = row[c] ?? ''
  }
  /**
   * 新建表默认主列常为「文本」，若未映射到我们的列，界面最左列会一直空白。
   * 用 mate_key 填满主列（与 mate_key 列内容一致，便于浏览）。
   */
  if (
    primaryFieldName &&
    nameToId[primaryFieldName] &&
    fields[primaryFieldName] === undefined
  ) {
    fields[primaryFieldName] = row.mate_key ?? ''
  }
  return fields
}

/**
 * 拉取表内全部记录。使用 GET /records 分页（与 POST /records/search 不同，后者在无 sort 时曾出现第二页重复第一页）。
 */
async function searchAllRecords(token, appToken, tableId) {
  const all = []
  let pageToken
  const basePath = `/bitable/v1/apps/${appToken}/tables/${tableId}/records`
  for (;;) {
    const q = new URLSearchParams({ page_size: '500' })
    if (pageToken) q.set('page_token', pageToken)
    const json = await feishuFetch(`${basePath}?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const items = json.data?.items || []
    for (const it of items) {
      all.push({ record_id: it.record_id, fields: it.fields || {} })
    }
    if (!json.data?.has_more) break
    pageToken = json.data?.page_token
    if (!pageToken) break
  }
  return all
}

async function cmdPull(argv) {
  const appToken = await getBitableAppToken()
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID || 'tblgj7752dy1qLBp'
  const token = await getTenantToken()
  await ensureTableFields(token, appToken, tableId)
  const { nameToId } = await listFieldsMeta(token, appToken, tableId)

  const records = await searchAllRecords(token, appToken, tableId)
  const rows = records
    .map((r) => recordToRow(r.fields, nameToId))
    .filter((row) => String(row.mate_key || '').trim() !== '')

  let outIdx = argv.indexOf('--out')
  const outPath =
    outIdx >= 0 && argv[outIdx + 1]
      ? path.resolve(REPO, argv[outIdx + 1])
      : path.join(REPO, 'scripts/data/feishu-tdk-pull.csv')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const header = stringifyCsvRow(COLS, Object.fromEntries(COLS.map((c) => [c, c])))
  const body = rows.map((r) => stringifyCsvRow(COLS, r)).join('\n')
  fs.writeFileSync(outPath, `\uFEFF${header}\n${body}\n`, 'utf8')
  console.log(`Pulled ${rows.length} records → ${path.relative(REPO, outPath)}`)
}

/** --merge：飞书侧已有非空内容优先，仅填空（mate_key 始终以 CSV 为准） */
function mergeCsvPreferFeishu(normalized, prevRow) {
  const out = { ...normalized }
  for (const c of COLS) {
    if (c === 'mate_key') continue
    const kept = String(prevRow[c] ?? '').trim()
    const inc = String(normalized[c] ?? '').trim()
    out[c] = kept || inc
  }
  out.mate_key = normalized.mate_key
  return out
}

async function cmdPush(csvPath, argvRest = []) {
  const merge = argvRest.includes('--merge')
  if (merge) {
    console.log('push: --merge 已开启（飞书侧已有非空字段保留，仅填空）')
  }
  const appToken = await getBitableAppToken()
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID || 'tblgj7752dy1qLBp'
  const abs = path.resolve(REPO, csvPath)
  const { records } = parseCsvWithHeader(fs.readFileSync(abs, 'utf8'))
  const token = await getTenantToken()
  await ensureTableFields(token, appToken, tableId)
  const { nameToId, primaryFieldName } = await listFieldsMeta(
    token,
    appToken,
    tableId
  )

  const existing = await searchAllRecords(token, appToken, tableId)
  const mateKeyField = colName('mate_key')
  const mkId = nameToId[mateKeyField]
  if (!mkId) {
    throw new Error(
      `Table must have a text column named "${mateKeyField}" (or set FEISHU_COL_MATE_KEY)`
    )
  }

  const byMate = new Map()
  const byMateRow = new Map()
  for (const r of existing) {
    const row = recordToRow(r.fields, nameToId)
    const mk = String(row.mate_key || '').trim()
    if (mk) {
      byMate.set(mk, r.record_id)
      byMateRow.set(mk, row)
    }
  }

  const toCreate = []
  const toUpdate = []

  for (const row of records) {
    const mk = (row.mate_key || row.mateKey || '').trim()
    if (!mk) continue
    const normalized = {
      mate_key: mk,
      rel_path: row.rel_path || '',
      title: row.title || '',
      description: row.description || '',
      keywords: row.keywords || '',
    }
    const rid = byMate.get(mk)
    let payload = normalized
    if (merge && rid) {
      const prev = byMateRow.get(mk) || {}
      payload = mergeCsvPreferFeishu(normalized, prev)
    }
    const fields = rowToFeishuFields(
      payload,
      nameToId,
      primaryFieldName
    )
    if (rid) {
      toUpdate.push({ record_id: rid, fields })
    } else {
      toCreate.push({ fields })
    }
  }

  const postBatch = async (suffix, items) => {
    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100)
      await feishuFetch(
        `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${suffix}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ records: chunk }),
        }
      )
    }
  }

  if (toCreate.length) {
    await postBatch('batch_create', toCreate)
    console.log(`Created ${toCreate.length} records`)
  }
  if (toUpdate.length) {
    await postBatch('batch_update', toUpdate)
    console.log(`Updated ${toUpdate.length} records`)
  }
  if (!toCreate.length && !toUpdate.length) {
    console.log('No rows to push.')
  }
}

async function cmdApply(argv) {
  let csvPath = path.join(REPO, 'scripts/data/feishu-tdk-pull.csv')
  const i = argv.indexOf('--csv')
  if (i >= 0 && argv[i + 1]) csvPath = path.resolve(REPO, argv[i + 1])
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath} (run pull first or pass --csv)`)
  }
  const { execFileSync } = await import('child_process')
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'model-tdk-import.mjs'), csvPath],
    { stdio: 'inherit', cwd: REPO }
  )
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  if (cmd === 'pull') {
    await cmdPull(argv.slice(1))
    return
  }
  if (cmd === 'push') {
    const rest = argv.slice(1).filter((a) => a !== '--merge')
    const csvArg = rest.find((a) => !a.startsWith('--'))
    if (!csvArg) {
      console.error(
        'Usage: node scripts/feishu-model-tdk.mjs push <file.csv> [--merge]'
      )
      process.exit(1)
    }
    await cmdPush(csvArg, argv.slice(1))
    return
  }
  if (cmd === 'apply') {
    await cmdApply(argv.slice(1))
    return
  }

  console.log(`Commands:
  pull [--out path]     Export bitable → CSV
  push <local.csv> [--merge]   CSV → bitable；--merge 时飞书已有非空列不覆盖
  apply [--csv path]    model-tdk-import：CSV → MDX 的 description/keywords
`)
  process.exit(cmd ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
