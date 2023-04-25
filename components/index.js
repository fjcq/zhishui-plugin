import Version from './Version.js'
import Data from './Data.js'
import Config from './Config.js'
import YamlReader from './YamlReader.js'
import _path from 'path'
const Path = process.cwd()
const Plugin_Name = 'zhishui-plugin'
const Plugin_Path = _path.join(Path,'plugins',Plugin_Name);
export { Config, Data, Version, Path, Plugin_Name, Plugin_Path, YamlReader }
