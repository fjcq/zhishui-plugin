/**
 * 配置模块入口
 * 整合YAML配置管理、JSON配置管理和用户数据管理
 */

import YamlConfigManager from './YamlConfigManager.js';
import { getJsonConfig, setJsonConfig } from './JsonConfigManager.js';
import {
    GetUserSearchVideos,
    SetUserSearchVideos,
    DeleteUserSearchVideos,
    GetUserChatConfig,
    SetUserChatConfig,
    DeleteUserChatConfig,
    GetAllUserRoleConfigs,
    GetAllUserResourceConfigs
} from './UserDataManager.js';

const Config = YamlConfigManager;

Config.getJsonConfig = getJsonConfig;
Config.setJsonConfig = setJsonConfig;
Config.GetUserSearchVideos = GetUserSearchVideos;
Config.SetUserSearchVideos = SetUserSearchVideos;
Config.DeleteUserSearchVideos = DeleteUserSearchVideos;
Config.GetUserChatConfig = GetUserChatConfig;
Config.SetUserChatConfig = SetUserChatConfig;
Config.DeleteUserChatConfig = DeleteUserChatConfig;
Config.GetAllUserRoleConfigs = GetAllUserRoleConfigs;
Config.GetAllUserResourceConfigs = GetAllUserResourceConfigs;

export { Config };
export default Config;
