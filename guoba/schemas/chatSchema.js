/**
 * 对话设置Schema
 * 单标签页内三段：基础 → 高级 → 存储（Divider分节）
 */

/**
 * 获取对话设置Schema
 * @returns {Array} Schema配置
 */
export function getChatBasicSchemas() {
    return [
        {
            label: '💬 对话设置',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'chat.NickName',
            label: '对话昵称',
            helpMessage: '设置机器人的昵称，用户可以通过这个昵称来触发对话',
            component: 'Input',
            componentProps: {
                placeholder: '如：小止水'
            }
        },
        {
            field: 'chat.EnableAt',
            label: '艾特触发',
            helpMessage: '开启后，用户艾特机器人时也会触发AI对话',
            component: 'Switch'
        },
        {
            field: 'chat.EnablePrivateChat',
            label: '私聊AI回复',
            helpMessage: '开启后，用户私聊机器人时会自动由AI回复',
            component: 'Switch'
        },
        {
            component: 'Divider',
            label: '高级设置'
        },
        {
            field: 'chat.MaxHistory',
            label: '上下文窗口大小',
            helpMessage: 'AI对话时会参考的最近历史消息条数，数量越多上下文越完整，但消耗token也越多。SQLite存储下历史消息全量永久保留，不受此限制',
            component: 'InputNumber',
            componentProps: {
                min: 1,
                max: 200,
                placeholder: '50'
            }
        },
        {
            field: 'chat.EnableThinking',
            label: '启用思考模式',
            helpMessage: '启用后模型会先深度思考再回答，并展示推理过程。支持DeepSeek、OpenAI o1/o3、QwQ、Qwen3、GLM-Z1等。注意：思考模式下不支持temperature等参数和工具调用',
            component: 'Switch'
        },
        {
            component: 'Divider',
            label: '上下文存储'
        },
        {
            field: 'chat.ContextMode',
            label: '存储模式',
            helpMessage: '控制AI对话记录的保存方式。切换模式会清除当前模式的全部聊天记录',
            component: 'Select',
            componentProps: {
                options: [
                    { label: '角色整合（推荐）', value: 'role' },
                    { label: '场景隔离', value: 'isolated' }
                ],
                placeholder: '角色整合：同角色跨场景记忆'
            }
        }
    ];
}
