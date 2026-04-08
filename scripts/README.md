# 自动化脚本说明

本目录包含 **allapi 文档 TDK**（Title / Description / Keywords）与 **飞书多维表格** 同步工具。需 **Node.js 18+**（内置 `fetch`）。

## 常用命令（`npm run`）

在仓库**根目录**执行。列出全部脚本：`npm run`（不传脚本名）。

| 命令 | 作用 |
|------|------|
| `npm run tdk:export` | allapi → `scripts/data/model-tdk-export.csv` |
| `npm run tdk:export:titles` | 同上，并把 Mintlify `title` 写回各 MDX |
| `npm run tdk:to-feishu` | 导出 CSV → **推飞书**（`push` 无 `--merge`，会覆盖表格行） |
| `npm run tdk:to-feishu:titles` | 同上并写 MDX `title` |
| `npm run tdk:from-feishu` | **拉飞书** → CSV → 写回 MDX（description / keywords 等，仅非空覆盖） |
| `npm run tdk:oneclick` | 导出 → `push --merge` → pull → import（表格已有内容不覆盖） |
| `npm run tdk:oneclick:no-titles` | 一键流程但跳过改 MDX 标题 |
| `npm run tdk:import` | 用默认 `scripts/data/feishu-tdk-pull.csv` 导入 MDX |
| `npm run sync:mate` | CMS → MDX（需 `GPTPROTO_API_BASE` 等，见下文） |
| `npm run feishu:pull` | 飞书 → `scripts/data/feishu-tdk-pull.csv` |
| `npm run feishu:push` | `model-tdk-export.csv` → 飞书 |
| `npm run feishu:push:merge` | 推送时合并填空（不覆盖已有非空） |
| `npm run feishu:apply` | 调用 `model-tdk-import` 把拉取的 CSV 写进 MDX |

**附带参数**：写在 `--` 之后传给底层脚本，例如：

```bash
npm run sync:mate -- --dry-run
npm run sync:mate -- --limit=10 --mdx-only
npm run tdk:from-feishu -- --csv path/to.csv
```

不使用 npm 时，等价于对应用 `node scripts/....mjs ...`（与 `package.json` 的 `scripts` 字段一致）。

## 路径与标题（`lib/allapi-mate-key.mjs`）

- **model**：`docs/allapi/厂商/模型名/...` 中的模型目录名，如 `gpt-4.1`
- **scene**：`.mdx` 文件名去掉扩展名后，再去掉 `-response`、`-chat`、`-request`
- **mateKey**：`厂商/model/格式/scene`，用于 CSV 与飞书行唯一对应

**标题格式（统一标准）**：Mintlify frontmatter `title`，与 `sync-mate-from-api`、`model-tdk-export` 一致：

`GPT-4.1 ｜ Image To Text ｜ Response ｜ GPTProto API`

旧括号样式 `gpt-4.1 (Image To Text (Response))` 已弃用；库中仍保留 `buildParenStyleSheetTitle` 仅供对照。

---

## 一键脚本（任选其一）

### `tdk-sync.mjs` — 拆成「推到飞书」与「从飞书拉回」

```bash
# 本地 allapi → CSV → 飞书（push 默认会更新已有行，见下方说明）
node scripts/tdk-sync.mjs to-feishu
node scripts/tdk-sync.mjs to-feishu --write-titles   # 同时把 Mintlify 竖线 title 写入各 MDX

# 飞书 → CSV → 写回 MDX 的 description / keywords（仅 CSV 非空单元格会覆盖）
node scripts/tdk-sync.mjs from-feishu
node scripts/tdk-sync.mjs from-feishu --csv path/to.csv
```

### `tdk-feishu-oneclick.mjs` — 全流程一条命令

导出 → **push 带 `--merge`**（飞书已有内容不覆盖）→ pull → import。

```bash
node scripts/tdk-feishu-oneclick.mjs
node scripts/tdk-feishu-oneclick.mjs --skip-write-titles   # 不重写 MDX 标题
```

**与 `tdk-sync.mjs` 的差异**：`tdk-sync to-feishu` 调用 `push` **不带** `--merge`，会按 CSV 覆盖飞书整行；若表格里已手填 description，请改用 **`tdk-feishu-oneclick`** 或手动执行 `feishu-model-tdk.mjs push … --merge`。

---

## 分步脚本

### `sync-mate-from-api.mjs` — CMS → MDX frontmatter

从 GPTProto CMS 拉 `meta`（SEO），写入 `docs/allapi/**/*.mdx` 的 `title` / `description` / `keywords`，并清理正文中历史遗留的同步块（`__sync_mate_*`、已废弃组件等）。

**环境变量**：`GPTPROTO_API_BASE`（拉 CMS 时必填）、`GPTPROTO_AUTH_HEADER`（可选）。**`--tdk-titles-from-path`** 仅按路径重写 `title`，**不需要** `GPTPROTO_API_BASE`。

```bash
GPTPROTO_API_BASE=https://你的网关 node scripts/sync-mate-from-api.mjs
node scripts/sync-mate-from-api.mjs --dry-run
node scripts/sync-mate-from-api.mjs --limit=10
node scripts/sync-mate-from-api.mjs --mdx-only
node scripts/sync-mate-from-api.mjs --tdk-titles-from-path
```

### `model-tdk-export.mjs` — allapi → CSV

```bash
node scripts/model-tdk-export.mjs
node scripts/model-tdk-export.mjs --out path/to.csv
node scripts/model-tdk-export.mjs --write-titles
```

默认输出：`scripts/data/model-tdk-export.csv`。

### `model-tdk-import.mjs` — CSV → MDX

按 `mate_key` 更新 frontmatter；**仅非空列**会写入。

```bash
node scripts/model-tdk-import.mjs scripts/data/feishu-tdk-pull.csv
node scripts/model-tdk-import.mjs --dry-run path/to.csv
```

### `feishu-model-tdk.mjs` — 飞书 API

依赖仓库根目录 **`.env`**（可用 `lib/repo-env.mjs` 自动加载），需配置开放平台应用与多维表格。

| 变量 | 说明 |
|------|------|
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书应用 |
| `FEISHU_BITABLE_APP_TOKEN` | 多维表格 `app_token`（浏览器打开表格后 URL 中 `base/` 后一段） |
| `FEISHU_BITABLE_TABLE_ID` | 链接参数 `table=` |
| `FEISHU_WIKI_NODE_TOKEN` | 可选；知识库页面 `…/wiki/` 后的 token，可自动解析 `app_token` |
| `FEISHU_COL_*` | 可选；列名映射，如 `FEISHU_COL_MATE_KEY` |

```bash
node scripts/feishu-model-tdk.mjs pull [--out scripts/data/feishu-tdk-pull.csv]
node scripts/feishu-model-tdk.mjs push scripts/data/model-tdk-export.csv [--merge]
node scripts/feishu-model-tdk.mjs apply [--csv scripts/data/feishu-tdk-pull.csv]
```

- **pull** 使用 **GET `/records`** 分页，避免 `search` 接口第二页重复第一页的问题。
- **push --merge**：飞书侧已有**非空**字段保留，CSV 只填空；新 `mate_key` 则新建行。

---

## 库文件（`lib/`）

| 文件 | 作用 |
|------|------|
| `allapi-mate-key.mjs` | 解析路径、`mateKey`、`buildMintlifyModelPageTitle`（标准 title） |
| `csv.mjs` | CSV 转义与解析 |
| `mdx-frontmatter-tdk.mjs` | 局部更新 YAML frontmatter |
| `repo-env.mjs` | 读取仓库根 `.env` 到 `process.env` |

---

## 数据与密钥

- **`scripts/data/*.csv`**：导出/拉取生成，是否提交由团队约定。
- **`.env`**：含 `GPTPROTO_*`、`FEISHU_*` 等，**勿提交**（已在 `.gitignore`）。

若文档与脚本行为不一致，**以各 `.mjs` 文件内注释为准**。
