/**
 * 搜剧设置处理模块
 */

import { Config, Plugin_Path } from '../../../components/index.js';
import YamlReader from '../../../components/YamlReader.js';
import { getSiteIndex } from './searchHandler.js';

/**
 * 处理搜剧接口命令
 * @param {Object} e - 事件对象
 * @param {Function} cancelSearchFn - 取消搜剧函数
 * @param {Function} showInterfaceFn - 显示接口列表函数
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleSearchInterface(e, cancelSearchFn, showInterfaceFn) {
    if (e.isMaster == false) {
        return false;
    }

    const type = e.msg.substring(1, 3);

    if (type == "设置") {
        let index = parseInt(e.msg.replace(/^.*搜剧接口/, '').trim());
        if (isNaN(index)) {
            index = 1;
        }

        const resources = await Config.SearchVideos.resources;
        if (index < 1 && index > resources.length) {
            index = 1;
        }

        cancelSearchFn(e);

        await Config.SetUserSearchVideos(e.user_id, 'idx', index - 1);
        await showInterfaceFn(e);

    }
    else if (type == "增加") {

        const Interface = e.msg.replace(/^.*搜剧接口/, '').trim();

        if (Interface) {

            const [url, title = '新接口', showpic = 'true'] = Interface.split('|');
            const site = {
                site: {
                    showpic: showpic === '显示' || showpic === 'true',
                    title,
                    url
                }
            };

            await Config.modifyarr('videoSearch', `resources`, site, 'add');
            await showInterfaceFn(e);
        }

    }

    else if (type == "删除") {

        const index = parseInt(e.msg.replace(/^.*搜剧接口/, '').trim());
        if (isNaN(index)) {
            e.reply(`接口编号错误！`);
            return false;
        }

        let path = `${Plugin_Path}/config/config/videoSearch.yaml`;
        let yaml = new YamlReader(path);
        let resources = yaml.jsonData['resources'];
        const resource = resources[index - 1];
        const site = resource?.site || resource;
        let title = site?.title || '未命名接口';

        if (index < 0 && index >= resources.length) {
            e.reply(`接口编号错误！`);
            return false;
        }

        yaml.delete(`resources.${index - 1}`);

        e.reply(`已删除搜剧接口： ${title}`);

    }

    else if (type == "查看") {
        await showInterfaceFn(e);
    }
    return true;
}

/**
 * 处理播放器接口命令
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handlePlayerInterface(e) {
    if (e.isMaster == false) {
        return false;
    }

    const type = e.msg.substring(1, 3);
    let msg, Interface = ""
    if (type == "设置") {
        Interface = e.msg.replace(/^.*播放器/, '').trim();
        await Config.modify('videoSearch', 'player', Interface)
        msg = '设置成功，当前播放器：\n';
    } else {
        msg = '当前播放器：\n';
    }
    msg += await Config.SearchVideos.player;
    e.reply(msg);
    return true;
}

/**
 * 显示搜剧接口列表
 * @param {Object} e - 事件对象
 * @returns {Promise<void>}
 */
export async function showSearchInterface(e) {
    const resources = Config.SearchVideos.resources || [];
    if (resources.length === 0) {
        e.reply('当前没有配置搜剧接口');
        return;
    }

    let msg = '*** 搜剧接口列表 ***\n';
    const idx = await getSiteIndex(e);

    resources.forEach((resource, index) => {
        const site = resource?.site || resource;
        const title = site?.title || resource?.title || `未命名接口${index + 1}`;
        const url = site?.url || resource?.url || '无URL';
        const isCurrent = index === idx ? ' [当前]' : '';
        msg += `${index + 1}. ${title}${isCurrent}\n`;
        msg += `   URL: ${url}\n`;
    });

    e.reply(msg);
}

/**
 * 处理我的搜剧命令
 * @param {Object} e - 事件对象
 * @returns {Promise<boolean>} 处理结果
 */
export async function handleMySearchVideo(e) {
    try {
        const userSearchData = await Config.GetUserSearchVideos(e.user_id, [
            'keyword',
            'page',
            'Episode',
            'idx',
            'playData',
            'Route'
        ]);

        if (userSearchData === null || userSearchData === undefined) {
            e.reply(`未能找到你的搜剧记录`);
            throw error;
        }

        const {
            keyword,
            page = 1,
            Episode: initialEpisode,
            idx = 0,
            playData: playDataStr,
            Route
        } = userSearchData;

        if (!playDataStr) {
            e.reply(`没有找到有效的搜剧记录`);
            return false;
        }

        let playData;
        try {
            playData = JSON.parse(playDataStr);
        } catch (error) {
            e.reply(`搜剧记录数据格式错误，请重新搜索`);
            return false;
        }

        let Episode = initialEpisode;
        let msg = '';

        const resource = Config.SearchVideos.resources[idx];
        const site = resource?.site || resource;
        const InterfaceName = site?.title || '错误';

        msg += '*** 搜索记录 ***\n';
        msg += `接口：${InterfaceName}\n`;
        msg += `关键词：${keyword}\n`;
        msg += `搜索页：${page}\n`;
        msg += `线路：${Route}\n\n`;

        Episode = Math.max(1, Math.min(Episode, playData.episodeLinks.length));

        const VodName = playData.VodName;
        const EpisodeName = playData.episodeNames[Episode - 1] || '未知';

        const PlayerUrl = Config.SearchVideos.player + playData.episodeLinks[Episode - 1];

        msg += '*** 播放记录 ***\n';
        msg += `片名：${VodName}\n`;
        msg += `视频：${EpisodeName}\n`;
        msg += `链接：${PlayerUrl}\n`;

        return e.reply(msg);
    } catch (error) {
        e.reply(`获取搜剧记录时发生错误：${error.message}`);
        throw error;
    }
}
