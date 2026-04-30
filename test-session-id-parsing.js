/**
 * 会话ID解析逻辑测试
 */

// 模拟createInitialSessionData方法
function createInitialSessionData(sessionId) {
    const roleIdStr = sessionId.replace('role_', '').replace('_global', '');
    return {
        version: '2.0',
        sessionId,
        roleId: parseInt(roleIdStr) || 0,
        userId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stats: { totalMessages: 0, groupMessages: 0, privateMessages: 0 },
        messages: []
    };
}

console.log('=== 会话ID解析逻辑测试 ===\n');

// 测试不同的会话ID格式
const testCases = [
    { sessionId: 'role_0_global', expectedRoleId: 0 },
    { sessionId: 'role_1_global', expectedRoleId: 1 },
    { sessionId: 'role_10_global', expectedRoleId: 10 },
    { sessionId: 'role_999_global', expectedRoleId: 999 },
];

let allPassed = true;

for (const testCase of testCases) {
    const sessionData = createInitialSessionData(testCase.sessionId);
    const passed = sessionData.roleId === testCase.expectedRoleId && 
                   sessionData.userId === null &&
                   sessionData.sessionId === testCase.sessionId;
    
    console.log(`测试: ${testCase.sessionId}`);
    console.log(`  解析结果:`);
    console.log(`    roleId: ${sessionData.roleId} (期望: ${testCase.expectedRoleId}) ${sessionData.roleId === testCase.expectedRoleId ? '✓' : '✗'}`);
    console.log(`    userId: ${sessionData.userId} (期望: null) ${sessionData.userId === null ? '✓' : '✗'}`);
    console.log(`    sessionId: ${sessionData.sessionId} ${sessionData.sessionId === testCase.sessionId ? '✓' : '✗'}`);
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log();
    
    if (!passed) allPassed = false;
}

console.log(allPassed ? '=== 所有测试通过 ✓ ===' : '=== 存在失败的测试 ✗ ===');
