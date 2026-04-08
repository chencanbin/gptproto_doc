/** CSV 单元格转义（RFC 4180 风格） */
export function escapeCsvCell(s) {
  const t = String(s ?? '')
  if (/[",\r\n]/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`
  }
  return t
}

/** 将一行对象按列顺序序列化 */
export function stringifyCsvRow(cols, row) {
  return cols.map((c) => escapeCsvCell(row[c] ?? '')).join(',')
}

/** 简单 CSV 解析（支持双引号包裹与 "" 转义） */
export function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let i = 0
  let inQ = false
  while (i < text.length) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQ = false
        i++
        continue
      }
      cur += ch
      i++
      continue
    }
    if (ch === '"') {
      inQ = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(cur)
      cur = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
      i++
      continue
    }
    cur += ch
    i++
  }
  row.push(cur)
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
    rows.push(row)
  }
  return rows
}

export function parseCsvWithHeader(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''))
  if (rows.length < 1) return { headers: [], records: [] }
  const headers = rows[0].map((h) => h.trim())
  const records = []
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]
    const o = {}
    for (let c = 0; c < headers.length; c++) {
      o[headers[c]] = line[c] ?? ''
    }
    records.push(o)
  }
  return { headers, records }
}
