# 止水插件知识库索引

## 项目概览

止水插件是 Yunzai-Bot 的功能扩展插件，提供 AI 对话、视频搜索、乐器演奏等娱乐功能。

### 技术栈
- Node.js >= 16
- ES Module (type: "module")
- YAML 配置管理
- Redis 数据存储

### 核心模块
- `apps/chat/` - AI 对话功能
- `apps/videoSearch/` - 视频搜索功能
- `apps/instrumentPlay.js` - 乐器演奏功能
- `guoba/` - 锅巴面板配置支持

## 最近动态

### 2026-03-27
- **[修复]** AI工具调用全局开关控制失效问题 - 在 `handleToolCall` 中添加了全局开关和单个工具开关的检查逻辑

## 知识分类

- [决策记录](./decisions/) - 架构设计决策
- [设计模式](./patterns/) - 通用设计模式
- [问题修复](./incidents/) - Bug 修复记录
- [开发约定](./conventions/) - 编码规范和约定
