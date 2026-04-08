/**
 * 仅用于 TDK（title / description / keywords）的 frontmatter 局部更新
 */

export function yamlSq(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

export function stripMateKeyFromFrontmatter(fmText) {
  return fmText.replace(/^mateKey:\s*.+\n?/m, '')
}

/**
 * @param {string} fmText YAML 正文（不含 ---）
 * @param {{ title?: string|null, description?: string|null, keywords?: string[]|null }} opts
 *   keywords: undefined 表示不改；null 或 [] 表示删除 keywords 块
 */
export function upsertFrontmatterTdk(fmText, { title, description, keywords }) {
  let out = stripMateKeyFromFrontmatter(fmText)

  if (title != null && String(title).trim() !== '') {
    const t = String(title).trim()
    if (/^title:\s/m.test(out)) {
      out = out.replace(/^title:\s.*$/m, `title: ${yamlSq(t)}`)
    } else {
      out = `title: ${yamlSq(t)}\n${out}`
    }
  }

  if (description !== undefined && description !== null) {
    const d = String(description)
    if (/^description:\s/m.test(out)) {
      out = out.replace(/^description:\s.*$/m, `description: ${yamlSq(d)}`)
    } else if (/^title:\s/m.test(out)) {
      out = out.replace(/(^title:[^\n]+\n)/, `$1description: ${yamlSq(d)}\n`)
    } else {
      out = `description: ${yamlSq(d)}\n${out}`
    }
  }

  if (keywords !== undefined && keywords !== null) {
    if (keywords.length === 0) {
      out = out.replace(/^keywords:\n(?:  - [^\n]+\n)+/m, '')
    } else {
      const block = `keywords:\n${keywords.map((k) => `  - ${yamlSq(k)}`).join('\n')}\n`
      if (/^keywords:\n(?:  - [^\n]+\n)+/m.test(out)) {
        out = out.replace(/^keywords:\n(?:  - [^\n]+\n)+/m, block)
      } else if (/^description:\s/m.test(out)) {
        out = out.replace(/(^description:[^\n]+\n)/, `$1${block}`)
      } else if (/^title:\s/m.test(out)) {
        out = out.replace(/(^title:[^\n]+\n)/, `$1${block}`)
      } else {
        out = `${block}${out}`
      }
    }
  }

  return out
}
