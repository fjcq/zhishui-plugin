---
type: incident
title: AI工具调用全局开关控制失效
date: 2026-03-27
tags: [bug, 工具调用, 开关控制, 安全]
related_files:
  - apps/chat/tools/handlers/index.js
  - apps/chat/tools/definitions/index.js
  - config/default_config/tools.yaml
status: resolved
---

# AI工具调用全局开关控制失效

## 问题描述

项目中 AI 工具调用功能存在开关控制失效的问题：

1. **全局开关控制失效**：当 `EnableToolCalling` 设为 `false` 时，工具列表仍能被正常显示，且相关工具仍可被用户调用执行
2. **违背设计预期**：全局开关应完全禁用所有工具功能

## 根因分析

在 `apps/chat/tools/handlers/index.js` 的 `handleToolCall` 函数中，**缺少对全局开关和单个工具开关的检查**。

原有代码流程：
```
AI发起工具调用 → handleToolCall → 直接执行工具逻辑
```

虽然 `getEnabledTools()` 在构建请求时会过滤工具列表，但如果 AI 通过某种方式（如缓存的工具列表）发起工具调用，`handleToolCall` 不会再次验证开关状态，直接执行工具逻辑。

## 修复方案

在 `handleToolCall` 函数开头添加开关检查逻辑：

```javascript
// 导入开关检查函数
import { getToolSensitivity, isToolCallingEnabled, isToolEnabled } from '../definitions/index.js';

// 在 handleToolCall 函数开头添加检查
export async function handleToolCall(toolName, toolParams, e = null, currentUserId = null) {
    logger.info(`[工具调用] 开始执行: ${toolName} | 参数: ${JSON.stringify(toolParams)}`);

    // 检查全局开关
    if (!isToolCallingEnabled()) {
        logger.warn(`[工具调用] 全局开关已关闭，拒绝执行: ${toolName}`);
        return {
            error: true,
            disabled: true,
            message: '工具调用功能已禁用'
        };
    }

    // 检查单个工具开关
    if (!isToolEnabled(toolName)) {
        logger.warn(`[工具调用] 工具已禁用，拒绝执行: ${toolName}`);
        return {
            error: true,
            disabled: true,
            message: `工具 ${toolName} 已禁用`
        };
    }

    // ... 原有逻辑
}
```

## 修复后流程

```
AI发起工具调用
      ↓
handleToolCall 入口
      ↓
┌─────────────────────────────────┐
│ 1. 检查全局开关 EnableToolCalling │
│ 2. 检查单个工具开关 Tools.{name} │
│ 任一开关关闭 → 返回错误          │
└─────────────────────────────────┘
      ↓ (开关都开启)
决策引擎判断 (好感度、敏感度、权限等)
      ↓ (决策通过)
执行具体工具逻辑
```

## 经验教训

1. **双重保障原则**：配置开关不应只在"入口"检查，执行层也需要验证
2. **防御性编程**：敏感操作应在执行前再次验证权限和配置状态
3. **日志记录**：开关拒绝时应记录日志，便于调试和审计

## 影响范围

- 所有 AI 工具调用功能
- 用户通过锅巴面板配置的工具开关现在能正确生效
