import { useEffect, useState, useCallback } from "react";

// 翻译字典
const dict = {
  zh: {
    // 通用
    "common.loading": "加载中…",
    "common.save": "保存",
    "common.saving": "保存中…",
    "common.saved": "已保存",
    "common.cancel": "取消",
    "common.confirm": "确认",
    "common.delete": "删除",
    "common.download": "下载",
    "common.view": "查看",
    "common.back": "返回",
    "common.next": "下一个",
    "common.previous": "上一个",
    "common.total": "共 {n} 条",
    "common.enabled": "已启用",
    "common.disabled": "已关闭",
    "common.never": "从未",
    "common.unknown": "未知",
    "common.all": "全部",
    "common.tip": "提示",
    "common.copy": "复制",
    "common.copied": "已复制",

    // 导航
    "nav.dashboard": "仪表盘",
    "nav.compare": "对比",
    "nav.schedule": "计划",
    "nav.settings": "配置",
    "nav.brand": "趋势报告",

    // 账号
    "auth.badge.setup": "首次初始化",
    "auth.badge.login": "私有工作台",
    "auth.title": "登录趋势报告工作台",
    "auth.desc": "使用邮箱和密码进入自己的报告、计划任务和历史记录。",
    "auth.setup.title": "创建第一个管理员账号",
    "auth.setup.desc": "该账号会接管已有报告历史，并拥有系统配置、邀请码和用户管理权限。",
    "auth.database_required": "多用户登录需要 PostgreSQL 数据库。请确认 DATABASE_URL 已配置并重启服务。",
    "auth.database_unavailable": "PostgreSQL 已配置，但当前服务连接失败：{message}",
    "auth.login.tab": "登录",
    "auth.register.tab": "注册",
    "auth.setup.tab": "初始化",
    "auth.email": "邮箱",
    "auth.password": "密码",
    "auth.invite_code": "邀请码",
    "auth.switch_login": "去登录",
    "auth.switch_register": "去注册",
    "auth.login.submit": "登录",
    "auth.register.submit": "注册",
    "auth.setup.submit": "创建管理员",
    "auth.logout": "退出登录",
    "auth.forbidden": "当前账号没有访问此页面的权限。",

    // 状态
    "status.completed": "已完成",
    "status.pending": "生成中",
    "status.scheduled": "待执行",
    "status.running": "执行中",
    "status.cancelled": "已取消",
    "status.failed": "失败",

    // 仪表盘
    "dashboard.title": "GitHub 趋势报告",
    "dashboard.subtitle":
      "每日 GitHub Trending 仓库的智能分析，自动整理成可演示的幻灯片报告。",
    "dashboard.date_range.today": "当天",
    "dashboard.date_range.week": "当周",
    "dashboard.date_range.month": "当月",
    "dashboard.btn.generate": "生成报告",
    "dashboard.btn.generating": "生成中…",
    "dashboard.btn.logs": "生成日志",
    "dashboard.stats.total": "报告总数",
    "dashboard.stats.total_sub": "所有时间",
    "dashboard.stats.this_week": "本周新增",
    "dashboard.stats.week_delta": "{sign}{value}% 较上周",
    "dashboard.stats.top_lang": "最关注语言",
    "dashboard.stats.top_lang_sub": "按报告数量统计",
    "dashboard.stats.next_run": "下次计划执行",
    "dashboard.stats.next_run_sub_on": "由后台任务队列触发",
    "dashboard.stats.next_run_sub_off": "前往计划页面启用",
    "dashboard.filter.label": "按语言筛选",
    "dashboard.list.title": "全部报告",
    "dashboard.list.delete": "删除报告",
    "dashboard.list.deleting": "删除中…",
    "dashboard.list.delete_selected": "删除 {n} 条",
    "dashboard.list.select_all": "全选",
    "dashboard.list.select_report": "选择报告 #{id}",
    "dashboard.delete.confirm": "确认删除选中的 {n} 条报告？此操作不可撤销。",
    "dashboard.empty.title": "还没有报告",
    "dashboard.empty.desc":
      "每份报告包含热门仓库、AI 分析总结和可下载的 HTML 幻灯片。",
    "dashboard.empty.bullet1": "热门趋势仓库",
    "dashboard.empty.bullet2": "AI 总结与关键趋势",
    "dashboard.empty.bullet3": "可下载的演示文稿",
    "dashboard.empty.btn_generate": "通过 Dify 生成",
    "dashboard.row.report_id": "报告 #{id}",
    "dashboard.row.all_languages": "全部语言",
    "dashboard.error.title": "无法通过 Dify 生成报告",
    "dashboard.error.tip": "请检查 DIFY_API_URL 和 DIFY_API_KEY 环境变量是否已配置。",
    "dashboard.error.tip_btn": "",
    "dashboard.error.tip_end": "",
    "dashboard.logs.title": "生成日志",
    "dashboard.logs.subtitle": "最近的报告生成和计划任务执行记录。",
    "dashboard.logs.reports": "报告记录",
    "dashboard.logs.jobs": "计划任务",
    "dashboard.logs.close": "关闭",
    "dashboard.logs.empty": "暂无生成日志",
    "dashboard.logs.report_item": "#{id} · {time} · {status}",
    "dashboard.logs.job_item": "计划 {time} · 状态 {status}",
    "dashboard.logs.completed_at": "完成：{time}",
    "dashboard.logs.languages": "语言：{languages}",
    "dashboard.logs.timezone": "时区：{timezone}",

    // 报告详情
    "report.breadcrumb": "报告列表",
    "report.loading": "正在加载报告…",
    "report.btn.download": "下载 HTML",
    "report.btn.open_slideshow": "打开幻灯片",
    "report.tab.analysis": "分析报告",
    "report.tab.slides": "幻灯片",
    "report.failed.title": "报告生成失败",
    "report.failed.unknown": "未知错误。",
    "report.pending.title": "报告正在生成",
    "report.pending.desc": "Dify 工作流正在后台运行，完成后页面会自动刷新。",
    "report.summary.title": "整体总结",
    "report.summary.empty": "暂无总结。",
    "report.repos.title": "热门趋势仓库",
    "report.repos.subtitle": "按关注度排序。",
    "report.repos.empty": "未返回任何仓库。",
    "report.repos.stars_today": "今日新增 {n}",
    "report.trends.title": "关键趋势",
    "report.lang.title": "语言分布",
    "report.lang.subtitle": "热门活动的语言占比。",
    "report.lang.empty": "暂无数据。",
    "report.about.title": "关于此报告",
    "report.about.generated": "生成时间：{time}",
    "report.about.status": "状态：{status}",
    "report.about.filter": "筛选：{filter}",

    // 幻灯片
    "slides.counter": "第 {current} / {total} 页",
    "slides.btn.download": "下载 HTML",
    "slides.btn.present": "演示模式",
    "slides.tip": "使用 ← → 方向键切换",

    // 计划
    "schedule.title": "计划设置",
    "schedule.subtitle":
      "配置自动报告生成计划，并下载 Dify 工作流文件一键导入。",
    "schedule.dify.title": "Dify 工作流文件",
    "schedule.dify.subtitle":
      "下载现成的 .yml 工作流文件，直接导入 Dify，无需手动搭建节点。",
    "schedule.dify.download": "下载 .yml 文件",
    "schedule.dify.step1.title": "导入工作流",
    "schedule.dify.step1.desc":
      "登录 Dify → 点击「创建应用」→ 选择「从 DSL 文件导入」→ 上传下载的 .yml 文件",
    "schedule.dify.step1.link": "打开 Dify",
    "schedule.dify.step2.title": "选择 LLM 模型",
    "schedule.dify.step2.desc":
      "导入后点击 LLM 节点，选择你已配置好的模型（GPT-4o、Claude、通义千问等均可）",
    "schedule.dify.step3.title": "填入 API 信息",
    "schedule.dify.step3.desc":
      "点击右上角「发布」后进入 API 页面，将密钥和地址填入应用的 DIFY_API_KEY 与 DIFY_API_URL 环境变量",
    "schedule.dify.info":
      "工作流内含：HTTP 抓取节点（自动请求 GitHub Trending 页面）+ LLM 分析节点（输出结构化 JSON 报告，包含摘要、热门仓库、语言分布、幻灯片内容）。导入后只需选择模型，无需手动写提示词或连线。",
    "schedule.form.auto_title": "自动生成报告",
    "schedule.form.auto_desc": "启用后，每日会在三个指定时间自动生成报告。",
    "schedule.form.time_label": "每日执行时间",
    "schedule.form.slot_1": "第一次",
    "schedule.form.slot_2": "第二次",
    "schedule.form.slot_3": "第三次",
    "schedule.form.timezone_label": "计划时区",
    "schedule.form.timezone": "将按 {timezone} 的本地时间准时执行。",
    "schedule.form.lang_label": "跟踪的语言",
    "schedule.form.lang_hint": "每个语言每次执行会生成一份独立报告。",
    "schedule.form.runs_when": "运行时机：后台任务队列会在指定时间自动触发。",
    "schedule.status.title": "当前状态",
    "schedule.status.next": "下次执行：{time}",
    "schedule.status.last": "上次执行：{time}",
    "schedule.status.times": "每日时间：{times}",
    "schedule.status.timezone": "计划时区：{timezone}",
    "schedule.status.langs": "跟踪语言：",

    // 配置
    "settings.title": "系统配置",
    "settings.subtitle": "管理 Dify、数据库、用户和邀请码。密钥仅保存在服务器本地配置文件中。",
    "settings.logout": "退出",
    "settings.save": "保存配置",
    "settings.source.env": "环境变量",
    "settings.source.config": "配置文件",
    "settings.source.unset": "未设置",
    "settings.auth.setup_title": "设置管理员密码",
    "settings.auth.setup_desc": "首次使用前先创建管理员密码。之后只有管理员可以查看和修改配置。",
    "settings.auth.login_title": "管理员登录",
    "settings.auth.login_desc": "输入管理员密码后才能修改服务配置。",
    "settings.auth.password": "管理员密码",
    "settings.auth.password_hint": "至少 8 个字符。",
    "settings.auth.setup_btn": "创建并进入",
    "settings.auth.login_btn": "登录",
    "settings.secret.keep": "留空则保留当前值：{value}",
    "settings.dify.title": "Dify 工作流",
    "settings.dify.desc": "Dify Base URL 和 App Key 保存后立即用于新的报告生成请求。",
    "settings.dify.base_url": "Dify Base URL",
    "settings.dify.app_key": "Dify App Key",
    "settings.dify.clear_key": "清空已保存的 App Key",
    "settings.database.title": "数据库",
    "settings.database.desc": "生产环境建议使用 PostgreSQL / Neon。未配置时继续使用本地 JSON 文件。",
    "settings.database.url": "数据库连接 URL",
    "settings.database.clear_url": "清空已保存的数据库 URL",
    "settings.database.restart_note": "数据库连接在服务和定时 worker 启动时读取；修改后请重启 Web 服务和 worker。",
    "settings.runtime.title": "服务重启",
    "settings.runtime.desc": "Dify 配置保存后会立即用于新请求；数据库连接修改后需要在 EC2 上重启 Web 和定时 worker。",
    "settings.runtime.command_label": "PM2 重启命令",
    "settings.runtime.command_hint": "请 SSH 到 EC2，在 apps/web 目录执行此命令。",
    "settings.runtime.copy_reload": "复制命令",
    "settings.runtime.recheck_database": "我已重启，检测数据库",
    "settings.runtime.safe_note": "此页面只展示命令，不会直接执行 PM2，避免给 Web 进程授予 shell 权限。",
    "settings.status.title": "当前生效配置",
    "settings.status.dify_url": "Dify URL",
    "settings.status.dify_key": "Dify Key",
    "settings.status.database": "数据库",
    "settings.status.not_set": "未配置",
    "settings.status.local_file": "本地文件存储",
    "settings.check.title": "配置自检",
    "settings.check.desc": "验证 Dify、数据库结构和本地数据迁移状态。Dify 测试会真实运行工作流但不保存报告。",
    "settings.check.run_all": "运行全部自检",
    "settings.check.test_dify": "测试 Dify",
    "settings.check.test_database": "测试数据库",
    "settings.check.init_database": "初始化数据库",
    "settings.check.migrate_local": "迁移本地数据",
    "settings.check.last_all": "最近全部自检",
    "settings.check.last_dify": "最近 Dify 测试",
    "settings.check.last_database": "最近数据库测试",
    "settings.check.last_migration": "最近数据迁移",
    "settings.check.never": "尚未运行。",
    "settings.check.status_success": "通过",
    "settings.check.status_warning": "需处理",
    "settings.check.status_error": "失败",
    "settings.check.duration": "{n} ms",
    "settings.check.details": "技术详情",
    "settings.check.confirm_dify": "Dify 测试会真实运行一次工作流，可能消耗模型/API 额度，但不会保存报告。确认继续？",
    "settings.check.confirm_init": "初始化会创建缺失表、补齐缺失字段和索引，不会删除数据。确认继续？",
    "settings.check.confirm_migrate": "迁移会把本地 JSON 中尚未导入的报告、计划和任务写入数据库，遇到相同 ID 会跳过。确认继续？",
    "settings.users.title": "用户与邀请码",
    "settings.users.desc": "管理员可以创建邀请码、查看用户，并禁用异常账号。",
    "settings.users.list": "用户列表",
    "settings.users.empty": "还没有用户。",
    "settings.users.active": "启用中",
    "settings.users.disabled": "已禁用",
    "settings.users.enable": "启用",
    "settings.users.disable": "禁用",
    "settings.invites.create": "创建邀请码",
    "settings.invites.create_btn": "生成邀请码",
    "settings.invites.code": "邀请码",
    "settings.invites.code_unavailable": "历史邀请码不可恢复",
    "settings.invites.role": "角色",
    "settings.invites.max_uses": "次数",
    "settings.invites.expires": "天数",
    "settings.invites.list": "邀请码",
    "settings.invites.empty": "还没有邀请码。",
    "settings.invites.usage": "使用",
    "settings.invites.expires_at": "过期时间",
    "settings.invites.status": "状态",
    "settings.invites.action": "操作",
    "settings.invites.enable": "启用",
    "settings.invites.disable": "停用",
    "settings.invites.disabled": "已停用",
    "settings.invites.used_up": "已用完",
    "settings.role.user": "普通用户",
    "settings.role.admin": "管理员",

    // 对比
    "compare.title": "对比趋势",
    "compare.subtitle": "选择两份报告，查看哪些仓库重合，哪些仓库各自独有。",
    "compare.picker.a": "报告 A",
    "compare.picker.b": "报告 B",
    "compare.picker.placeholder": "选择一份报告…",
    "compare.empty.title": "请选择两份报告",
    "compare.empty.desc": "选择后将显示共同仓库和差异仓库。",
    "compare.common.title": "共同仓库",
    "compare.common.desc": "在两份报告中均出现。",
    "compare.common.empty": "没有重合的仓库。",
    "compare.only_a": "仅在报告 A 中",
    "compare.only_b": "仅在报告 B 中",
    "compare.column.empty": "没有独有仓库。",
    "compare.column.stars_today": "今日新增 {n}",
    "compare.column.view": "查看",

    // 语言
    "lang.all": "全部",
    "lang.python": "Python",
    "lang.javascript": "JavaScript",
    "lang.typescript": "TypeScript",
    "lang.go": "Go",
    "lang.rust": "Rust",
    "lang.java": "Java",
    "lang.cpp": "C++",
    "lang.switch": "语言",
  },
  en: {
    "common.loading": "Loading…",
    "common.save": "Save",
    "common.saving": "Saving…",
    "common.saved": "Saved",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.download": "Download",
    "common.view": "View",
    "common.back": "Back",
    "common.next": "Next",
    "common.previous": "Previous",
    "common.total": "{n} total",
    "common.enabled": "Enabled",
    "common.disabled": "Disabled",
    "common.never": "Never",
    "common.unknown": "Unknown",
    "common.all": "All",
    "common.tip": "Tip",
    "common.copy": "Copy",
    "common.copied": "Copied",

    "nav.dashboard": "Dashboard",
    "nav.compare": "Compare",
    "nav.schedule": "Schedule",
    "nav.settings": "Settings",
    "nav.brand": "Trending Reports",

    "auth.badge.setup": "First-time setup",
    "auth.badge.login": "Private workspace",
    "auth.title": "Log in to Trending Reports",
    "auth.desc": "Use your email and password to access your reports, schedule, and history.",
    "auth.setup.title": "Create the first admin account",
    "auth.setup.desc": "This account will own existing report history and can manage settings, invites, and users.",
    "auth.database_required": "Multi-user login requires PostgreSQL. Confirm DATABASE_URL is configured and restart the service.",
    "auth.database_unavailable":
      "PostgreSQL is configured, but the service cannot connect: {message}",
    "auth.login.tab": "Log in",
    "auth.register.tab": "Register",
    "auth.setup.tab": "Setup",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.invite_code": "Invite code",
    "auth.switch_login": "Log in instead",
    "auth.switch_register": "Register instead",
    "auth.login.submit": "Log in",
    "auth.register.submit": "Register",
    "auth.setup.submit": "Create admin",
    "auth.logout": "Log out",
    "auth.forbidden": "Your account does not have access to this page.",

    "status.completed": "Completed",
    "status.pending": "Running",
    "status.scheduled": "Scheduled",
    "status.running": "Running",
    "status.cancelled": "Cancelled",
    "status.failed": "Failed",

    "dashboard.title": "GitHub Trending Reports",
    "dashboard.subtitle":
      "Daily AI-powered analysis of GitHub trending repositories, packaged into presentations.",
    "dashboard.date_range.today": "Today",
    "dashboard.date_range.week": "This week",
    "dashboard.date_range.month": "This month",
    "dashboard.btn.generate": "Generate report",
    "dashboard.btn.generating": "Generating…",
    "dashboard.btn.logs": "Generation logs",
    "dashboard.stats.total": "Total reports",
    "dashboard.stats.total_sub": "All time",
    "dashboard.stats.this_week": "This week",
    "dashboard.stats.week_delta": "{sign}{value}% vs last week",
    "dashboard.stats.top_lang": "Most tracked",
    "dashboard.stats.top_lang_sub": "By report count",
    "dashboard.stats.next_run": "Next scheduled run",
    "dashboard.stats.next_run_sub_on": "Triggered by the background queue",
    "dashboard.stats.next_run_sub_off": "Enable in Schedule",
    "dashboard.filter.label": "Filter by language",
    "dashboard.list.title": "All reports",
    "dashboard.list.delete": "Delete reports",
    "dashboard.list.deleting": "Deleting…",
    "dashboard.list.delete_selected": "Delete {n}",
    "dashboard.list.select_all": "Select all",
    "dashboard.list.select_report": "Select report #{id}",
    "dashboard.delete.confirm": "Delete {n} selected reports? This cannot be undone.",
    "dashboard.empty.title": "No reports yet",
    "dashboard.empty.desc":
      "Each report includes trending repositories, an AI-written analysis, and a downloadable HTML presentation.",
    "dashboard.empty.bullet1": "Top trending repositories",
    "dashboard.empty.bullet2": "AI summary and key trends",
    "dashboard.empty.bullet3": "Downloadable slideshow",
    "dashboard.empty.btn_generate": "Generate via Dify",
    "dashboard.row.report_id": "Report #{id}",
    "dashboard.row.all_languages": "All languages",
    "dashboard.error.title": "Could not generate via Dify",
    "dashboard.error.tip": "Please check that DIFY_API_URL and DIFY_API_KEY are configured.",
    "dashboard.error.tip_btn": "",
    "dashboard.error.tip_end": "",
    "dashboard.logs.title": "Generation logs",
    "dashboard.logs.subtitle": "Recent report generation and scheduled job runs.",
    "dashboard.logs.reports": "Reports",
    "dashboard.logs.jobs": "Scheduled jobs",
    "dashboard.logs.close": "Close",
    "dashboard.logs.empty": "No generation logs yet",
    "dashboard.logs.report_item": "#{id} · {time} · {status}",
    "dashboard.logs.job_item": "Scheduled {time} · {status}",
    "dashboard.logs.completed_at": "Completed: {time}",
    "dashboard.logs.languages": "Languages: {languages}",
    "dashboard.logs.timezone": "Timezone: {timezone}",

    "report.breadcrumb": "Reports",
    "report.loading": "Loading report…",
    "report.btn.download": "Download HTML",
    "report.btn.open_slideshow": "Open slideshow",
    "report.tab.analysis": "Analysis",
    "report.tab.slides": "Slideshow",
    "report.failed.title": "Report failed to generate",
    "report.failed.unknown": "Unknown error.",
    "report.pending.title": "Report is generating",
    "report.pending.desc":
      "The Dify workflow is running in the background. This page will refresh automatically.",
    "report.summary.title": "Executive summary",
    "report.summary.empty": "No summary available.",
    "report.repos.title": "Top trending repositories",
    "report.repos.subtitle": "Ranked by attention across the trending window.",
    "report.repos.empty": "No repositories returned.",
    "report.repos.stars_today": "+{n} today",
    "report.trends.title": "Key trends",
    "report.lang.title": "Language breakdown",
    "report.lang.subtitle": "Share of trending activity.",
    "report.lang.empty": "No data.",
    "report.about.title": "About this report",
    "report.about.generated": "Generated {time}",
    "report.about.status": "Status: {status}",
    "report.about.filter": "Filter: {filter}",

    "slides.counter": "Slide {current} of {total}",
    "slides.btn.download": "Download HTML",
    "slides.btn.present": "Present",
    "slides.tip": "Use ← → keys to navigate",

    "schedule.title": "Schedule",
    "schedule.subtitle":
      "Configure automatic report generation and download the Dify workflow file.",
    "schedule.dify.title": "Dify workflow file",
    "schedule.dify.subtitle":
      "Download a ready-made .yml workflow and import it into Dify — no manual node setup needed.",
    "schedule.dify.download": "Download .yml",
    "schedule.dify.step1.title": "Import workflow",
    "schedule.dify.step1.desc":
      "Log in to Dify → Create app → Import from DSL → upload the .yml file you downloaded.",
    "schedule.dify.step1.link": "Open Dify",
    "schedule.dify.step2.title": "Select LLM model",
    "schedule.dify.step2.desc":
      "After import, click the LLM node and select a model you have configured (GPT-4o, Claude, Qwen, etc.).",
    "schedule.dify.step3.title": "Fill in API info",
    "schedule.dify.step3.desc":
      "Publish, open the API page, and put the key + URL into DIFY_API_KEY and DIFY_API_URL env vars.",
    "schedule.dify.info":
      "The workflow contains: an HTTP node (fetches GitHub Trending page) + an LLM node (returns structured JSON with summary, repos, language breakdown, and slides). Just select a model after import.",
    "schedule.form.auto_title": "Automatic reports",
    "schedule.form.auto_desc":
      "When enabled, reports are generated three times daily.",
    "schedule.form.time_label": "Daily run time",
    "schedule.form.slot_1": "First run",
    "schedule.form.slot_2": "Second run",
    "schedule.form.slot_3": "Third run",
    "schedule.form.timezone_label": "Schedule timezone",
    "schedule.form.timezone": "Runs on the local time of {timezone}.",
    "schedule.form.lang_label": "Languages to track",
    "schedule.form.lang_hint": "One report is generated per language each run.",
    "schedule.form.runs_when":
      "A background job queue triggers runs automatically at the scheduled time.",
    "schedule.status.title": "Status",
    "schedule.status.next": "Next run: {time}",
    "schedule.status.last": "Last run: {time}",
    "schedule.status.times": "Daily times: {times}",
    "schedule.status.timezone": "Schedule timezone: {timezone}",
    "schedule.status.langs": "Tracked languages: ",

    "settings.title": "Settings",
    "settings.subtitle":
      "Manage Dify, database, users, and invites. Secrets are stored only in the server-side config file.",
    "settings.logout": "Log out",
    "settings.save": "Save settings",
    "settings.source.env": "Environment",
    "settings.source.config": "Config file",
    "settings.source.unset": "Unset",
    "settings.auth.setup_title": "Set admin password",
    "settings.auth.setup_desc":
      "Create the admin password before first use. Only the admin can view and edit settings afterward.",
    "settings.auth.login_title": "Admin login",
    "settings.auth.login_desc": "Enter the admin password to edit service settings.",
    "settings.auth.password": "Admin password",
    "settings.auth.password_hint": "At least 8 characters.",
    "settings.auth.setup_btn": "Create and enter",
    "settings.auth.login_btn": "Log in",
    "settings.secret.keep": "Leave blank to keep current value: {value}",
    "settings.dify.title": "Dify workflow",
    "settings.dify.desc":
      "Dify Base URL and App Key apply immediately to new report generation requests.",
    "settings.dify.base_url": "Dify Base URL",
    "settings.dify.app_key": "Dify App Key",
    "settings.dify.clear_key": "Clear saved App Key",
    "settings.database.title": "Database",
    "settings.database.desc":
      "PostgreSQL / Neon is recommended for production. Without it, local JSON storage remains active.",
    "settings.database.url": "Database connection URL",
    "settings.database.clear_url": "Clear saved database URL",
    "settings.database.restart_note":
      "The database connection is read when the web service and schedule worker start; restart both after changing it.",
    "settings.runtime.title": "Service restart",
    "settings.runtime.desc":
      "Dify changes apply to new requests immediately; database connection changes require restarting the web service and schedule worker on EC2.",
    "settings.runtime.command_label": "PM2 reload command",
    "settings.runtime.command_hint":
      "SSH into EC2 and run this command from the apps/web directory.",
    "settings.runtime.copy_reload": "Copy command",
    "settings.runtime.recheck_database": "Restarted, test database",
    "settings.runtime.safe_note":
      "This page only shows the command. It does not execute PM2 directly, so the web process does not need shell permissions.",
    "settings.status.title": "Effective settings",
    "settings.status.dify_url": "Dify URL",
    "settings.status.dify_key": "Dify Key",
    "settings.status.database": "Database",
    "settings.status.not_set": "Not configured",
    "settings.status.local_file": "Local file storage",
    "settings.check.title": "Configuration self-check",
    "settings.check.desc":
      "Validate Dify, database schema, and local data migration status. The Dify test runs the workflow without saving a report.",
    "settings.check.run_all": "Run all checks",
    "settings.check.test_dify": "Test Dify",
    "settings.check.test_database": "Test database",
    "settings.check.init_database": "Initialize database",
    "settings.check.migrate_local": "Migrate local data",
    "settings.check.last_all": "Last full check",
    "settings.check.last_dify": "Last Dify test",
    "settings.check.last_database": "Last database test",
    "settings.check.last_migration": "Last data migration",
    "settings.check.never": "Not run yet.",
    "settings.check.status_success": "Passed",
    "settings.check.status_warning": "Needs attention",
    "settings.check.status_error": "Failed",
    "settings.check.duration": "{n} ms",
    "settings.check.details": "Technical details",
    "settings.check.confirm_dify":
      "The Dify test will run the workflow once and may consume model/API quota. It will not save a report. Continue?",
    "settings.check.confirm_init":
      "Initialization creates missing tables and adds missing columns/indexes without deleting data. Continue?",
    "settings.check.confirm_migrate":
      "Migration writes local JSON reports, schedule, and jobs that are not already in the database. Matching IDs are skipped. Continue?",
    "settings.users.title": "Users and invites",
    "settings.users.desc": "Admins can create invite codes, review users, and disable accounts.",
    "settings.users.list": "Users",
    "settings.users.empty": "No users yet.",
    "settings.users.active": "Active",
    "settings.users.disabled": "Disabled",
    "settings.users.enable": "Enable",
    "settings.users.disable": "Disable",
    "settings.invites.create": "Create invite",
    "settings.invites.create_btn": "Generate invite",
    "settings.invites.code": "Invite code",
    "settings.invites.code_unavailable": "Legacy code unavailable",
    "settings.invites.role": "Role",
    "settings.invites.max_uses": "Uses",
    "settings.invites.expires": "Days",
    "settings.invites.list": "Invites",
    "settings.invites.empty": "No invites yet.",
    "settings.invites.usage": "Usage",
    "settings.invites.expires_at": "Expires",
    "settings.invites.status": "Status",
    "settings.invites.action": "Action",
    "settings.invites.enable": "Enable",
    "settings.invites.disable": "Disable",
    "settings.invites.disabled": "Disabled",
    "settings.invites.used_up": "Used up",
    "settings.role.user": "User",
    "settings.role.admin": "Admin",

    "compare.title": "Compare trends",
    "compare.subtitle":
      "Select two reports to see which repositories overlap and which are unique.",
    "compare.picker.a": "Report A",
    "compare.picker.b": "Report B",
    "compare.picker.placeholder": "Select a report…",
    "compare.empty.title": "Pick two reports",
    "compare.empty.desc":
      "Once selected, common and diverging repositories will appear here.",
    "compare.common.title": "Common repositories",
    "compare.common.desc": "Appear in both selected reports.",
    "compare.common.empty": "No overlap.",
    "compare.only_a": "Only in Report A",
    "compare.only_b": "Only in Report B",
    "compare.column.empty": "No unique repositories.",
    "compare.column.stars_today": "+{n} today",
    "compare.column.view": "View",

    "lang.all": "All",
    "lang.python": "Python",
    "lang.javascript": "JavaScript",
    "lang.typescript": "TypeScript",
    "lang.go": "Go",
    "lang.rust": "Rust",
    "lang.java": "Java",
    "lang.cpp": "C++",
    "lang.switch": "Language",
  },
};

const LS_KEY = "app-locale";

function detectInitialLocale() {
  if (typeof window === "undefined") return "zh";
  try {
    const saved = window.localStorage.getItem(LS_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  const browser =
    (typeof navigator !== "undefined" && navigator.language) || "";
  return browser.toLowerCase().startsWith("zh") ? "zh" : "en";
}

// 简单的事件订阅，跨组件同步语言切换
const listeners = new Set();
let currentLocale = "zh";

export function getLocale() {
  return currentLocale;
}

export function setLocale(loc) {
  if (loc !== "zh" && loc !== "en") return;
  currentLocale = loc;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_KEY, loc);
      document.documentElement.setAttribute(
        "lang",
        loc === "zh" ? "zh-CN" : "en",
      );
    } catch {}
  }
  listeners.forEach((fn) => fn(loc));
}

export function useLocale() {
  const [locale, setLocaleState] = useState(currentLocale);

  // 初始化（仅在客户端首次挂载时同步一次）
  useEffect(() => {
    const initial = detectInitialLocale();
    currentLocale = initial;
    setLocaleState(initial);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "lang",
        initial === "zh" ? "zh-CN" : "en",
      );
    }
    const handler = (loc) => setLocaleState(loc);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const t = useCallback(
    (key, params) => {
      const table = dict[locale] || dict.zh;
      let text = table[key] ?? dict.zh[key] ?? key;
      if (params && typeof params === "object") {
        Object.keys(params).forEach((k) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
        });
      }
      return text;
    },
    [locale],
  );

  return { locale, setLocale, t };
}

// 日期/时间格式化（按语言）
export function formatDate(iso, locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso, locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
