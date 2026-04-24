/**
 * docs/allapi 路径与 CMS `getModelWithScene({ model, scene })` 的对应关系：
 * - model = 厂商目录下的模型文件夹名，如 gpt-4.1、gemini-3-pro-image-preview
 * - scene = 文件名去掉 .mdx 后，再去掉文档形态后缀（-response / -chat / -request），
 *   与站点 model 页 URL 中的 scene 一致（如 image-to-text、image-edit）
 */

const DOC_SUFFIXES = ['-response', '-chat', '-request']

const DOC_SUFFIX_LABEL = {
  '-response': 'Response',
  '-chat': 'Chat',
  '-request': 'Request',
}

/** Title 分段连接符（短横线 + 空格，控制长度） */
export const MODEL_PAGE_TITLE_SEP = ' - '

/** @param {string} fileBase 不含扩展名，如 image-to-text-response */
export function fileBaseToApiScene(fileBase) {
  let s = fileBase
  let prev = null
  while (s !== prev) {
    prev = s
    for (const suf of DOC_SUFFIXES) {
      if (s.endsWith(suf)) {
        s = s.slice(0, -suf.length)
        break
      }
    }
  }
  return s
}

/**
 * 从 fileBase 还原文档形态后缀标签（与 fileBaseToApiScene 剥离顺序一致）
 * @returns {string[]} 自外向内，如 ['Response']
 */
export function extractDocVariantLabels(fileBase, apiScene) {
  let cur = fileBase
  const labels = []
  let prev = null
  while (cur !== prev) {
    prev = cur
    for (const suf of DOC_SUFFIXES) {
      if (cur.endsWith(suf)) {
        labels.unshift(DOC_SUFFIX_LABEL[suf])
        cur = cur.slice(0, -suf.length)
        break
      }
    }
  }
  return cur === apiScene ? labels : []
}

/** kebab scene → Title Case 词组，如 image-to-text → Image To Text */
export function kebabSceneToTitleWords(apiScene) {
  return apiScene
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * 路径中的格式目录 → 标题末尾短后缀。
 * **仅**官方线不拼：`official-format`、目录名 `official`、或去后缀后为 `official` 的 `*-format`（不写 `- official`）。
 * 其余 `openai-format`、`gptproto-format`、`official-format-copy` 等仍保留可区分的一段后缀。
 */
export function formatFolderToShortSuffix(format) {
  if (!format || typeof format !== 'string') return ''
  const k = format.trim().toLowerCase()
  if (k === 'official') return ''
  if (k.endsWith('-format')) {
    const base = k.slice(0, -'-format'.length)
    if (base === 'official') return ''
    return base
  }
  return k
}

function formatModelSegment(seg) {
  const lower = seg.toLowerCase()
  if (lower === 'gpt') return 'GPT'
  if (lower === 'api') return 'API'
  if (lower === 'http') return 'HTTP'
  if (lower === 'openai') return 'OpenAI'
  if (/^[\d.]+$/.test(seg)) return seg
  return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
}

/** 模型目录 slug → 标题用展示串，如 gpt-4.1 → GPT-4.1 */
export function formatModelSlugForTitle(model) {
  return model.split('-').map(formatModelSegment).join('-')
}

/**
 * Mintlify frontmatter `title`（页面短标题；**不含站点名**）。
 * 浏览器完整标题由 Mintlify 用 `docs.json` 的 `name` 自动拼接（当前 `name` 为 `API`）。
 * 例：`Gemini-3-Pro-Preview-11-2025 - File Analysis - openai`；`official-format` 无格式后缀（不拼 `- official`）。
 * 有变体：`GPT-4.1 - Image To Text - Response - gptproto`。无 -response/-chat/-request 时省略变体段。
 */
export function buildMintlifyModelPageTitle({ model, format, fileBase, apiScene }) {
  const modelPart = formatModelSlugForTitle(model)
  const scenePart = kebabSceneToTitleWords(apiScene)
  const variantLabels = extractDocVariantLabels(fileBase, apiScene)
  const formatSuffix = format ? formatFolderToShortSuffix(format) : ''
  const parts = [modelPart, scenePart, ...variantLabels]
  if (formatSuffix) parts.push(formatSuffix)
  return parts.join(MODEL_PAGE_TITLE_SEP)
}

/**
 * docs/api 等页的默认 Meta Description（与 title 区分格式，避免多套路径 description 雷同）。
 */
export function buildDefaultModelPageDescription({
  model,
  format,
  fileBase,
  apiScene,
}) {
  const modelPart = formatModelSlugForTitle(model)
  const formatShort = format ? formatFolderToShortSuffix(format) : ''
  const scenePart = kebabSceneToTitleWords(apiScene)
  const variantLabels = extractDocVariantLabels(fileBase, apiScene)
  const v = variantLabels.length ? ` (${variantLabels.join(' ')})` : ''
  const fmt = formatShort ? ` (${formatShort})` : ''
  return `${modelPart} — ${scenePart}${v}${fmt}. GPTProto API reference.`
}

/**
 * 旧版括号标题（仅兼容/对照用；**标准 title 请用 `buildMintlifyModelPageTitle`**）：
 * `gpt-4.1 (Image To Text (Response))`；无文档后缀时为 `gpt-4.1 (Text To Text)`。
 */
export function buildParenStyleSheetTitle({ model, fileBase, apiScene }) {
  const sceneWords = kebabSceneToTitleWords(apiScene)
  const labels = extractDocVariantLabels(fileBase, apiScene)
  if (labels.length === 0) {
    return `${model} (${sceneWords})`
  }
  return `${model} (${sceneWords} (${labels.join(' ')}))`
}

/**
 * @param {string} absOrRel 绝对路径或相对 docs/allapi 的路径
 * @returns {{ vendor: string, model: string, format: string, fileBase: string, apiScene: string, mateKey: string } | null}
 */
function parseUnderDocsMarker(absOrRel, marker) {
  const normalized = absOrRel.replace(/\\/g, '/')
  const idx = normalized.indexOf(marker)
  const rel = idx >= 0 ? normalized.slice(idx + marker.length) : normalized
  const parts = rel.split('/').filter(Boolean)
  if (parts.length < 4) return null
  const vendor = parts[0]
  const model = parts[1]
  const format = parts[2]
  const file = parts[3]
  if (!file.endsWith('.mdx')) return null
  const fileBase = file.slice(0, -4)
  const apiScene = fileBaseToApiScene(fileBase)
  const mateKey = `${vendor}/${model}/${format}/${apiScene}`
  return { vendor, model, format, fileBase, apiScene, mateKey }
}

export function parseAllapiMdxPath(absOrRel) {
  return parseUnderDocsMarker(absOrRel, 'docs/allapi/')
}

/** 与 parseAllapiMdxPath 结构一致，根目录为 docs/api/ */
export function parseApiMdxPath(absOrRel) {
  return parseUnderDocsMarker(absOrRel, 'docs/api/')
}

/** @returns {({ docRoot: 'allapi'|'api', vendor: string, model: string, format: string, fileBase: string, apiScene: string, mateKey: string }) | null} */
export function parseModelDocsMdxPath(absOrRel) {
  const a = parseAllapiMdxPath(absOrRel)
  if (a) return { ...a, docRoot: 'allapi' }
  const p = parseApiMdxPath(absOrRel)
  if (p) return { ...p, docRoot: 'api' }
  return null
}
