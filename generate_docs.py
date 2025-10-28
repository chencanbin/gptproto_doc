#!/usr/bin/env python3
"""
GPTProto API 文档生成器
从 Apifox.json 生成 Mintlify MDX 文档

功能特性:
- 自动解析 Apifox JSON 格式的 API 定义
- 生成 Mintlify MDX 格式的文档
- 支持多种编程语言的请求示例 (cURL, Python, JavaScript, Go)
- 智能推断参数类型和描述
- 自动分类 API (OpenAI, Claude, Gemini 等)
- 详细的日志记录和错误处理
- 灵活的命令行参数配置

使用方法:
    python generate_docs.py                              # 使用默认配置
    python generate_docs.py -i input.json -o ./docs     # 自定义路径
    python generate_docs.py -v                          # 详细输出
    python generate_docs.py --help                      # 查看所有选项

作者: Generated with Claude Code
版本: 2.0
"""

import json
import os
import re
import sys
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 全局配置
class Config:
    """全局配置类"""
    base_url: str = 'https://gptproto.com'

    @classmethod
    def set_base_url(cls, url: str):
        cls.base_url = url

def sanitize_filename(name: str) -> str:
    """将 API 名称转换为安全的文件名

    Args:
        name: 原始 API 名称

    Returns:
        安全的文件名（小写，只包含字母数字和连字符）
    """
    if not name:
        return 'unnamed'

    # 移除特殊字符
    name = re.sub(r'[^\w\s-]', '', name.lower())
    # 将空格和多个连字符替换为单个连字符
    name = re.sub(r'[-\s]+', '-', name)
    # 移除首尾的连字符
    return name.strip('-') or 'unnamed'

def format_json(obj: Any, indent: int = 2) -> str:
    """格式化 JSON 对象"""
    if not obj:
        return "{}"
    try:
        return json.dumps(obj, ensure_ascii=False, indent=indent)
    except Exception as e:
        logger.warning(f"Failed to format JSON: {e}")
        return str(obj)

def parse_json_example(example_str: str) -> Dict:
    """解析 JSON 示例字符串"""
    try:
        if isinstance(example_str, str):
            return json.loads(example_str)
        return example_str if isinstance(example_str, dict) else {}
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse JSON example: {e}")
        return {}

def get_category(folder_path: str) -> str:
    """根据文件夹路径确定分类

    支持的分类包括:
    - OpenAI: GPT, DALL-E, Whisper, TTS, Sora 等
    - Claude: Anthropic Claude 系列
    - Gemini: Google Gemini 系列
    - Suno: Suno AI 音乐生成
    - Midjourney: Midjourney 图像生成
    - Doubao: 字节跳动豆包系列
    - Kling: 快手可灵视频生成
    - Runway: Runway AI 视频编辑
    - MiniMax: MiniMax AI
    - Ideogram: Ideogram 图像生成
    - Flux: Flux AI 图像生成
    - Higgsfield: Higgsfield AI
    - Qwen: 阿里通义千问
    - Grok: xAI Grok
    - Other: 其他未分类的 API

    Args:
        folder_path: API 所在的文件夹路径

    Returns:
        分类名称（小写）
    """
    if not folder_path:
        return 'other'

    # 转换为小写以便匹配
    path_lower = folder_path.lower()

    # 定义分类规则（按优先级排序）
    category_rules = {
        'openai': ['openai', 'gpt', 'dall-e', 'whisper', 'tts', 'sora'],
        'claude': ['claude', 'anthropic'],
        'gemini': ['gemini', 'google'],
        'suno': ['suno'],
        'midjourney': ['midjourney', 'mj'],
        'doubao': ['doubao', '豆包'],
        'kling': ['kling', '可灵'],
        'runway': ['runway'],
        'minimax': ['minimax'],
        'ideogram': ['ideogram'],
        'flux': ['flux'],
        'higgsfield': ['higgsfield'],
        'qwen': ['qwen', '通义', 'tongyi'],
        'grok': ['grok'],
    }

    # 检查每个分类规则
    for category, keywords in category_rules.items():
        for keyword in keywords:
            if keyword in path_lower:
                return category

    # 如果没有匹配，返回 other
    return 'other'

def get_all_categories() -> List[str]:
    """获取所有支持的分类列表

    Returns:
        分类名称列表
    """
    return [
        'openai', 'claude', 'gemini', 'suno', 'midjourney', 'doubao',
        'kling', 'runway', 'minimax', 'ideogram', 'flux', 'higgsfield',
        'qwen', 'grok', 'other'
    ]

def infer_type_from_value(value: Any) -> str:
    """从值推断参数类型"""
    if isinstance(value, bool):
        return "boolean"
    elif isinstance(value, int):
        return "integer"
    elif isinstance(value, float):
        return "number"
    elif isinstance(value, list):
        return "array"
    elif isinstance(value, dict):
        return "object"
    else:
        return "string"

def get_param_description(key: str, value: Any) -> str:
    """根据参数名和值生成描述"""
    descriptions = {
        'model': 'The model to use for the request',
        'messages': 'Array of message objects for the conversation',
        'temperature': 'Controls randomness in the output (0-2)',
        'max_tokens': 'Maximum number of tokens to generate',
        'top_p': 'Nucleus sampling parameter (0-1)',
        'stream': 'Whether to stream the response',
        'frequency_penalty': 'Penalize frequent tokens (-2.0 to 2.0)',
        'presence_penalty': 'Penalize new tokens (-2.0 to 2.0)',
        'n': 'Number of completions to generate',
        'stop': 'Sequences where the API will stop generating',
        'user': 'Unique identifier for the end-user',
    }

    # 返回预定义描述或生成描述
    return descriptions.get(key, f"{key.replace('_', ' ').title()} parameter")

def parse_request_body_params(request_body: Dict) -> List[Dict]:
    """解析请求体参数"""
    params = []

    if not request_body or request_body.get('type') != 'application/json':
        return params

    examples = request_body.get('examples', [])
    if not examples:
        return params

    # 使用第一个示例推断参数
    example_value = examples[0].get('value', '{}')
    example_obj = parse_json_example(example_value)

    if not isinstance(example_obj, dict):
        return params

    # 遍历示例对象的所有键
    for key, value in example_obj.items():
        param_type = infer_type_from_value(value)
        param_desc = get_param_description(key, value)

        # 判断是否必需（常见必需字段）
        required = key in ['model', 'messages', 'prompt', 'input']

        params.append({
            'name': key,
            'type': param_type,
            'description': param_desc,
            'required': required,
            'example': value
        })

    return params

def escape_mdx_string(text: str) -> str:
    """转义 MDX 中的特殊字符

    Args:
        text: 需要转义的文本

    Returns:
        转义后的文本
    """
    if not text:
        return ''

    # 转义单引号（在 frontmatter 中使用）
    text = text.replace("'", "\\'")
    # 移除可能导致问题的控制字符
    text = re.sub(r'[\x00-\x1F\x7F]', '', text)

    return text

def validate_api_data(api_info: Dict) -> bool:
    """验证 API 数据是否完整

    Args:
        api_info: API 信息字典

    Returns:
        数据是否有效
    """
    if not api_info:
        return False

    api = api_info.get('api', {})
    if not api:
        logger.warning(f"API '{api_info.get('name')}' has no api data")
        return False

    # 检查必需字段
    if not api.get('path'):
        logger.warning(f"API '{api_info.get('name')}' has no path")
        return False

    return True

def generate_api_doc(api_info: Dict) -> str:
    """为单个 API 生成 MDX 文档

    Args:
        api_info: API 信息字典

    Returns:
        生成的 MDX 文档内容
    """
    name = escape_mdx_string(api_info.get('name', 'Unnamed API'))
    folder_path = api_info.get('folder_path', '')
    api = api_info.get('api', {})

    method = api.get('method', 'GET').upper()
    path = api.get('path', '/')
    description = escape_mdx_string(api.get('description', ''))

    # 获取请求信息
    request_body = api.get('requestBody', {})
    parameters = api.get('parameters', {})
    common_params = api.get('commonParameters', {})

    # 获取响应信息
    responses = api.get('responses', [])

    # 确定完整URL
    if path.startswith('http'):
        full_url = path
    else:
        full_url = f'{Config.base_url}{path}'

    # 开始生成 MDX 内容
    mdx = f"""---
title: '{name}'
api: '{method} {path}'
description: '{description or name}'
---

## Overview

{description or f'This endpoint provides {name.lower()} functionality.'}

"""

    # 添加认证
    mdx += """## Authentication

This endpoint requires authentication using a Bearer token.

<ParamField header="Authorization" type="string" required>
  Your API key in the format: `Bearer YOUR_API_KEY`
</ParamField>

"""

    # 添加路径参数
    path_params = parameters.get('path', [])
    if path_params:
        mdx += "## Path Parameters\n\n"
        for param in path_params:
            param_name = param.get('name', '')
            param_desc = param.get('description', f'{param_name} parameter')
            param_required = param.get('required', False)

            mdx += f"""<ParamField path="{param_name}" type="string" {'required' if param_required else ''}>
  {param_desc}
</ParamField>

"""

    # 添加查询参数
    query_params = parameters.get('query', [])
    if query_params:
        mdx += "## Query Parameters\n\n"
        for param in query_params:
            param_name = param.get('name', '')
            param_desc = param.get('description', f'{param_name} parameter')
            param_required = param.get('required', False)

            mdx += f"""<ParamField query="{param_name}" type="string" {'required' if param_required else ''}>
  {param_desc}
</ParamField>

"""

    # 添加请求体
    if request_body and request_body.get('type') == 'application/json':
        body_params = parse_request_body_params(request_body)

        if body_params:
            mdx += "## Request Body\n\n"

            for param in body_params:
                param_name = param['name']
                param_type = param['type']
                param_desc = param['description']
                param_required = 'required' if param['required'] else ''

                mdx += f"""<ParamField body="{param_name}" type="{param_type}" {param_required}>
  {param_desc}
</ParamField>

"""

    # 添加请求示例
    if request_body and request_body.get('examples'):
        example_value = request_body['examples'][0].get('value', '{}')
        example_obj = parse_json_example(example_value)

        mdx += f"""## Request Example

<CodeGroup>

```bash cURL
curl -X {method} "{full_url}" \\
  -H "Authorization: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{format_json(example_obj)}'
```

```python Python
import requests
import json

url = "{full_url}"
headers = {{
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}}

data = {format_json(example_obj)}

response = requests.{method.lower()}(url, headers=headers, json=data)
result = response.json()
print(json.dumps(result, indent=2))
```

```javascript JavaScript
const url = "{full_url}";
const headers = {{
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json"
}};

const data = {format_json(example_obj)};

fetch(url, {{
  method: "{method}",
  headers: headers,
  body: JSON.stringify(data)
}})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error("Error:", error));
```

```go Go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {{
    url := "{full_url}"

    payload := []byte(`{format_json(example_obj, indent=0)}`)

    req, _ := http.NewRequest("{method}", url, bytes.NewBuffer(payload))
    req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{{}}
    resp, err := client.Do(req)
    if err != nil {{
        panic(err)
    }}
    defer resp.Body.Close()

    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}}
```

</CodeGroup>

"""

    # 添加响应
    mdx += "## Response\n\n"

    if responses:
        for response in responses:
            code = response.get('code', 200)
            resp_name = response.get('name', 'Success')
            resp_schema = response.get('jsonSchema', {})

            mdx += f"""<ResponseField name="{resp_name}" type="{code}">
  Response with status code {code}

"""

            # 如果有响应示例
            if resp_schema and resp_schema.get('properties'):
                mdx += "```json\n"
                # 生成示例响应
                example_response = {}
                for prop_name, prop_info in resp_schema['properties'].items():
                    prop_type = prop_info.get('type', 'string')
                    if prop_type == 'string':
                        example_response[prop_name] = f"example_{prop_name}"
                    elif prop_type == 'number' or prop_type == 'integer':
                        example_response[prop_name] = 0
                    elif prop_type == 'boolean':
                        example_response[prop_name] = True
                    elif prop_type == 'array':
                        example_response[prop_name] = []
                    else:
                        example_response[prop_name] = {}

                mdx += format_json(example_response)
                mdx += "\n```\n"
            else:
                mdx += "```json\n{\n  \"status\": \"success\"\n}\n```\n"

            mdx += "</ResponseField>\n\n"
    else:
        mdx += """<ResponseField name="Success" type="200">
  Successful response

```json
{
  "status": "success"
}
```
</ResponseField>

"""

    # 添加错误响应
    mdx += """## Error Responses

<ResponseExample>

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

</ResponseExample>

"""

    return mdx

def extract_apis_recursive(item: Dict, folder_path: str = "") -> List[Dict]:
    """递归提取所有 API

    支持 Postman/Apifox 格式，处理嵌套的文件夹和 API 定义

    Args:
        item: API 集合项
        folder_path: 当前文件夹路径

    Returns:
        API 信息列表
    """
    apis = []

    # 处理嵌套的文件夹（支持 'items' 和 'item' 两种格式）
    sub_items = item.get('items') or item.get('item')
    if sub_items:
        folder_name = item.get('name', '')
        new_path = f"{folder_path}/{folder_name}" if folder_path else folder_name

        for sub_item in sub_items:
            apis.extend(extract_apis_recursive(sub_item, new_path))

    # 处理 API 定义（支持 'api' 和 'request' 两种格式）
    if 'api' in item:
        apis.append({
            'name': item.get('name', 'Unnamed'),
            'folder_path': folder_path,
            'api': item['api']
        })
    elif 'request' in item:
        # 转换 Postman 格式到内部格式
        request = item['request']
        url_data = request.get('url', {})

        # 构建路径
        if isinstance(url_data, str):
            path = url_data
        else:
            path_parts = url_data.get('path', [])
            path = '/' + '/'.join(path_parts) if path_parts else '/'

        # 转换为内部 API 格式
        api = {
            'method': request.get('method', 'GET'),
            'path': path,
            'description': request.get('description', item.get('description', '')),
            'parameters': {
                'query': url_data.get('query', []) if isinstance(url_data, dict) else [],
                'path': url_data.get('variable', []) if isinstance(url_data, dict) else []
            }
        }

        # 处理请求体
        body = request.get('body', {})
        if body and body.get('mode') == 'raw':
            api['requestBody'] = {
                'type': 'application/json',
                'examples': [{
                    'value': body.get('raw', '{}')
                }]
            }

        apis.append({
            'name': item.get('name', 'Unnamed'),
            'folder_path': folder_path,
            'api': api
        })

    return apis

def main():
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description='Generate Mintlify MDX documentation from Apifox JSON',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                                    # 使用默认路径
  %(prog)s -i data.json -o ./docs           # 指定输入输出路径
  %(prog)s -i data.json -o ./docs -v        # 详细输出模式
  %(prog)s --base-url https://api.example.com  # 指定基础URL
        """
    )
    parser.add_argument(
        '-i', '--input',
        default='/Users/benschen/Downloads/cc/Apifox.json',
        help='Path to Apifox JSON file (default: ./Apifox.json)'
    )
    parser.add_argument(
        '-o', '--output',
        default='/Users/benschen/Downloads/cc/docs/api',
        help='Output directory for generated docs (default: ./docs/api)'
    )
    parser.add_argument(
        '-b', '--base-url',
        default='https://gptproto.com',
        help='Base URL for API endpoints (default: https://gptproto.com)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--categories',
        nargs='+',
        default=get_all_categories(),
        help='Categories to generate (default: all categories)'
    )
    parser.add_argument(
        '--list-categories',
        action='store_true',
        help='List all supported categories and exit'
    )

    args = parser.parse_args()

    # 如果只是列出分类，显示后退出
    if args.list_categories:
        print("Supported Categories:")
        print("=" * 50)
        categories_info = {
            'openai': 'OpenAI (GPT, DALL-E, Whisper, TTS, Sora)',
            'claude': 'Anthropic Claude',
            'gemini': 'Google Gemini',
            'suno': 'Suno AI Music Generation',
            'midjourney': 'Midjourney Image Generation',
            'doubao': 'ByteDance Doubao (字节豆包)',
            'kling': 'Kuaishou Kling Video (快手可灵)',
            'runway': 'Runway AI Video Editing',
            'minimax': 'MiniMax AI',
            'ideogram': 'Ideogram Image Generation',
            'flux': 'Flux AI Image Generation',
            'higgsfield': 'Higgsfield AI',
            'qwen': 'Alibaba Qwen (阿里通义)',
            'grok': 'xAI Grok',
            'other': 'Other APIs'
        }
        for cat in get_all_categories():
            desc = categories_info.get(cat, cat)
            print(f"  • {cat:12s} - {desc}")
        print("\nUsage:")
        print(f"  {sys.argv[0]} --categories openai claude gemini")
        sys.exit(0)

    # 设置日志级别
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # 设置全局配置
    Config.set_base_url(args.base_url)

    # 验证输入文件
    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(f"Input file not found: {args.input}")
        sys.exit(1)

    logger.info(f"Reading API data from: {args.input}")

    # 读取 Apifox.json
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            apifox_data = json.load(f)
        logger.info("Successfully loaded Apifox data")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON file: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to read input file: {e}")
        sys.exit(1)

    # 提取所有 API
    logger.info("Extracting API endpoints...")
    all_apis = []

    # Apifox 导出格式可能使用 'item' 或 'apiCollection'
    collections = apifox_data.get('item', apifox_data.get('apiCollection', []))

    for collection in collections:
        all_apis.extend(extract_apis_recursive(collection))

    logger.info(f"Found {len(all_apis)} API endpoints")

    if not all_apis:
        logger.warning("No APIs found in the input file")
        return

    # 创建输出目录
    output_path = Path(args.output)
    logger.info(f"Output directory: {args.output}")

    for category in args.categories:
        category_path = output_path / category
        category_path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created directory: {category_path}")

    # 生成文档
    logger.info("Generating documentation...")
    generated = {cat: 0 for cat in args.categories}
    errors = []

    for idx, api_info in enumerate(all_apis, 1):
        try:
            # 验证 API 数据
            if not validate_api_data(api_info):
                errors.append(f"Invalid API data for '{api_info.get('name', 'Unknown')}'")
                continue

            category = get_category(api_info['folder_path'])

            # 跳过不在指定分类中的 API
            if category not in args.categories:
                continue

            filename = sanitize_filename(api_info['name'])
            filepath = output_path / category / f"{filename}.mdx"

            logger.debug(f"[{idx}/{len(all_apis)}] Generating: {filepath}")

            # 生成文档内容
            content = generate_api_doc(api_info)

            # 写入文件
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

            generated[category] += 1

        except Exception as e:
            error_msg = f"Failed to generate doc for '{api_info.get('name', 'Unknown')}': {e}"
            logger.error(error_msg)
            errors.append(error_msg)
            continue

    # 输出统计信息
    logger.info("\n" + "="*50)
    logger.info("Documentation generation completed!")
    logger.info("="*50)

    for category in args.categories:
        if generated[category] > 0:
            logger.info(f"  {category.capitalize()}: {generated[category]} docs")

    total = sum(generated.values())
    logger.info(f"  Total: {total} documents generated")

    if errors:
        logger.warning(f"\n{len(errors)} errors occurred during generation")
        if args.verbose:
            for error in errors:
                logger.warning(f"  - {error}")

    # 生成摘要文件
    summary_path = output_path / "_summary.json"
    summary = {
        'generated_at': datetime.now().isoformat(),
        'total_apis': len(all_apis),
        'generated_docs': total,
        'categories': generated,
        'errors': len(errors)
    }

    try:
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        logger.info(f"\nSummary saved to: {summary_path}")
    except Exception as e:
        logger.warning(f"Failed to save summary: {e}")

if __name__ == '__main__':
    main()
