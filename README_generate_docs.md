# GPTProto API 文档生成器

## 功能特性

这个脚本可以从 Apifox.json 自动生成 Mintlify MDX 格式的 API 文档，并自动更新 mint.json 的导航配置。

### 主要功能

1. **递归解析 Apifox JSON** - 支持多层嵌套的目录结构
2. **自动生成 MDX 文档** - 为每个 API 生成完整的文档，包括：
   - 参数说明（路径参数、查询参数、请求体参数）
   - 多语言请求示例（cURL, Python, JavaScript, Go）
   - 响应示例和错误处理
3. **自动更新 mint.json** - 根据目录结构生成对应的 navigation 配置
4. **智能分类** - 自动识别并分类不同的 AI 服务（OpenAI, Claude, Gemini 等）

## 使用方法

### 基本用法

```bash
# 使用默认配置
python3 generate_docs.py

# 详细输出模式
python3 generate_docs.py -v

# 自定义路径
python3 generate_docs.py -i Apifox.json -o docs/api -m mint.json
```

### 命令行参数

- `-i, --input` - Apifox JSON 文件路径（默认：`Apifox.json`）
- `-o, --output` - 文档输出目录（默认：`docs/api`）
- `-m, --mint-json` - mint.json 文件路径（默认：`mint.json`）
- `-b, --base-url` - API 基础 URL（默认：`https://gptproto.com`）
- `-v, --verbose` - 启用详细日志

### 示例

```bash
# 生成所有文档
python3 generate_docs.py

# 使用自定义基础 URL
python3 generate_docs.py --base-url https://api.example.com

# 详细模式，查看所有生成过程
python3 generate_docs.py -v
```

## 输出结构

脚本会生成以下内容：

### 1. 文档目录结构

```
docs/api/
├── openai/
│   ├── gpt-4o/
│   │   └── official-format/
│   │       ├── text-to-text.mdx
│   │       └── image-to-text.mdx
│   └── sora/
│       └── official-mode/
│           └── text-to-video.mdx
├── claude/
│   └── claude-3-5-sonnet/
│       └── openai-format/
│           └── text-to-text.mdx
├── gemini/
│   └── veo31/
│       └── gptproto-format/
│           └── text-to-video169.mdx
└── _summary.json
```

### 2. mint.json 导航更新

脚本会自动更新 `mint.json` 的 `navigation` 部分，保留 "Get Started" 等现有导航，并添加所有 API 分类的导航结构。

### 3. 摘要文件

在 `docs/api/_summary.json` 中包含生成统计信息：

```json
{
  "generated_at": "2025-10-31T10:43:57.329775",
  "total_apis": 385,
  "generated_docs": 385,
  "categories": ["OpenAI", "Claude", "Gemini", ...]
}
```

## 工作原理

1. **读取 Apifox.json** - 解析 API 定义文件
2. **递归遍历** - 遍历所有嵌套的 `item` 字段，构建目录树
3. **生成文档** - 为每个 API 生成 MDX 文件，保持目录结构
4. **更新导航** - 根据生成的文档结构更新 mint.json 的 navigation
5. **生成摘要** - 输出生成统计信息

## 目录映射规则

脚本会根据 Apifox.json 的目录结构生成对应的文件系统目录：

```
Apifox.json:
  OpenAI
    └── gpt-4o
        └── Official Format
            └── Text to Text

生成文件:
  docs/api/openai/gpt-4o/official-format/text-to-text.mdx

mint.json navigation:
  {
    "group": "OpenAI",
    "pages": [
      {
        "group": "gpt-4o",
        "pages": [
          {
            "group": "Official Format",
            "pages": ["docs/api/openai/gpt-4o/official-format/text-to-text"]
          }
        ]
      }
    ]
  }
```

## 注意事项

1. **文件名规范化** - 所有文件名和目录名会被转换为小写，并移除特殊字符
2. **覆盖现有文件** - 脚本会覆盖已存在的文档文件
3. **保留 Get Started** - mint.json 中的 "Get Started" 等非 API 导航会被保留
4. **JSON 解析警告** - 某些格式不规范的 JSON 示例可能会产生警告，但不影响文档生成

## 运行结果示例

```
2025-10-31 10:43:57 - INFO - Reading API data from: Apifox.json
2025-10-31 10:43:57 - INFO - Successfully loaded Apifox data
2025-10-31 10:43:57 - INFO - Output directory: docs/api
2025-10-31 10:43:57 - INFO - Extracting API endpoints and generating documentation...
2025-10-31 10:43:57 - INFO - Found 385 API endpoints
2025-10-31 10:43:57 - INFO - Generated 385 documentation files
2025-10-31 10:43:57 - INFO - Updating mint.json...
2025-10-31 10:43:57 - INFO - Updated mint.json with 16 categories
2025-10-31 10:43:57 - INFO - Successfully updated mint.json
2025-10-31 10:43:57 - INFO - 
==================================================
2025-10-31 10:43:57 - INFO - Documentation generation completed!
2025-10-31 10:43:57 - INFO - ==================================================
2025-10-31 10:43:57 - INFO -   Total APIs: 385
2025-10-31 10:43:57 - INFO -   Generated docs: 385
2025-10-31 10:43:57 - INFO -   Categories: 16
```

## 常见问题

### Q: 为什么有些 JSON 示例解析失败？

A: 某些 Apifox 导出的示例可能包含格式不规范的 JSON（如尾随逗号、单引号等）。这些警告不会影响文档生成，脚本会使用默认值。

### Q: 如何自定义分类图标？

A: 在脚本的 `update_mint_json` 函数中的 `category_icons` 字典中添加或修改图标 URL。

### Q: 生成的文档可以直接使用吗？

A: 是的，生成的 MDX 文档符合 Mintlify 规范，可以直接在 Mintlify 文档站点中使用。

## 版本历史

- **v3.0** - 完全重写，支持递归目录结构和自动更新 mint.json
- **v2.0** - 添加多语言示例和改进的参数推断
- **v1.0** - 初始版本

## 作者

Generated with Claude Code

