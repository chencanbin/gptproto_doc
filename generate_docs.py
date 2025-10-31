#!/usr/bin/env python3
"""
GPTProto API 文档生成器
从 Apifox.json 生成 Mintlify MDX 文档并自动更新 mint.json 导航

功能特性:
- 递归解析 Apifox JSON 的嵌套目录结构
- 生成 Mintlify MDX 格式的文档
- 自动生成和更新 mint.json 的 navigation 配置
- 支持多种编程语言的请求示例 (cURL, Python, JavaScript, Go)
- 智能推断参数类型和描述
- Request Body 参数自动显示默认值
- GPTProto 标准错误响应格式
- 详细的日志记录和错误处理

使用方法:
    python generate_docs.py                              # 使用默认配置
    python generate_docs.py -i input.json -o ./docs     # 自定义路径
    python generate_docs.py -v                          # 详细输出
    python generate_docs.py --help                      # 查看所有选项

作者: Generated with Claude Code
版本: 3.1
"""

import json
import os
import re
import sys
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from collections import defaultdict

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

def sanitize_folder_name(name: str) -> str:
    """将文件夹名称转换为安全的路径名

    Args:
        name: 原始文件夹名称

    Returns:
        安全的文件夹名（小写，只包含字母数字和连字符）
    """
    if not name:
        return 'other'

    # 移除特殊字符，保留中文字符
    name = re.sub(r'[^\w\s-]', '', name.lower())
    # 将空格和多个连字符替换为单个连字符
    name = re.sub(r'[-\s]+', '-', name)
    # 移除首尾的连字符
    return name.strip('-') or 'other'

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

def format_default_value(value: Any) -> str:
    """格式化默认值以便作为 ParamField 的 default 属性

    对于所有值类型，使用 HTML 实体编码来避免引号冲突
    """
    if isinstance(value, str):
        # 对字符串中的引号进行 HTML 实体编码
        escaped_value = value.replace('"', '&quot;').replace("'", '&apos;')
        return f'"{escaped_value}"'
    elif isinstance(value, bool):
        return f'"{str(value).lower()}"'
    elif isinstance(value, (int, float)):
        return f'"{value}"'
    elif isinstance(value, list) or isinstance(value, dict):
        # 对于数组和对象，转换为 JSON 字符串并进行 HTML 实体编码
        json_str = json.dumps(value, ensure_ascii=False)
        # 转义引号和特殊字符，使用 HTML 实体
        json_str = json_str.replace('"', '&quot;').replace("'", '&apos;')
        return f'"{json_str}"'
    else:
        return f'"{value}"'

def parse_request_body_params(request_body: Dict) -> List[Dict]:
    """解析请求体参数"""
    params = []

    if not request_body:
        return params

    # 处理 JSON 格式
    if request_body.get('mode') == 'raw':
        raw_data = request_body.get('raw', '{}')
        example_obj = parse_json_example(raw_data)

        if isinstance(example_obj, dict):
            for key, value in example_obj.items():
                param_type = infer_type_from_value(value)
                param_desc = get_param_description(key, value)
                required = key in ['model', 'messages', 'prompt', 'input']

                params.append({
                    'name': key,
                    'type': param_type,
                    'description': param_desc,
                    'required': required,
                    'example': value,
                    'default': format_default_value(value)
                })

    # 处理 formdata 格式
    elif request_body.get('mode') == 'formdata':
        formdata = request_body.get('formdata', [])
        for field in formdata:
            field_name = field.get('key', '')
            field_type = field.get('type', 'text')
            field_value = field.get('value', '')

            params.append({
                'name': field_name,
                'type': 'file' if field_type == 'file' else 'string',
                'description': f'{field_name} parameter',
                'required': not field.get('disabled', False),
                'example': field_value,
                'default': format_default_value(field_value) if field_value else ''
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

    request = api_info.get('request', {})
    if not request:
        logger.warning(f"API '{api_info.get('name')}' has no request data")
        return False

    return True

def generate_api_doc(api_info: Dict, folder_path: str) -> str:
    """为单个 API 生成 MDX 文档

    Args:
        api_info: API 信息字典
        folder_path: 文件夹路径

    Returns:
        生成的 MDX 文档内容
    """
    name = escape_mdx_string(api_info.get('name', 'Unnamed API'))
    description = escape_mdx_string(api_info.get('description', ''))
    request = api_info.get('request', {})

    method = request.get('method', 'GET').upper()
    url_data = request.get('url', {})

    # 构建路径
    if isinstance(url_data, str):
        path = url_data
    else:
        path_parts = url_data.get('path', [])
        path = '/' + '/'.join(path_parts) if path_parts else '/'

    # 确定完整URL
    if path.startswith('http'):
        full_url = path
    else:
        # 处理变量占位符
        base = url_data.get('host', [Config.base_url])[0] if isinstance(url_data, dict) else Config.base_url
        base = base.replace('{{baseUrl}}', Config.base_url)
        full_url = f'{base}{path}'

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

<ParamField header="Authorization" type="string" required default="sk-***********">
  Your API key in the format: `Bearer YOUR_API_KEY`
</ParamField>

"""

    # 添加路径参数
    path_params = url_data.get('variable', []) if isinstance(url_data, dict) else []
    if path_params:
        mdx += "## Path Parameters\n\n"
        for param in path_params:
            param_name = param.get('key', '')
            param_desc = param.get('description', f'{param_name} parameter')

            mdx += f"""<ParamField path="{param_name}" type="string">
  {param_desc}
</ParamField>

"""

    # 添加查询参数
    query_params = url_data.get('query', []) if isinstance(url_data, dict) else []
    if query_params:
        mdx += "## Query Parameters\n\n"
        for param in query_params:
            param_name = param.get('key', '')
            param_desc = param.get('description', f'{param_name} parameter')

            mdx += f"""<ParamField query="{param_name}" type="string">
  {param_desc}
</ParamField>

"""

    # 添加请求体
    request_body = request.get('body', {})
    if request_body:
        body_params = parse_request_body_params(request_body)

        if body_params:
            mdx += "## Request Body\n\n"

            for param in body_params:
                param_name = param['name']
                param_type = param['type']
                param_desc = param['description']
                param_required = 'required' if param['required'] else ''
                param_default = param.get('default', '')

                # 将默认值作为 default 属性
                if param_default:
                    mdx += f"""<ParamField body="{param_name}" type="{param_type}" {param_required} default={param_default}>
  {param_desc}
</ParamField>

"""
                else:
                    mdx += f"""<ParamField body="{param_name}" type="{param_type}" {param_required}>
  {param_desc}
</ParamField>

"""

    # 添加请求示例
    if request_body and request_body.get('mode') == 'raw':
        raw_data = request_body.get('raw', '{}')
        example_obj = parse_json_example(raw_data)

        mdx += f"""## Request Example

<CodeGroup>

```bash cURL
curl -X {method} "{full_url}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
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
    mdx += """## Response

<ResponseField name="Success" type="200">
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

</ResponseExample>

"""

    return mdx

class NavigationNode:
    """导航树节点"""
    def __init__(self, name: str, is_folder: bool = True):
        self.name = name
        self.is_folder = is_folder
        self.children: List[NavigationNode] = []
        self.file_path: Optional[str] = None

    def add_child(self, child: 'NavigationNode'):
        self.children.append(child)

    def to_dict(self) -> Dict:
        """转换为 mint.json 的导航格式"""
        if not self.is_folder:
            # 叶子节点：直接返回文件路径
            return self.file_path
        else:
            # 文件夹节点：返回包含子节点的字典
            if not self.children:
                return {}

            result = {
                "group": self.name,
                "pages": []
            }

            for child in self.children:
                child_dict = child.to_dict()
                if child_dict:  # 只添加非空的子节点
                    result["pages"].append(child_dict)

            return result if result["pages"] else {}

def extract_apis_recursive(
    item: Dict,
    folder_path: List[str],
    output_base: Path,
    navigation_tree: Dict[str, NavigationNode]
) -> Tuple[List[Dict], int]:
    """递归提取所有 API 并生成文档

    Args:
        item: API 集合项
        folder_path: 当前文件夹路径列表
        output_base: 输出基础路径
        navigation_tree: 导航树字典，key 为顶级分类名

    Returns:
        (API信息列表, 生成的文件数量)
    """
    apis = []
    generated_count = 0

    # 处理嵌套的文件夹（支持 'items' 和 'item' 两种格式）
    sub_items = item.get('item') or item.get('items')

    if sub_items:
        folder_name = item.get('name', '')
        new_path = folder_path + [folder_name]

        # 确定顶级分类（第一层目录）
        top_category = new_path[0] if new_path else 'Other'

        # 创建或获取导航节点
        if top_category not in navigation_tree:
            navigation_tree[top_category] = NavigationNode(top_category, is_folder=True)

        # 递归处理子项
        for sub_item in sub_items:
            sub_apis, sub_count = extract_apis_recursive(
                sub_item,
                new_path,
                output_base,
                navigation_tree
            )
            apis.extend(sub_apis)
            generated_count += sub_count

    # 处理 API 定义（只有 request 字段的是实际的 API）
    if 'request' in item and not sub_items:
        api_name = item.get('name', 'Unnamed')

        # 确定输出路径
        if len(folder_path) >= 1:
            # 使用第一级目录作为主分类
            category = sanitize_folder_name(folder_path[0])
            # 使用后续路径创建子目录
            sub_folders = [sanitize_folder_name(f) for f in folder_path[1:]] if len(folder_path) > 1 else []

            # 创建完整的输出目录
            output_dir = output_base / category
            for sub_folder in sub_folders:
                output_dir = output_dir / sub_folder
            output_dir.mkdir(parents=True, exist_ok=True)

            # 生成文件名和路径
            filename = sanitize_filename(api_name)
            filepath = output_dir / f"{filename}.mdx"

            # 相对于 docs/api 的路径（用于 mint.json）
            relative_parts = [category] + sub_folders + [filename]
            relative_path = "docs/api/" + "/".join(relative_parts)

            # 生成文档内容
            try:
                content = generate_api_doc(item, '/'.join(folder_path))

                # 写入文件
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)

                generated_count += 1
                logger.debug(f"Generated: {filepath}")

                # 添加到导航树
                top_category = folder_path[0]
                if top_category in navigation_tree:
                    # 找到或创建正确的父节点
                    current_node = navigation_tree[top_category]

                    # 遍历中间路径，创建必要的文件夹节点
                    for i in range(1, len(folder_path)):
                        folder_name = folder_path[i]
                        # 查找是否已存在该文件夹节点
                        found = False
                        for child in current_node.children:
                            if child.is_folder and child.name == folder_name:
                                current_node = child
                                found = True
                                break

                        if not found:
                            # 创建新的文件夹节点
                            new_folder_node = NavigationNode(folder_name, is_folder=True)
                            current_node.add_child(new_folder_node)
                            current_node = new_folder_node

                    # 添加 API 文件节点
                    api_node = NavigationNode(api_name, is_folder=False)
                    api_node.file_path = relative_path
                    current_node.add_child(api_node)

                apis.append({
                    'name': api_name,
                    'folder_path': '/'.join(folder_path),
                    'file_path': str(filepath),
                    'relative_path': relative_path
                })

            except Exception as e:
                logger.error(f"Failed to generate doc for '{api_name}': {e}")

    return apis, generated_count

def update_mint_json(navigation_tree: Dict[str, NavigationNode], mint_json_path: Path):
    """更新 mint.json 的 navigation 配置

    Args:
        navigation_tree: 导航树字典
        mint_json_path: mint.json 文件路径
    """
    try:
        # 读取现有的 mint.json
        with open(mint_json_path, 'r', encoding='utf-8') as f:
            mint_data = json.load(f)

        # 保留非 API 相关的导航项（如 "Get Started"）
        existing_navigation = mint_data.get('navigation', [])
        non_api_navigation = [
            item for item in existing_navigation
            if item.get('group', '').lower() not in [key.lower() for key in navigation_tree.keys()]
            and 'get started' in item.get('group', '').lower()
        ]

        # 构建新的导航配置
        new_navigation = non_api_navigation.copy()

        # 定义分类图标映射
        category_icons = {
            'openai': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/GPT.png',
            'claude': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Claude.png',
            'gemini': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Gemini.png',
            'grok': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Grok.png',
            'midjourney': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Midjourney.png',
            'suno': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Suno.png',
            'kling': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Kling.png',
            'runway': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Runway.png',
            'ideogram': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/Ideogram.png',
            'flux': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/2025/05/30/a0ffa3b5d65f4f23a40698c445048c67.png',
            'doubao': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-draw/AiIcon/doubao.png',
            'higgsfield': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-content/1754623057482-20250808-111710.png',
            'qwen': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-content/1755663073115-111.png',
            'minimax': 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/ai-content/1757932596487-20250915-183623.png',
            'gptproto': 'https://oss.heyoos.com/2025/10/23/2df4295950b8433998e058f6539d9e1c.png?x-oss-process=image/format,webp/quality,q_100/resize,w_160,h_160,m_fill'
        }

        # 添加 API 导航项
        for category_name, node in sorted(navigation_tree.items()):
            nav_item = node.to_dict()
            if nav_item and nav_item.get('pages'):
                # 添加图标
                category_key = sanitize_folder_name(category_name)
                if category_key in category_icons:
                    nav_item['icon'] = category_icons[category_key]

                new_navigation.append(nav_item)

        # 更新 navigation
        mint_data['navigation'] = new_navigation

        # 写回 mint.json
        with open(mint_json_path, 'w', encoding='utf-8') as f:
            json.dump(mint_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Updated mint.json with {len(navigation_tree)} categories")

    except Exception as e:
        logger.error(f"Failed to update mint.json: {e}")
        raise

def main():
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description='Generate Mintlify MDX documentation from Apifox JSON and update mint.json navigation',
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
        default='Apifox.json',
        help='Path to Apifox JSON file (default: ./Apifox.json)'
    )
    parser.add_argument(
        '-o', '--output',
        default='docs/api',
        help='Output directory for generated docs (default: ./docs/api)'
    )
    parser.add_argument(
        '-m', '--mint-json',
        default='mint.json',
        help='Path to mint.json file (default: ./mint.json)'
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

    args = parser.parse_args()

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

    # 创建输出目录
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)
    logger.info(f"Output directory: {args.output}")

    # 提取所有 API 并生成文档
    logger.info("Extracting API endpoints and generating documentation...")

    navigation_tree: Dict[str, NavigationNode] = {}
    all_apis = []
    total_generated = 0

    # Apifox 导出格式使用 'item'
    collections = apifox_data.get('item', [])

    for collection in collections:
        apis, count = extract_apis_recursive(
            collection,
            [],
            output_path,
            navigation_tree
        )
        all_apis.extend(apis)
        total_generated += count

    logger.info(f"Found {len(all_apis)} API endpoints")
    logger.info(f"Generated {total_generated} documentation files")

    if not all_apis:
        logger.warning("No APIs found in the input file")
        return

    # 更新 mint.json
    mint_json_path = Path(args.mint_json)
    if mint_json_path.exists():
        logger.info(f"Updating {args.mint_json}...")
        try:
            update_mint_json(navigation_tree, mint_json_path)
            logger.info("Successfully updated mint.json")
        except Exception as e:
            logger.error(f"Failed to update mint.json: {e}")
    else:
        logger.warning(f"mint.json not found at {args.mint_json}, skipping navigation update")

    # 输出统计信息
    logger.info("\n" + "="*50)
    logger.info("Documentation generation completed!")
    logger.info("="*50)
    logger.info(f"  Total APIs: {len(all_apis)}")
    logger.info(f"  Generated docs: {total_generated}")
    logger.info(f"  Categories: {len(navigation_tree)}")

    # 生成摘要文件
    summary_path = output_path / "_summary.json"
    summary = {
        'generated_at': datetime.now().isoformat(),
        'total_apis': len(all_apis),
        'generated_docs': total_generated,
        'categories': list(navigation_tree.keys())
    }

    try:
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        logger.info(f"\nSummary saved to: {summary_path}")
    except Exception as e:
        logger.warning(f"Failed to save summary: {e}")

if __name__ == '__main__':
    main()
