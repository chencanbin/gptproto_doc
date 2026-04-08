#!/usr/bin/env node
/**
 * TDK 工作流一键脚本（串联已有子脚本）
 *
 * 1) 本地 docs/allapi → 生成 CSV → 推送到飞书多维表格
 * 2) 从飞书拉 CSV → 写回各 MDX 的 description / keywords（及可选 title）
 *
 * 用法：
 *   node scripts/tdk-sync.mjs to-feishu              # 导出 + 推送
 *   node scripts/tdk-sync.mjs to-feishu --write-titles   # 同上，并把括号标题写进 MDX title
 *   node scripts/tdk-sync.mjs from-feishu            # 拉取 + 写入 MDX
 *   node scripts/tdk-sync.mjs from-feishu --csv path/to.csv
 *
 * 依赖：仓库根 .env 中飞书变量（见 scripts/feishu-model-tdk.mjs）
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const NODE = process.execPath

function run(script, args, label) {
  const bin = path.join(__dirname, script)
  console.log(`\n── ${label} ──\n> node ${script} ${args.join(' ')}\n`)
  const r = spawnSync(NODE, [bin, ...args], {
    cwd: REPO,
    stdio: 'inherit',
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

const argv = process.argv.slice(2)
const cmd = argv[0]
const rest = argv.slice(1)

const EXPORT_CSV = 'scripts/data/model-tdk-export.csv'
const PULL_CSV = 'scripts/data/feishu-tdk-pull.csv'

if (cmd === 'to-feishu') {
  const exportArgs = []
  if (rest.includes('--write-titles')) exportArgs.push('--write-titles')
  run('model-tdk-export.mjs', [...exportArgs, '--out', EXPORT_CSV], '1/2 导出 allapi → CSV')
  run('feishu-model-tdk.mjs', ['push', EXPORT_CSV], '2/2 推送 CSV → 飞书')
  console.log('\n完成：飞书表格已更新。在飞书填好 description / keywords 后，执行：')
  console.log('  node scripts/tdk-sync.mjs from-feishu\n')
} else if (cmd === 'from-feishu') {
  const csvIdx = rest.indexOf('--csv')
  const outCsv =
    csvIdx >= 0 && rest[csvIdx + 1]
      ? rest[csvIdx + 1]
      : PULL_CSV
  const pullArgs = ['pull', '--out', outCsv]
  run('feishu-model-tdk.mjs', pullArgs, '1/2 飞书 → CSV')
  run('model-tdk-import.mjs', [outCsv], '2/2 CSV → MDX（description / keywords）')
  console.log('\n完成：已按 CSV 更新 MDX frontmatter。\n')
} else {
  console.log(`用法:
  node scripts/tdk-sync.mjs to-feishu [--write-titles]
      从 docs/allapi 导出 ${EXPORT_CSV} 并推送到飞书

  node scripts/tdk-sync.mjs from-feishu [--csv scripts/data/feishu-tdk-pull.csv]
      从飞书拉表到 CSV，再批量写回 MDX（仅非空单元格会覆盖）

环境变量见 scripts/feishu-model-tdk.mjs（FEISHU_APP_ID、FEISHU_BITABLE_APP_TOKEN 等）。
`)
  process.exit(cmd ? 1 : 0)
}
