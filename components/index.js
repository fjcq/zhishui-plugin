// 导入版本信息模块
import Version from './Version.js'
// 导入数据管理模块
import Data from './Data.js'
// 导入配置管理模块
import Config from './Config.js'
// 导入YAML文件读取器
import YamlReader from './YamlReader.js'
// 导入node.js的路径处理模块，并设置当前工作目录
import _path from 'path'
const Path = process.cwd() // 当前工作目录
// 定义插件名称
const Plugin_Name = 'zhishui-plugin'
// 计算插件的完整路径
const Plugin_Path = _path.join(Path, 'plugins', Plugin_Name);
// 导出配置、数据、版本、路径、插件名和插件路径以及YamlReader
export {
    Config,
    Data,
    Version,
    Path,
    Plugin_Name,
    Plugin_Path,
    YamlReader
}