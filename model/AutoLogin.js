import { launch } from 'puppeteer';

async function createBrowserInstance() {
    const browser = await launch();
    return browser;
}

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}



class MicrosoftBingAutoLogin {
    constructor(bing_account, bing_password) {
        console.log('Initializing auto login for Microsoft Bing ...');
        this.bing_account = bing_account;
        this.bing_password = bing_password;
    
 
        this.init();
    }
   
    async init() {
    this.browser = await createBrowserInstance();
    }

    /** 登录必应 */
    async login() {
    // 构造登录页面的 URL

    const sig = generateRandomString(32);
    const CSRFToken = generateRandomString(8) + '-' + generateRandomString(4) + '-' + generateRandomString(4) + '-' + generateRandomString(4) + '-' + generateRandomString(12);
    const loginUrl = `https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=13&id=264960&wreply=https%3a%2f%2fwww.bing.com%2fsecure%2fPassport.aspx%3fedge_suppress_profile_switch%3d1%26requrl%3dhttps%253a%252f%252fwww.bing.com%252fsearch%253ftoWww%253d1%2526redig%253d9220EACAFFCA40508E4E7BD52023921B%2526q%253dBing%252bAI%2526showconv%253d1%2526wlexpsignin%253d1%26sig=${sig}&wp=MBI_SSL&lc=1028&CSRFToken=${CSRFToken}&aadredir=1`;

    // 打开 Microsoft Bing 的登录页面
    const page = await this.browser.newPage();
    await page.goto(loginUrl);
    
        // 在登录页面中查找账号输入框，并输入您的 Bing 账号
        const accountInput = await page.$('input[name="loginfmt"]');
        await accountInput.type(this.bing_account);
    
        // 在登录页面中查找密码输入框，并输入您的 Bing 密码
        const passwordInput = await page.$('input[name="passwd"]');
        await passwordInput.type(this.bing_password);
    
        // 提交登录表单
        const submitButton = await page.$('input[type="submit"]');
        await submitButton.click();
    }

    async getCookies() {
        // 打开一个网页
        const page = await this.browser.newPage();
        await page.goto('https://bing.com/chat');
    
        // 获取当前页面的所有 cookies
        const cookies = await page.cookies();
        return cookies;
    }
}

export { MicrosoftBingAutoLogin };