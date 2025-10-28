# GPTProto API Documentation

本项目是从 Apifox.json 自动生成的 GPTProto API 文档，使用 Mintlify 平台构建。

## 📚 文档概览

本文档包含 **117 个 API 接口**，涵盖以下服务：

- **OpenAI API** (19 个接口): GPT 模型、DALL-E 图像生成、Sora 视频生成、语音转文字等
- **Claude API** (1 个接口): Claude 聊天接口，支持 PDF 分析
- **Gemini API** (22 个接口): Gemini 文本/图像/视频生成、文件上传与分析等
- **其他 API** (58+ 个接口): Midjourney、Grok、Suno 音乐生成等

## 🚀 快速开始

### 本地预览

1. 安装 Mintlify CLI:

```bash
npm install -g mintlify
```

2. 启动本地开发服务器:

```bash
cd /Users/benschen/Downloads/cc
mintlify dev
```

3. 在浏览器中打开 http://localhost:3000

### 项目结构

```
.
├── mint.json                    # Mintlify 配置文件
├── introduction.mdx             # 介绍页面
├── quickstart.mdx               # 快速入门指南
├── authentication.mdx           # 认证文档
├── docs/
│   └── api/
│       ├── openai/             # OpenAI API 文档 (19个)
│       ├── claude/             # Claude API 文档 (1个)
│       ├── gemini/             # Gemini API 文档 (22个)
│       └── other/              # 其他 API 文档 (58个)
├── generate_docs.py            # 文档生成脚本
└── Apifox.json                 # 原始 Apifox 导出文件

```

## 🛠️ 文档生成

本文档由 Python 脚本自动生成。如果需要重新生成：

```bash
python3 generate_docs.py
```

脚本会：
1. 读取 `Apifox.json` 文件
2. 提取所有 API 接口信息
3. 为每个接口生成 MDX 格式的文档
4. 自动分类到 openai/claude/gemini/other 目录

## 📖 文档内容

每个 API 文档包含：

- **概述**: API 功能说明
- **认证**: Bearer Token 认证方式
- **请求参数**: 路径参数、查询参数、请求体参数
- **请求示例**: cURL、Python、JavaScript、Go 代码示例
- **响应格式**: 成功响应和错误响应示例
- **错误处理**: 常见错误代码和处理方法

## 🌐 部署到 Mintlify

### 方式 1: GitHub 集成（推荐）

1. 将项目推送到 GitHub:

```bash
git init
git add .
git commit -m "Initial commit: GPTProto API documentation"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2. 访问 [Mintlify Dashboard](https://dashboard.mintlify.com)

3. 点击 "New Docs" 并连接你的 GitHub 仓库

4. Mintlify 会自动检测 `mint.json` 并部署文档

### 方式 2: 手动部署

如果不使用 GitHub，可以通过 Mintlify CLI 手动部署：

```bash
mintlify deploy
```

## 📝 自定义配置

### 修改品牌颜色

编辑 `mint.json` 中的 `colors` 部分：

```json
{
  "colors": {
    "primary": "#0D9373",
    "light": "#07C983",
    "dark": "#0D9373"
  }
}
```

### 添加 Logo

将 logo 文件放置在项目根目录的 `/logo` 文件夹中：

- `logo/light.svg` - 浅色主题 logo
- `logo/dark.svg` - 深色主题 logo
- `favicon.svg` - 网站图标

### 修改导航结构

编辑 `mint.json` 中的 `navigation` 部分来调整侧边栏结构。

## 🔑 API 认证

所有 API 请求需要在 Header 中包含 Bearer Token：

```bash
Authorization: YOUR_API_KEY
```

获取 API Key：
1. 访问 https://api.gptproto.com
2. 注册并登录
3. 在 Dashboard 中生成 API Key

## 📊 API 统计

- **总接口数**: 117
- **OpenAI 相关**: 21 个
- **Claude 相关**: 1 个
- **Gemini 相关**: 30 个
- **其他服务**: 65 个

## 🔗 相关链接

- [Mintlify 官方文档](https://mintlify.com/docs)
- [Mintlify 组件参考](https://mintlify.com/docs/components)
- [MDX 语法指南](https://mdxjs.com/)

## 📄 许可证

本文档由 Apifox 导出自动生成，用于 GPTProto API 服务。

## 🤝 贡献

如需更新文档：

1. 在 Apifox 中修改 API 定义
2. 导出新的 `Apifox.json` 文件
3. 运行 `python3 generate_docs.py` 重新生成文档
4. 提交更改

## 💡 提示

- 使用 `mintlify dev` 实时预览文档修改
- 修改 MDX 文件后会自动热重载
- 所有 API 端点默认基础 URL: `https://api.gptproto.com`
- 支持的编程语言示例：cURL、Python、JavaScript、Go

## 📞 支持

如有问题，请联系：
- Email: support@gptproto.com
- Website: https://api.gptproto.com
