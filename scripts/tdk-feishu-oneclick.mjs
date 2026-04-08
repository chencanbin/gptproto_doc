#!/usr/bin/env node
/**
 * 一键完成 TDK 与飞书多维表格同步：
 *
 * 1. 将 Mintlify 竖线格式 title 写回各 MDX（与 model-tdk-export 一致）
 * 2. 导出/刷新 scripts/data/model-tdk-export.csv
 * 3. 推送到飞书（--merge：表格里已有内容的格子不被 CSV 覆盖，只填空行/空列）
 * 4. 从飞书拉回 scripts/data/feishu-tdk-pull.csv
 * 5. 把表格中的 description、keywords 写回 MDX（仅非空单元格会更新）
 *
 * 需配置 .env：飞书凭证与 FEISHU_BITABLE_APP_TOKEN 或 FEISHU_WIKI_NODE_TOKEN
 *
 * 用法：
 *   node scripts/tdk-feishu-oneclick.mjs
 *   node scripts/tdk-feishu-oneclick.mjs --skip-write-titles   # 不改 MDX 标题，只做 2～5
 */
import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadDotEnv, REPO } from './lib/repo-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadDotEnv()

const node = process.execPath

function run(args) {
  const script = args[0].startsWith('/')
    ? args[0]
    : path.join(REPO, args[0])
  const rest = args.slice(1)
  console.log(`\n→ node ${path.relative(REPO, script)} ${rest.join(' ')}`)
  execFileSync(node, [script, ...rest], { cwd: REPO, stdio: 'inherit' })
}

const argv = process.argv.slice(2)
const skipTitles = argv.includes('--skip-write-titles')

async function main() {
  /** 单次遍历：--write-titles 时同时刷新 model-tdk-export.csv */
  run(
    skipTitles
      ? ['scripts/model-tdk-export.mjs']
      : ['scripts/model-tdk-export.mjs', '--write-titles']
  )
  run([
    'scripts/feishu-model-tdk.mjs',
    'push',
    'scripts/data/model-tdk-export.csv',
    '--merge',
  ])
  run([
    'scripts/feishu-model-tdk.mjs',
    'pull',
    '--out',
    'scripts/data/feishu-tdk-pull.csv',
  ])
  run(['scripts/model-tdk-import.mjs', 'scripts/data/feishu-tdk-pull.csv'])

  console.log(
    '\n完成：标题已写入 MDX → 飞书已合并推送 → 已从表格写回 description/keywords（见非空单元格规则）。'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
