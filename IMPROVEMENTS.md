# generate_docs.py v3.1 改进说明

## 改进 1: Request Body 参数显示默认值

### 改进前 (v3.0)

```markdown
## Request Body

<ParamField body="model" type="string" required>
  The model to use for the request
</ParamField>

<ParamField body="messages" type="array" required>
  Array of message objects for the conversation
</ParamField>

<ParamField body="stream" type="boolean" >
  Whether to stream the response
</ParamField>
```

### 改进后 (v3.1)

```markdown
## Request Body

<ParamField body="model" type="string" required>
  The model to use for the request (default: `"claude-3-5-haiku-20241022"`)
</ParamField>

<ParamField body="messages" type="array" required>
  Array of message objects for the conversation (default: `[{"role": "user", "content": "Who are you?"}]`)
</ParamField>

<ParamField body="stream" type="boolean" >
  Whether to stream the response (default: `false`)
</ParamField>
```

### 优势

- ✅ 用户可以直接看到每个参数的默认值
- ✅ 默认值与 Request Example 中的示例值保持一致
- ✅ 提高文档的实用性和可读性
- ✅ 减少用户查看示例代码的需要

---

## 改进 2: 更新错误响应格式

### 改进前 (v3.0)

```json
## Error Responses

```json 400 - Bad Request
{
  "error": {
    "message": "Invalid request parameters",
    "type": "invalid_request_error",
    "code": "invalid_parameters"
  }
}
```

```json 401 - Unauthorized
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

```json 429 - Rate Limit Exceeded
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```
```

### 改进后 (v3.1)

```json
## Error Responses

```json 401 - Invalid signature
{
  "error": {
    "message": "Invalid signature",
    "type": "401"
  }
}
```

```json 403 - Invalid Token
{
  "error": {
    "message": "Invalid Token",
    "type": "403"
  }
}
```

```json 403 - Insufficient balance
{
  "error": {
    "message": "Insufficient balance",
    "type": "403"
  }
}
```

```json 500 - Internal server error
{
  "error": {
    "message": "Internal server error",
    "type": "500"
  }
}
```

```json 503 - Content policy violation
{
  "error": {
    "message": "Input may not meet the guidelines. Please adjust and try again.",
    "type": "503"
  }
}
```
```

### 优势

- ✅ 使用 GPTProto 实际的错误响应格式
- ✅ 覆盖更多实际可能遇到的错误场景
- ✅ 错误类型使用 HTTP 状态码，更简洁直观
- ✅ 包含账户余额、内容策略等业务相关的错误

---

## 技术实现

### 1. 新增 `format_default_value()` 函数

```python
def format_default_value(value: Any) -> str:
    """格式化默认值以便在文档中显示"""
    if isinstance(value, str):
        return f'`"{value}"`'
    elif isinstance(value, bool):
        return f'`{str(value).lower()}`'
    elif isinstance(value, (int, float)):
        return f'`{value}`'
    elif isinstance(value, list):
        return f'`{json.dumps(value, ensure_ascii=False)}`'
    elif isinstance(value, dict):
        return f'`{json.dumps(value, ensure_ascii=False)}`'
    else:
        return f'`{value}`'
```

**功能**：智能格式化不同类型的默认值
- 字符串：添加引号 `"value"`
- 布尔值：转换为小写 `true`/`false`
- 数字：直接显示 `123`
- 数组/对象：JSON 格式化

### 2. 改进 `parse_request_body_params()` 函数

```python
params.append({
    'name': key,
    'type': param_type,
    'description': param_desc,
    'required': required,
    'example': value,
    'default': format_default_value(value)  # 新增默认值字段
})
```

**改进**：在参数字典中添加 `default` 字段

### 3. 更新文档生成逻辑

```python
param_default = param.get('default', '')

# 如果有默认值，添加到描述中
if param_default:
    param_desc_with_default = f"{param_desc} (default: {param_default})"
else:
    param_desc_with_default = param_desc
```

**改进**：在参数描述后添加默认值信息

---

## 生成统计

运行结果：
```
2025-10-31 11:06:37 - INFO - Found 385 API endpoints
2025-10-31 11:06:37 - INFO - Generated 385 documentation files
2025-10-31 11:06:37 - INFO - Updated mint.json with 16 categories
2025-10-31 11:06:37 - INFO - Documentation generation completed!
```

所有 385 个文档都已使用新格式重新生成。

---

## 使用示例

### 运行脚本

```bash
# 使用默认配置
python3 generate_docs.py

# 详细模式
python3 generate_docs.py -v

# 自定义路径
python3 generate_docs.py -i Apifox.json -o docs/api -m mint.json
```

### 查看生成的文档

```bash
# 查看 OpenAI 图像生成文档
cat docs/api/openai/gpt-4o-image/official-format/text-to-image.mdx

# 查看 Claude 文本生成文档
cat docs/api/claude/claude-3-5-haiku-20241022/openai-format/text-to-text.mdx
```

---

## 总结

v3.1 版本的两个主要改进提升了文档的实用性和准确性：

1. **参数默认值显示** - 让用户快速了解每个参数的推荐值
2. **标准错误格式** - 使用 GPTProto 实际的错误响应结构

这些改进使生成的 API 文档更加完善和专业！
