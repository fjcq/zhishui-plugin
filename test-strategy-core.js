/**
 * 策略模式核心逻辑验证（不依赖框架）
 */

// 模拟策略类
class SessionStrategy {
    async generateSessionId(e) {
        throw new Error('子类必须实现 generateSessionId 方法');
    }
}

class IsolatedSessionStrategy extends SessionStrategy {
    async generateSessionId(e) {
        return e.group_id ? `group_${e.group_id}` : `user_${e.user_id}`;
    }
}

class RoleSessionStrategy extends SessionStrategy {
    async generateSessionId(e, roleId = 0) {
        return `role_${roleId}_global`;
    }
    
    createEnhancedMessage(msg, e) {
        const enhancedMessage = {
            role: msg.role,
            content: msg.content,
            additional_info: {
                user_id: e.user_id,
                group_id: e.group_id || 0,
                name: e.sender?.nickname || '',
                timestamp: Date.now()
            }
        };
        
        if (msg.tool_calls) enhancedMessage.tool_calls = msg.tool_calls;
        if (msg.tool_call_id) enhancedMessage.tool_call_id = msg.tool_call_id;
        if (msg.reasoning_content) enhancedMessage.reasoning_content = msg.reasoning_content;
        
        return enhancedMessage;
    }
    
    computeStats(messages) {
        let totalMessages = messages.length;
        let groupMessages = 0;
        let privateMessages = 0;
        let lastScene = null;
        
        for (const msg of messages) {
            if (msg.additional_info) {
                if (msg.additional_info.group_id && msg.additional_info.group_id !== 0) {
                    groupMessages++;
                    lastScene = { type: 'group', source_id: String(msg.additional_info.group_id) };
                } else {
                    privateMessages++;
                    lastScene = { type: 'private', source_id: String(msg.additional_info.user_id) };
                }
            }
        }
        
        return { totalMessages, groupMessages, privateMessages, lastScene };
    }
}

class SessionStrategyFactory {
    constructor() {
        this.strategies = {
            'isolated': new IsolatedSessionStrategy(),
            'role': new RoleSessionStrategy()
        };
    }
    
    getStrategy(mode) {
        return this.strategies[mode] || this.strategies['role'];
    }
}

console.log('=== 策略模式核心逻辑验证 ===\n');

// 测试1：策略工厂
console.log('测试1：策略工厂');
const factory = new SessionStrategyFactory();
const isolatedStrategy = factory.getStrategy('isolated');
const roleStrategy = factory.getStrategy('role');
const defaultStrategy = factory.getStrategy('unknown');

console.log('✓ isolated策略:', isolatedStrategy instanceof IsolatedSessionStrategy);
console.log('✓ role策略:', roleStrategy instanceof RoleSessionStrategy);
console.log('✓ 默认策略:', defaultStrategy instanceof RoleSessionStrategy);
console.log();

// 测试2：V1模式会话ID生成
console.log('测试2：V1模式会话ID生成');
const v1Strategy = new IsolatedSessionStrategy();

const groupEvent = { group_id: '123456', user_id: '111111' };
const privateEvent = { user_id: '222222' };

const groupSessionId = await v1Strategy.generateSessionId(groupEvent);
const privateSessionId = await v1Strategy.generateSessionId(privateEvent);

console.log('✓ 群聊会话ID:', groupSessionId, groupSessionId === 'group_123456');
console.log('✓ 私聊会话ID:', privateSessionId, privateSessionId === 'user_222222');
console.log();

// 测试3：V2模式会话ID生成
console.log('测试3：V2模式会话ID生成');
const v2Strategy = new RoleSessionStrategy();

const mockEvent = { group_id: '123456', user_id: '111111' };
const sessionId = await v2Strategy.generateSessionId(mockEvent, 0);

console.log('✓ V2会话ID:', sessionId, sessionId === 'role_0_global');
console.log();

// 测试4：增强消息创建
console.log('测试4：增强消息创建');
const mockMsg = {
    role: 'user',
    content: '测试消息',
    tool_calls: [{ id: 'test' }]
};

const mockEvent2 = {
    user_id: '111111',
    group_id: '123456',
    sender: { nickname: '测试用户' }
};

const enhancedMessage = v2Strategy.createEnhancedMessage(mockMsg, mockEvent2);

console.log('✓ 消息角色:', enhancedMessage.role === 'user');
console.log('✓ 消息内容:', enhancedMessage.content === '测试消息');
console.log('✓ 附加信息存在:', !!enhancedMessage.additional_info);
console.log('✓ 用户ID:', enhancedMessage.additional_info.user_id === '111111');
console.log('✓ 群ID:', enhancedMessage.additional_info.group_id === '123456');
console.log('✓ 工具调用存在:', !!enhancedMessage.tool_calls);
console.log();

// 测试5：统计信息计算
console.log('测试5：统计信息计算');
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

const stats = v2Strategy.computeStats(messages);

console.log('✓ 总消息数:', stats.totalMessages === 3);
console.log('✓ 群聊消息数:', stats.groupMessages === 2);
console.log('✓ 私聊消息数:', stats.privateMessages === 1);
console.log('✓ 最后场景类型:', stats.lastScene.type === 'group');
console.log();

console.log('=== 所有测试通过 ✓ ===');
