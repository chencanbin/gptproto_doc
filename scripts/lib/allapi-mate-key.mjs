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

/** 全角竖线，用于 Mintlify 页面 title（TDK）分段 */
export const MODEL_PAGE_TITLE_SEP = ' ｜ '

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
 * Mintlify frontmatter `title`（TDK），格式：
 * `GPT-4.1 ｜ Image To Text ｜ Response ｜ GPTProto API`
 * 无 -response/-chat/-request 时省略变体段。
 */
export function buildMintlifyModelPageTitle({ model, fileBase, apiScene }) {
  const modelPart = formatModelSlugForTitle(model)
  const scenePart = kebabSceneToTitleWords(apiScene)
  const variantLabels = extractDocVariantLabels(fileBase, apiScene)
  const parts = [modelPart, scenePart, ...variantLabels, 'GPTProto API']
  return parts.join(MODEL_PAGE_TITLE_SEP)
}

/**
 * 飞书/表格导出用括号标题（模型目录名保持小写，与路径一致）：
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
export function parseAllapiMdxPath(absOrRel) {
  const normalized = absOrRel.replace(/\\/g, '/')
  const marker = 'docs/allapi/'
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
