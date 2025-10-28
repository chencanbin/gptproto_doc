# 🚀 快速开始指南

## 1️⃣ 本地预览（推荐先执行）

在部署前，先在本地预览文档效果：

```bash
# 确保已安装 Mintlify CLI
npm install -g mintlify

# 进入项目目录
cd /Users/benschen/Downloads/cc

# 启动本地开发服务器
mintlify dev
```

浏览器会自动打开 http://localhost:3000

---

## 2️⃣ 部署到 Mintlify（5 分钟）

### 步骤 1: 创建 GitHub 仓库

```bash
# 初始化 Git
git init

# 添加所有文件
git add .

# 创建首次提交
git commit -m "Initial commit: GPTProto API documentation"

# 创建主分支
git branch -M main

# 添加远程仓库（替换成你的仓库地址）
git remote add origin https://github.com/YOUR_USERNAME/gptproto-api-docs.git

# 推送到 GitHub
git push -u origin main
```

### 步骤 2: 连接 Mintlify

1. 访问 https://dashboard.mintlify.com
2. 注册/登录账号
3. 点击 **"New Documentation"**
4. 选择 **"Connect GitHub"**
5. 授权并选择你的仓库
6. 点击 **"Deploy"**

✅ 完成！你的文档将在几分钟内上线

---

## 3️⃣ 查看你的文档

部署完成后，你会获得：
- 🔗 文档 URL: `https://your-project.mintlify.app`
- 📊 Dashboard: 查看访问统计
- 🎨 自定义设置: 配置域名、颜色等

---

## 📝 常用命令

```bash
# 本地开发
mintlify dev

# 检查文档错误
mintlify check

# 手动部署（如果使用 CLI）
mintlify deploy
```

---

## 🎨 自定义配置

### 修改颜色

编辑 `mint.json`:
```json
{
  "colors": {
    "primary": "#YOUR_COLOR",
    "light": "#YOUR_LIGHT_COLOR", 
    "dark": "#YOUR_DARK_COLOR"
  }
}
```

### 添加 Logo

准备 3 个 SVG 文件：
- `logo/light.svg` - 浅色主题 Logo
- `logo/dark.svg` - 深色主题 Logo
- `favicon.svg` - 网站图标

---

## 🔄 更新文档

### 方式 1: 直接编辑 MDX 文件

```bash
# 编辑文档
vim docs/api/openai/chat-mode.mdx

# 提交更改
git add .
git commit -m "Update chat mode documentation"
git push
```

Mintlify 会自动重新部署（1-2 分钟）

### 方式 2: 重新生成（当 API 更新时）

```bash
# 1. 替换 Apifox.json 为新版本
# 2. 重新生成文档
python3 generate_docs.py

# 3. 提交更改
git add .
git commit -m "Regenerate docs from updated Apifox.json"
git push
```

---

## 📁 项目文件说明

| 文件 | 说明 |
|------|------|
| `mint.json` | Mintlify 配置文件 |
| `introduction.mdx` | 文档首页 |
| `quickstart.mdx` | 快速开始 |
| `authentication.mdx` | 认证说明 |
| `docs/api/` | API 文档目录 |
| `generate_docs.py` | 文档生成脚本 |
| `Apifox.json` | 原始 API 定义 |

---

## ❓ 常见问题

### Q: 本地预览时报错？
A: 确保已安装 Node.js 和 Mintlify CLI：
```bash
node --version  # 应该显示版本号
npm install -g mintlify
```

### Q: 如何修改 API 文档内容？
A: 
- 方式 1: 直接编辑 `docs/api/` 下的 MDX 文件
- 方式 2: 在 Apifox 中修改后重新生成

### Q: 部署后看到 404？
A: 检查 `mint.json` 中的路径是否与实际文件匹配

### Q: 如何配置自定义域名？
A: 在 Mintlify Dashboard 中配置 CNAME 记录指向 `cname.mintlify.com`

---

## 📚 更多资源

- 📖 [完整 README](README.md)
- 🚀 [详细部署指南](DEPLOYMENT.md)
- 📊 [项目总结](PROJECT_SUMMARY.md)
- 🌐 [Mintlify 官方文档](https://mintlify.com/docs)

---

## 💡 提示

1. ✅ 先本地预览，确认无误后再部署
2. ✅ 提交前使用有意义的 commit message
3. ✅ 定期从 Apifox 同步最新 API 定义
4. ✅ 关注 Mintlify Dashboard 的使用统计

---

**需要帮助？**
- Mintlify 支持: support@mintlify.com
- GPTProto 支持:  jacoblam3219@gmail.com

祝你使用愉快！🎉
