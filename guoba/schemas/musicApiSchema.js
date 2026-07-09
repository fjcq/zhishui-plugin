/**
 * 自建音乐API服务设置Schema
 * 合并到系统设置中
 */

/**
 * 获取自建音乐API设置的Schema
 * @returns {Array} Schema配置
 */
export function getMusicApiSchemas() {
    return [
        {
            label: '🎵 自建音乐API',
            component: 'SOFT_GROUP_BEGIN'
        },
        {
            field: 'musicApi.enabled',
            label: '启用服务',
            helpMessage: '开启后，启动自建音乐API服务，提供QQ/酷狗/酷我的音频直链获取能力。失败会自动降级到@meting/core',
            bottomHelpMessage: '是否启用自建音乐API服务',
            component: 'Switch'
        },
        {
            field: 'musicApi.port',
            label: '监听端口',
            helpMessage: '服务监听端口，端口冲突时自动+1（最多3次）',
            bottomHelpMessage: '服务监听端口（默认3210）',
            component: 'InputNumber',
            componentProps: {
                min: 1024,
                max: 65535,
                placeholder: '3210'
            }
        },
        {
            field: 'musicApi.host',
            label: '监听地址',
            helpMessage: '服务监听地址，建议保持127.0.0.1仅本机访问，确保安全性',
            bottomHelpMessage: '服务监听地址（仅本机访问）',
            component: 'Input',
            componentProps: {
                placeholder: '127.0.0.1'
            }
        },
        {
            field: 'musicApi.timeout',
            label: '请求超时(ms)',
            helpMessage: '调用平台API的超时时间，超过此时间将降级',
            bottomHelpMessage: '请求超时时间（毫秒）',
            component: 'InputNumber',
            componentProps: {
                min: 5000,
                max: 60000,
                placeholder: '15000'
            }
        }
    ];
}

export default {
    getMusicApiSchemas
};
