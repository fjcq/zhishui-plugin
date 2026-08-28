/**
 * 自建音乐API服务设置Schema
 * 作为系统设置标签页内的分节（无SOFT_GROUP_BEGIN）
 */

/**
 * 获取自建音乐API设置的分节Schema
 * @returns {Array} Schema配置
 */
export function getMusicApiSchemas() {
    return [
        {
            component: 'Divider',
            label: '🎵 自建音乐API'
        },
        {
            field: 'musicApi.enabled',
            label: '启用服务',
            helpMessage: '开启后启动自建音乐API服务，提供QQ/酷狗/酷我的音频直链获取能力，失败自动降级到@meting/core',
            component: 'Switch'
        },
        {
            field: 'musicApi.port',
            label: '监听端口',
            helpMessage: '服务监听端口，端口冲突时自动+1（最多3次）',
            component: 'InputNumber',
            componentProps: {
                min: 1024,
                max: 65535,
                placeholder: '3210（默认）'
            }
        },
        {
            field: 'musicApi.host',
            label: '监听地址',
            helpMessage: '建议保持127.0.0.1仅本机访问，确保安全性',
            component: 'Input',
            componentProps: {
                placeholder: '127.0.0.1（仅本机）'
            }
        },
        {
            field: 'musicApi.timeout',
            label: '请求超时(ms)',
            helpMessage: '调用音乐平台API的超时时间，超过此时间将降级到meting',
            component: 'InputNumber',
            componentProps: {
                min: 5000,
                max: 60000,
                step: 1000,
                placeholder: '15000（默认）'
            }
        }
    ];
}
