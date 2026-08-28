/**
 * 入群验证设置Schema
 * 总开关 + 验证群列表 + 验证超时与通过冷却
 */

/**
 * 获取完整的入群验证设置Schema
 * @returns {Array} Schema配置
 */
export function getGroupVerifySchemas() {
    return [
        {
            label: '🛡️ 入群验证',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'groupVerify.Enable',
            label: '启用入群验证',
            helpMessage: '开启后，验证群列表中的群有新成员加入时，Bot 会发送随机问题验证真人，超时未答对将被移出群聊。注意：需保证 Bot 在验证群中拥有群管理员权限，否则该群会自动跳过验证',
            component: 'Switch'
        },
        {
            field: 'groupVerify.UseAI',
            label: 'AI 处理模式',
            helpMessage: '开启后入群验证的出题、答案判定（语义等价即算对）、欢迎与提醒均由 AI 以人设口吻对话式生成；关闭或 AI 不可用时自动回退本地题库与代码判定',
            component: 'Switch'
        },
        {
            field: 'groupVerify.VerifyGroups',
            label: '验证群列表',
            helpMessage: '需要进行入群真人验证的群，新成员需答对随机问题才算通过（也可用指令 #添加验证群 或让 AI 添加）',
            component: 'GSubForm',
            componentProps: {
                multiple: true,
                addButtonText: '添加验证群',
                modalTitle: '编辑验证群',
                schemas: [
                    {
                        field: 'group',
                        label: '选择群聊',
                        component: 'GSelectGroup',
                        required: true
                    }
                ]
            }
        },
        {
            field: 'groupVerify.Timeout',
            label: '验证超时（秒）',
            helpMessage: '新成员超过该时长未答对，将公告超时后直接移出群聊（需Bot是管理员）；答错不限制次数，仅撤回答错消息并提醒继续作答',
            component: 'InputNumber',
            componentProps: {
                min: 60,
                max: 86400,
                step: 30,
                placeholder: '默认 300 秒'
            }
        },
        {
            field: 'groupVerify.PassCooldown',
            label: '通过冷却（秒）',
            helpMessage: '验证通过后的免验证时长，期间退群重进不再验证；0 表示每次入群都验证',
            component: 'InputNumber',
            componentProps: {
                min: 0,
                max: 2592000,
                step: 3600,
                placeholder: '默认 86400 秒（1天）'
            }
        }
    ];
}
