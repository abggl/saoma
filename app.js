import { initCloud, login as cloudLogin } from './utils/cloud.js';

App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    cloudReady: false,
    config: {
      maxImages: 9,
      pageSize: 20
    }
  },

  onLaunch() {
    console.log('App Launch');
    this.initApp();
  },

  onShow() {
    console.log('App Show');
  },

  onHide() {
    console.log('App Hide');
  },

  async initApp() {
    await this.initCloud();
    const cachedUserInfo = this.loadUserInfoFromCache();
    if (cachedUserInfo && cachedUserInfo.userId) {
      this.globalData.userInfo = cachedUserInfo;
      this.globalData.isLoggedIn = true;
      console.log('从缓存加载用户信息:', cachedUserInfo);
    } else {
      console.log('缓存中没有用户信息，尝试自动登录');
      this.autoLogin();
    }
  },

  async initCloud() {
    try {
      await initCloud();
      this.globalData.cloudReady = true;
      console.log('云服务初始化完成');
    } catch (error) {
      console.error('云服务初始化失败:', error);
      this.globalData.cloudReady = false;
    }
  },

  loadUserInfoFromCache() {
    try {
      const result = dd.getStorageSync({ key: 'userInfo' });
      return result || null;
    } catch (error) {
      console.error('读取缓存失败:', error);
      return null;
    }
  },

  saveUserInfoToCache(userInfo) {
    try {
      dd.setStorageSync({ key: 'userInfo', value: userInfo });
      console.log('用户信息已保存到缓存');
    } catch (error) {
      console.error('保存缓存失败:', error);
    }
  },

  async autoLogin() {
    try {
      console.log('开始自动登录...');
      const authCode = await this.getDingTalkAuthCode();
      console.log('获取到authCode:', authCode);
      
      const result = await cloudLogin(authCode);
      console.log('login云函数返回:', result);

      if (result.success && result.data) {
        const userInfo = result.data;
        
        this.globalData.userInfo = userInfo;
        this.globalData.isLoggedIn = true;
        this.saveUserInfoToCache(userInfo);
        
        console.log('自动登录成功:', userInfo);
        return userInfo;
      } else {
        throw new Error(result.errorMessage || '登录失败');
      }
    } catch (error) {
      console.error('自动登录失败:', error);
      this.globalData.userInfo = null;
      this.globalData.isLoggedIn = false;
      throw error;
    }
  },

  async login() {
    if (this.globalData.isLoggedIn && this.globalData.userInfo) {
      return this.globalData.userInfo;
    }

    const cachedUserInfo = this.loadUserInfoFromCache();
    if (cachedUserInfo && cachedUserInfo.userId) {
      this.globalData.userInfo = cachedUserInfo;
      this.globalData.isLoggedIn = true;
      return cachedUserInfo;
    }

    return await this.autoLogin();
  },

  getDingTalkAuthCode() {
    return new Promise((resolve, reject) => {
      dd.getAuthCode({
        success: (res) => {
          console.log('获取authCode成功:', res.authCode);
          resolve(res.authCode);
        },
        fail: (err) => {
          console.error('获取authCode失败:', err);
          reject(new Error(err.errorMessage || '获取授权码失败'));
        }
      });
    });
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    this.globalData.isLoggedIn = true;
    this.saveUserInfoToCache(userInfo);
  },

  clearUserInfo() {
    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;
    try {
      dd.removeStorageSync({ key: 'userInfo' });
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  },

  getUserInfo() {
    if (this.globalData.userInfo) {
      return this.globalData.userInfo;
    }
    const cachedUserInfo = this.loadUserInfoFromCache();
    if (cachedUserInfo && cachedUserInfo.userId) {
      this.globalData.userInfo = cachedUserInfo;
      this.globalData.isLoggedIn = true;
      return cachedUserInfo;
    }
    return null;
  },

  isLoggedIn() {
    if (this.globalData.isLoggedIn && this.globalData.userInfo) {
      return true;
    }
    const cachedUserInfo = this.loadUserInfoFromCache();
    if (cachedUserInfo && cachedUserInfo.userId) {
      this.globalData.userInfo = cachedUserInfo;
      this.globalData.isLoggedIn = true;
      return true;
    }
    return false;
  },

  isCloudReady() {
    return this.globalData.cloudReady;
  }
});
