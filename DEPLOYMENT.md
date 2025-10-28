# Mintlify 部署指南

本指南将帮助你将 GPTProto API 文档部署到 Mintlify 平台。

## 📋 前置要求

- GitHub 账号
- Mintlify 账号（免费注册：https://dashboard.mintlify.com）
- Git 工具已安装

## 🚀 部署步骤

### 第 1 步：准备 GitHub 仓库

1. 在 GitHub 上创建新仓库（建议命名：`gptproto-api-docs`）

2. 在本地项目目录初始化 Git：

```bash
cd /Users/benschen/Downloads/cc
git init
git add .
git commit -m "Initial commit: GPTProto API documentation"
```

3. 连接远程仓库并推送：

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gptproto-api-docs.git
git push -u origin main
```

### 第 2 步：连接 Mintlify

1. 访问 [Mintlify Dashboard](https://dashboard.mintlify.com)

2. 登录或注册账号

3. 点击 **"New Documentation"** 或 **"+"** 按钮

4. 选择 **"Connect GitHub Repository"**

5. 授权 Mintlify 访问你的 GitHub 账号

6. 选择刚才创建的 `gptproto-api-docs` 仓库

7. Mintlify 会自动检测 `mint.json` 配置文件

8. 点击 **"Deploy"** 开始部署

### 第 3 步：配置自定义域名（可选）

1. 在 Mintlify Dashboard 中，进入项目设置

2. 找到 **"Custom Domain"** 选项

3. 添加你的域名（如：docs.gptproto.com）

4. 按照提示配置 DNS 记录：
   - 类型：CNAME
   - 名称：docs
   - 值：cname.mintlify.com

5. 等待 DNS 传播（通常需要几分钟到几小时）

## ✅ 验证部署

部署完成后，你会得到一个 URL：
- 默认 URL: `https://your-project-name.mintlify.app`
- 自定义域名: `https://docs.gptproto.com`（如果配置了）

访问 URL 确认：
- ✅ 首页能正常显示
- ✅ 侧边栏导航完整
- ✅ API 文档可以访问
- ✅ 代码示例正确渲染
- ✅ 搜索功能正常工作

## 🔄 更新文档

当需要更新文档时：

### 方法 1：直接在 GitHub 上编辑

1. 在 GitHub 仓库中编辑 MDX 文件
2. 提交更改
3. Mintlify 会自动检测并重新部署（通常 1-2 分钟）

### 方法 2：本地编辑后推送

1. 在本地修改 MDX 文件
2. 使用 `mintlify dev` 预览更改
3. 提交并推送到 GitHub：

```bash
git add .
git commit -m "Update API documentation"
git push
```

### 方法 3：重新生成文档

如果 Apifox 中的 API 定义有更新：

1. 从 Apifox 导出新的 `Apifox.json`
2. 运行生成脚本：

```bash
python3 generate_docs.py
```

3. 提交并推送更改：

```bash
git add .
git commit -m "Regenerate docs from updated Apifox.json"
git push
```

## 🎨 自定义品牌

### 添加 Logo

1. 准备 SVG 格式的 logo 文件（推荐）
2. 创建 `logo/` 目录
3. 添加以下文件：
   - `logo/light.svg` - 浅色主题 logo
   - `logo/dark.svg` - 深色主题 logo
4. 更新 `favicon.svg`
5. 推送到 GitHub

### 修改颜色主题

编辑 `mint.json`:

```json
{
  "colors": {
    "primary": "#YOUR_PRIMARY_COLOR",
    "light": "#YOUR_LIGHT_COLOR",
    "dark": "#YOUR_DARK_COLOR",
    "anchors": {
      "from": "#YOUR_PRIMARY_COLOR",
      "to": "#YOUR_LIGHT_COLOR"
    }
  }
}
```

## 📊 分析和监控

Mintlify Dashboard 提供：
- 📈 页面访问统计
- 🔍 搜索查询分析
- 👥 用户行为追踪
- ⚡ 性能监控

## 🐛 常见问题

### 问题 1：部署后显示 404

**解决方案**：
- 检查 `mint.json` 中的页面路径是否正确
- 确认所有引用的 MDX 文件都存在
- 查看 Mintlify Dashboard 的部署日志

### 问题 2：样式显示异常

**解决方案**：
- 清除浏览器缓存
- 检查 MDX 语法是否正确
- 确认使用的是 Mintlify 支持的组件

### 问题 3：搜索功能不工作

**解决方案**：
- 等待 Mintlify 完成索引（新部署需要几分钟）
- 检查是否有内容可供搜索
- 联系 Mintlify 支持

### 问题 4：自动部署不触发

**解决方案**：
- 检查 GitHub webhook 配置
- 在 Mintlify Dashboard 中手动触发部署
- 确认推送到了正确的分支（main）

## 🔧 高级配置

### 配置 API Playground

在 `mint.json` 中配置 API 基础 URL：

```json
{
  "api": {
    "baseUrl": "https://gptproto.com",
    "auth": {
      "method": "bearer"
    }
  }
}
```

### 添加分析工具

在 `mint.json` 中添加 Google Analytics：

```json
{
  "analytics": {
    "ga4": {
      "measurementId": "G-XXXXXXXXXX"
    }
  }
}
```

### 配置 OpenAPI/Swagger

如果有 OpenAPI 规范文件：

```json
{
  "openapi": [
    "path/to/openapi.yaml"
  ]
}
```

## 📚 参考资源

- [Mintlify 官方文档](https://mintlify.com/docs)
- [Mintlify 配置参考](https://mintlify.com/docs/settings/global)
- [MDX 组件库](https://mintlify.com/docs/components)
- [自定义配置](https://mintlify.com/docs/settings/custom-domains)

## 💬 获取帮助

- Mintlify Discord: https://discord.gg/mintlify
- Mintlify Support: support@mintlify.com
- GitHub Issues: 在你的仓库中创建 issue

## ✨ 最佳实践

1. **版本控制**：每次更新都创建有意义的 commit message
2. **预览测试**：推送前使用 `mintlify dev` 本地预览
3. **渐进式更新**：分批次更新文档，避免一次性大量修改
4. **保持同步**：定期从 Apifox 同步最新的 API 定义
5. **备份原文件**：保留原始的 `Apifox.json` 文件
6. **监控反馈**：关注文档使用情况，根据用户反馈优化

---

祝你部署顺利！🎉
