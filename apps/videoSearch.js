/**
 * 搜剧模块入口
 * 整合所有处理器模块
 */

import { plugin } from '../adapter/index.js';
import { puppeteer } from '../model/index.js';
import { Config } from '../components/index.js';

import {
    handleSearchVideos,
    handleCancelSearch,
    getSiteIndex,
    setSearchState,
    handleSelectVideo,
    handleWatchVideo,
    handleGoPage,
    handleChangeRoute,
    handleSearchInterface,
    handlePlayerInterface,
    showSearchInterface,
    handleMySearchVideo
} from './videoSearch/handlers/index.js';

export class VideoSearch extends plugin {
    constructor() {
        super({
            name: '[止水插件]搜剧',
            dsc: '七星搜剧',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: '^(#|\/)?(设置|增加|删除|查看)搜剧接口(.*)$',
                    fnc: 'SearchInterface'
                }, {
                    reg: '^(#|\/)?(设置|查看)(搜剧)?播放器(.*)$',
                    fnc: 'PlayerInterface'
                }, {
                    reg: '^(#|\/)?取消搜剧$',
                    fnc: 'CancelSearch'
                }, {
                    reg: '^(#|\/)?选剧(.*)',
                    fnc: 'SelectVideo'
                }, {
                    reg: '^(#|\/)?看剧.*集?$',
                    fnc: 'WatchVideo'
                }, {
                    reg: '^(#|\/)?(搜剧)?线路(.*)$',
                    fnc: 'changeRoute'
                }, {
                    reg: '^(#|\/)?我的搜剧$',
                    fnc: 'MySearchVideo'
                }, {
                    reg: '^(#|\/)?(搜剧|到).*页$',
                    fnc: 'GoPage'
                }, {
                    reg: "^(#|\/)?(重新)?搜剧(.*)$",
                    fnc: 'SearchVideos'
                }
            ]
        });
    }

    async SearchVideos(e) {
        return await handleSearchVideos(e, getSiteIndex);
    }

    async SearchInterface(e) {
        return await handleSearchInterface(e, this.CancelSearch.bind(this), this.ShowSearchInterface.bind(this));
    }

    async PlayerInterface(e) {
        return await handlePlayerInterface(e);
    }

    async CancelSearch(e) {
        return await handleCancelSearch(e);
    }

    async SelectVideo(e) {
        return await handleSelectVideo(e, getSiteIndex, puppeteer);
    }

    async WatchVideo(e) {
        return await handleWatchVideo(e);
    }

    async GoPage(e) {
        return await handleGoPage(e, puppeteer);
    }

    async changeRoute(e) {
        return await handleChangeRoute(e, this.SelectVideo.bind(this));
    }

    async MySearchVideo(e) {
        return await handleMySearchVideo(e);
    }

    async ShowSearchInterface(e) {
        return await showSearchInterface(e);
    }
}

export default VideoSearch;
