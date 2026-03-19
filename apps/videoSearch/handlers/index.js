/**
 * 搜剧处理器模块索引
 */

export {
    handleSearchVideos,
    handleCancelSearch,
    getSiteIndex,
    getSearchState,
    setSearchState
} from './searchHandler.js';

export {
    handleSelectVideo,
    handleWatchVideo,
    handleGoPage,
    handleChangeRoute
} from './playHandler.js';

export {
    handleSearchInterface,
    handlePlayerInterface,
    showSearchInterface,
    handleMySearchVideo
} from './settingsHandler.js';
