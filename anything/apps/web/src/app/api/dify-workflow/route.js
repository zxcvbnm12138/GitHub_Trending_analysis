// 生成符合 Dify 0.1.0 DSL 规范的工作流 YAML 文件
// 修复：emoji编码、headers格式、模板变量引号、params格式

function buildWorkflowYaml() {
  // 系统提示词
  const systemPrompt = `你是一个技术趋势分析师，擅长从 GitHub Trending 页面提取项目信息并生成专业的中文分析报告。
你必须严格输出合法的 JSON 格式，不要包含任何 markdown 代码块标记（如 \`\`\`json），不要有任何多余的文字，直接输出 JSON 对象。`;

  // 用户提示词 —— 单独构建避免 YAML 缩进问题
  const userPrompt = `以下是 GitHub Trending 页面的原始 HTML 内容。
日期：{{#start-node.date#}}
语言筛选：{{#start-node.language#}}

---HTML 内容开始---
{{#http-node.body#}}
---HTML 内容结束---

请从以上 HTML 中提取所有热门仓库（尽量提取 8-15 个），并生成如下 JSON 格式的报告。

注意：
1. 直接输出纯 JSON，不加任何 markdown 代码块
2. stars 和 stars_today 必须是数字类型，不是字符串
3. language_breakdown 的 percentage 总和应约等于 100
4. slides 第一张为封面，然后每个 top_repos 一张，最后两张为语言分析和总结
5. why_trending 每项控制在 20 字以内
6. 所有描述用中文

输出 JSON 结构如下（直接输出，不加代码块）：

{
  "summary": "200字以内的整体趋势总结",
  "top_repos": [
    {
      "name": "owner/repo",
      "description": "项目功能描述（中文，50字以内）",
      "stars": 12345,
      "stars_today": 678,
      "language": "Python",
      "why_trending": ["原因1", "原因2", "原因3"]
    }
  ],
  "language_breakdown": [
    {"language": "Python", "percentage": 35},
    {"language": "JavaScript", "percentage": 25},
    {"language": "TypeScript", "percentage": 20},
    {"language": "Go", "percentage": 12},
    {"language": "其他", "percentage": 8}
  ],
  "key_trends": [
    "AI/LLM 相关项目持续占据热榜",
    "Rust 系统工具类项目增长明显",
    "开发者工具和效率类项目受欢迎",
    "跨平台框架持续吸引关注",
    "数据处理与可视化需求旺盛"
  ],
  "slides": [
    {
      "title": "GitHub Trending 日报",
      "content_markdown": "## 今日概览\\n\\n- **日期**：{{#start-node.date#}}\\n- **语言**：{{#start-node.language#}}\\n\\n今日热榜核心发现请补充。"
    },
    {
      "title": "Top 仓库精选",
      "content_markdown": "## 今日最受关注\\n\\n填写热门仓库列表。"
    },
    {
      "title": "语言分布分析",
      "content_markdown": "## 今日语言热度\\n\\n- Python：35%\\n- JavaScript：25%\\n- TypeScript：20%\\n- Go：12%\\n- 其他：8%"
    },
    {
      "title": "五大关键趋势",
      "content_markdown": "## 本期核心洞察\\n\\n- AI/LLM 相关项目持续占据热榜\\n- Rust 系统工具类增长明显\\n- 开发者工具受欢迎\\n- 跨平台框架持续关注\\n- 数据可视化需求旺盛"
    },
    {
      "title": "总结与展望",
      "content_markdown": "## 核心结论\\n\\n填写总结\\n\\n## 值得持续关注\\n\\n- 项目1\\n- 项目2"
    }
  ]
}`;

  // 用 JSON.stringify 确保字符串在 YAML 里安全引用（双引号 + 转义）
  const safeSystem = JSON.stringify(systemPrompt);
  const safeUser = JSON.stringify(userPrompt);

  return `app:
  description: 自动抓取 GitHub Trending 并通过 LLM 生成结构化中文分析报告
  icon: "\uD83D\uDD25"
  icon_background: '#FFEAD5'
  mode: workflow
  name: GitHub Trending 报告
kind: app
version: 0.1.0
workflow:
  conversation_variables: []
  environment_variables: []
  features:
    file_upload:
      image:
        enabled: false
        number_limits: 3
        transfer_methods:
          - local_file
          - remote_url
    opening_statement: ''
    retriever_resource:
      enabled: false
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions: []
    suggested_questions_after_answer:
      enabled: false
    text_to_speech:
      enabled: false
      language: ''
      voice: ''
  graph:
    edges:
      - data:
          isInIteration: false
          sourceType: start
          targetType: http-request
        id: edge-1
        source: start-node
        sourceHandle: source
        target: http-node
        targetHandle: target
        type: custom
        zIndex: 0
      - data:
          isInIteration: false
          sourceType: http-request
          targetType: llm
        id: edge-2
        source: http-node
        sourceHandle: source
        target: llm-node
        targetHandle: target
        type: custom
        zIndex: 0
      - data:
          isInIteration: false
          sourceType: llm
          targetType: end
        id: edge-3
        source: llm-node
        sourceHandle: source
        target: end-node
        targetHandle: target
        type: custom
        zIndex: 0
    nodes:
      - data:
          desc: '输入变量：language（编程语言筛选，默认 all）和 date（日期）'
          selected: false
          title: 开始
          type: start
          variables:
            - field: language
              label: language
              max_length: 48
              options: []
              required: false
              type: text-input
            - field: date
              label: date
              max_length: 48
              options: []
              required: false
              type: text-input
        height: 130
        id: start-node
        position:
          x: 30
          y: 282
        positionAbsolute:
          x: 30
          y: 282
        selected: false
        sourcePosition: right
        targetPosition: left
        type: custom
        width: 244
      - data:
          authorization:
            config: null
            type: no-auth
          body:
            data: ''
            type: none
          desc: 'GET 请求 GitHub Trending 页面，获取原始 HTML'
          headers: "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\nAccept-Language: zh-CN,zh;q=0.9,en;q=0.8"
          method: get
          params: 'since=daily'
          selected: false
          timeout:
            connect: 10
            max_connect_time: 0
            read: 60
            write: 20
          title: 抓取 GitHub Trending
          type: http-request
          url: 'https://github.com/trending/{{#start-node.language#}}?since=daily'
          variables: []
        height: 154
        id: http-node
        position:
          x: 354
          y: 282
        positionAbsolute:
          x: 354
          y: 282
        selected: false
        sourcePosition: right
        targetPosition: left
        type: custom
        width: 244
      - data:
          context:
            enabled: false
            variable_selector: []
          desc: '解析 HTML，提取仓库数据，生成结构化 JSON 报告'
          memory:
            query_prompt_template: ''
            role_prefix:
              assistant: ''
              user: ''
            window:
              enabled: false
              size: 50
          model:
            completion_params:
              temperature: 0.3
              max_tokens: 4096
            mode: chat
            name: gpt-4o
            provider: openai
          prompt_template:
            - id: sys-prompt
              role: system
              text: ${safeSystem}
            - id: user-prompt
              role: user
              text: ${safeUser}
          selected: false
          title: LLM 分析报告
          type: llm
          variables: []
          vision:
            enabled: false
        height: 98
        id: llm-node
        position:
          x: 678
          y: 282
        positionAbsolute:
          x: 678
          y: 282
        selected: false
        sourcePosition: right
        targetPosition: left
        type: custom
        width: 244
      - data:
          desc: '输出 LLM 生成的 JSON 报告文本'
          outputs:
            - value_selector:
                - llm-node
                - text
              variable: text
          selected: false
          title: 结束
          type: end
        height: 98
        id: end-node
        position:
          x: 1002
          y: 282
        positionAbsolute:
          x: 1002
          y: 282
        selected: false
        sourcePosition: right
        targetPosition: left
        type: custom
        width: 244
`;
}

export async function GET() {
  const yaml = buildWorkflowYaml();
  return new Response(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="github-trending-workflow.yml"',
      "Cache-Control": "no-cache",
    },
  });
}
