/**
 * 入群验证处理器汇总入口
 * 导出验证核心与设置指令处理器
 */

export {
    handleGroupIncrease,
    handleVerifyAnswer
} from './verifyHandler.js';

export {
    handleAddVerifyGroup,
    handleRemoveVerifyGroup,
    handleToggleVerify,
    handleVerifySettings
} from './settingsHandler.js';
