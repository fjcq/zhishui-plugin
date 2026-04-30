/**
 * 会话管理策略模式重构验证测试
 */

import { sessionStrategyFactory, IsolatedSessionStrategy, RoleSessionStrategy } from './apps/chat/strategies/SessionStrategy.js';
import { generateSessionId, loadChatMsg, saveChatMsg, addMessage, clearSessionContext } from './apps/chat/session.js';

console.log('=== 会话管理策略模式重构验证测试 ===\n');

// 测试1：验证策略工厂
console.log('测试1：验证策略工厂');
try {
    const isolatedStrategy = sessionStrategyFactory.getStrategy('isolated');
    const roleStrategy = sessionStrategyFactory.getStrategy('role');
    const defaultStrategy = sessionStrategyFactory.getStrategy('unknown');
    
    console.log('✓ isolated策略:', isolatedStrategy instanceof IsolatedSessionStrategy ? '正确' : '错误');
    console.log('✓ role策略:', roleStrategy instanceof RoleSessionStrategy ? '正确' : '错误');
    console.log('✓ 默认策略:', defaultStrategy instanceof RoleSessionStrategy ? '正确' : '错误');
    console.log();
} catch (error) {
    console.error('✗ 策略工厂测试失败:', error.message);
    console.log();
}

// 测试2：验证V1模式会话ID生成
console.log('测试2：验证V1模式会话ID生成');
try {
    const strategy = new IsolatedSessionStrategy();
    
    const groupEvent = { group_id: '123456', user_id: '111111' };
    const privateEvent = { user_id: '222222' };
    
    const groupSessionId = await strategy.generateSessionId(groupEvent);
    const privateSessionId = await strategy.generateSessionId(privateEvent);
    
    console.log('✓ 群聊会话ID:', groupSessionId, groupSessionId === 'group_123456' ? '正确' : '错误');
    console.log('✓ 私聊会话ID:', privateSessionId, privateSessionId === 'user_222222' ? '正确' : '错误');
    console.log();
} catch (error) {
    console.error('✗ V1模式会话ID生成测试失败:', error.message);
    console.log();
}

// 测试3：验证V2模式会话ID生成
console.log('测试3：验证V2模式会话ID生成');
try {
    const strategy = new RoleSessionStrategy();
    
    const mockEvent = { group_id: '123456', user_id: '111111' };
    
    const sessionId = await strategy.generateSessionId(mockEvent, 0);
    console.log('✓ V2会话ID:', sessionId, sessionId === 'role_0_global' ? '正确' : '错误');
    console.log();
} catch (error) {
    console.error('✗ V2模式会话ID生成测试失败:', error.message);
    console.log();
}

// 测试4：验证增强消息创建
console.log('测试4：验证增强消息创建');
try {
    const strategy = new RoleSessionStrategy();
    
    const mockMsg = {
        role: 'user',
        content: '测试消息',
        tool_calls: [{ id: 'test' }]
    };
    
    const mockEvent = {
        user_id: '111111',
        group_id: '123456',
        sender: { nickname: '测试用户' }
    };
    
    const enhancedMessage = strategy.createEnhancedMessage(mockMsg, mockEvent);
    
    console.log('✓ 消息角色:', enhancedMessage.role === 'user' ? '正确' : '错误');
    console.log('✓ 消息内容:', enhancedMessage.content === '测试消息' ? '正确' : '错误');
    console.log('✓ 附加信息:', enhancedMessage.additional_info ? '存在' : '缺失');
    console.log('✓ 用户ID:', enhancedMessage.additional_info.user_id === '111111' ? '正确' : '错误');
    console.log('✓ 群ID:', enhancedMessage.additional_info.group_id === '123456' ? '正确' : '错误');
    console.log('✓ 工具调用:', enhancedMessage.tool_calls ? '存在' : '缺失');
    console.log();
} catch (error) {
    console.error('✗ 增强消息创建测试失败:', error.message);
    console.log();
}

// 测试5：验证统计信息计算
console.log('测试5：验证统计信息计算');
try {
    const strategy = new RoleSessionStrategy();
    
    const messages = [
        {
            role: 'user',
            content: '消息1',
            additional_info: { user_id: '111', group_id: '123' }
        },
        {
            role: 'assistant',
            content: '消息2',
            additional_info: { user_id: '111', group_id: 0 }
        },
        {
            role: 'user',
            content: '消息3',
            additional_info: { user_id: '222', group_id: '123' }
        }
    ];
    
    const stats = strategy.computeStats(messages);
    
    console.log('✓ 总消息数:', stats.totalMessages === 3 ? '正确' : '错误');
    console.log('✓ 群聊消息数:', stats.groupMessages === 2 ? '正确' : '错误');
    console.log('✓ 私聊消息数:', stats.privateMessages === 1 ? '正确' : '错误');
    console.log('✓ 最后场景:', stats.lastScene.type === 'group' ? '正确' : '错误');
    console.log();
} catch (error) {
    console.error('✗ 统计信息计算测试失败:', error.message);
    console.log();
}

console.log('=== 所有测试完成 ===');
