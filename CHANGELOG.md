# Changelog

## Version 3.1 (2025-10-31)

### 新功能

1. **Request Body 参数增强**
   - 参数说明现在包含默认值信息
   - 默认值从 Request Example 中自动提取
   - 格式：`{description} (default: {value})`
   - 示例：
     ```
     <ParamField body="model" type="string" required>
       The model to use for the request (default: `"claude-3-5-haiku-20241022"`)
     </ParamField>
     ```

2. **更新错误响应格式**
   - 使用 GPTProto 标准错误响应格式
   - 包含以下错误类型：
     - 401 - Invalid signature
     - 403 - Invalid Token
     - 403 - Insufficient balance
     - 500 - Internal server error
     - 503 - Content policy violation

### 改进

- 添加 `format_default_value()` 函数，智能格式化不同类型的默认值
- 改进参数解析逻辑，同时提取示例值和默认值
- 优化错误响应文档的可读性

## Version 3.0 (2025-10-31)

### 重大更新

1. **完全重写脚本架构**
   - 支持递归遍历 Apifox.json 的嵌套目录结构
   - 自动生成和更新 mint.json 的 navigation 配置
   - 引入 `NavigationNode` 类构建导航树

2. **功能增强**
   - 支持任意层级的目录嵌套
   - 保留现有的 "Get Started" 等非 API 导航
   - 为每个分类添加对应的图标
   - 生成统计摘要文件

3. **代码改进**
   - 添加详细的日志记录
   - 支持命令行参数自定义配置
   - 改进错误处理和验证

### 生成结果

- ✅ 385 个 API 端点
- ✅ 385 个 MDX 文档文件
- ✅ 16 个分类目录
- ✅ 自动更新 mint.json navigation

## Version 2.0

### 功能特性

- 多语言请求示例 (cURL, Python, JavaScript, Go)
- 改进的参数类型推断
- 智能参数描述生成

## Version 1.0

### 初始版本

- 基础的 Apifox JSON 解析
- 生成 Mintlify MDX 文档
- 简单的分类支持
