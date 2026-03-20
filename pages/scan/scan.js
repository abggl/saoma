const app = getApp();
import { submitRecord, uploadImages, getConfig, checkCode } from '../../utils/cloud.js';

Page({
  data: {
    pageTitle: '扫码查重',
    pageDesc: '扫描商品二维码/条码，检查是否重复',
    backgroundImage: '',
    
    codeInput: '',
    remark: '',
    images: [],
    
    checkResult: null,
    isChecking: false,
    canSubmit: false,
    submitButtonText: '请输入编码',
    
    isLoading: false,
    loadingText: '',
    
    userInfo: null,
    isLoggedIn: false
  },

  onLoad() {
    this.loadConfig();
    this.checkLogin();
  },

  onShow() {
    this.loadConfig();
    this.checkLogin();
  },

  async loadConfig() {
    if (app.globalData && app.globalData.config) {
      const config = app.globalData.config;
      this.setData({
        pageTitle: config.scanPageTitle || '扫码查重',
        pageDesc: config.scanPageDesc || '扫描商品二维码/条码，检查是否重复',
        backgroundImage: config.backgroundImage || ''
      });
    } else {
      try {
        const result = await getConfig();
        if (result.success && result.data) {
          const config = {
            scanPageTitle: result.data.scanPageTitle || '扫码查重',
            scanPageDesc: result.data.scanPageDesc || '扫描商品二维码/条码，检查是否重复',
            backgroundImage: result.data.backgroundImage || ''
          };
          this.setData({
            pageTitle: config.scanPageTitle,
            pageDesc: config.scanPageDesc,
            backgroundImage: config.backgroundImage
          });
          app.globalData.config = config;
        }
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    }
  },

  async checkLogin() {
    if (app.isLoggedIn()) {
      const userInfo = app.getUserInfo();
      if (userInfo && userInfo.userId) {
        this.setData({
          userInfo: userInfo,
          isLoggedIn: true
        });
        this.updateSubmitButton();
        return;
      }
    }

    try {
      this.setData({ isLoading: true, loadingText: '正在登录...' });
      const userInfo = await app.login();
      if (userInfo && userInfo.userId) {
        this.setData({
          userInfo: userInfo,
          isLoggedIn: true,
          isLoading: false,
          loadingText: ''
        });
        this.updateSubmitButton();
      } else {
        throw new Error('获取用户信息失败');
      }
    } catch (error) {
      this.setData({ 
        isLoading: false, 
        loadingText: '',
        isLoggedIn: false,
        userInfo: null
      });
      dd.alert({
        title: '登录失败',
        content: error.message || '请检查网络后重试',
        buttonText: '知道了'
      });
    }
  },

  onCodeInput(e) {
    const value = e.detail.value;
    this.setData({ 
      codeInput: value,
      checkResult: null
    });
    this.updateSubmitButton();
    
    if (value && value.trim()) {
      this.debounceCheckCode(value.trim());
    }
  },

  debounceTimer: null,
  
  debounceCheckCode(code) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.checkCodeExists(code);
    }, 500);
  },

  async checkCodeExists(code) {
    if (!code || this.data.isChecking) return;
    
    this.setData({ isChecking: true });
    
    try {
      const result = await checkCode(code);
      
      if (result.success && result.data) {
        this.setData({
          checkResult: {
            exists: result.data.exists,
            record: result.data.record
          },
          isChecking: false
        });
        
        this.updateSubmitButton();
      } else {
        this.setData({ isChecking: false });
      }
    } catch (error) {
      console.error('查重失败:', error);
      this.setData({ isChecking: false });
    }
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  updateSubmitButton() {
    const { codeInput, isLoggedIn, checkResult } = this.data;
    
    let canSubmit = false;
    let buttonText = '提交';
    
    if (!isLoggedIn) {
      buttonText = '请先登录';
    } else if (!codeInput || codeInput.trim() === '') {
      buttonText = '请输入编码';
    } else if (checkResult && checkResult.exists) {
      canSubmit = false;
      buttonText = '编码已存在';
    } else {
      canSubmit = true;
      buttonText = '提交';
    }
    
    this.setData({
      canSubmit: canSubmit,
      submitButtonText: buttonText
    });
  },

  startScan() {
    const that = this;
    
    dd.scan({
      type: 'all',
      success(res) {
        const code = res.code || res.result || '';
        that.setData({ 
          codeInput: code,
          checkResult: null
        });
        that.updateSubmitButton();
        
        if (code) {
          that.checkCodeExists(code.trim());
        }
        
        dd.showToast({ content: '扫描成功', type: 'success' });
      },
      fail(err) {
        dd.showToast({ content: '扫码失败，请重试', type: 'fail' });
      }
    });
  },

  chooseImage() {
    const that = this;
    const { images } = this.data;
    
    if (images.length >= 9) {
      dd.showToast({ content: '最多只能选择9张图片', type: 'fail' });
      return;
    }
    
    dd.chooseImage({
      count: 9 - images.length,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success(res) {
        const newImages = [...images, ...res.filePaths];
        that.setData({ images: newImages });
      },
      fail(err) {
        dd.showToast({ content: '选择图片失败', type: 'fail' });
      }
    });
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const { images } = this.data;
    
    dd.previewImage({
      urls: images,
      current: images[index]
    });
  },

  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const { images } = this.data;
    
    const newImages = images.filter((_, i) => i !== index);
    this.setData({ images: newImages });
  },

  async submitForm() {
    const { codeInput, remark, images, userInfo, isLoggedIn, isLoading, checkResult } = this.data;
    
    if (isLoading) return;
    
    if (!isLoggedIn || !userInfo || !userInfo.userId) {
      dd.showToast({ content: '请先登录', type: 'fail' });
      await this.checkLogin();
      return;
    }
    
    if (!codeInput || codeInput.trim() === '') {
      dd.showToast({ content: '请输入编码', type: 'fail' });
      return;
    }

    if (checkResult && checkResult.exists) {
      dd.alert({
        title: '提交失败',
        content: '该编码已存在，不可重复提交',
        buttonText: '知道了'
      });
      return;
    }

    this.setData({ isLoading: true, loadingText: '正在提交...' });

    try {
      let imageUrls = [];
      if (images.length > 0) {
        this.setData({ loadingText: '正在上传图片...' });
        imageUrls = await uploadImages(images);
      }

      this.setData({ loadingText: '正在保存数据...' });
      
      const result = await submitRecord({
        code: codeInput.trim(),
        remark: remark.trim(),
        images: imageUrls,
        submitterId: userInfo.userId,
        submitterName: userInfo.name
      });

      if (result.success) {
        this.setData({
          codeInput: '',
          remark: '',
          images: [],
          checkResult: null,
          canSubmit: false,
          submitButtonText: '请输入编码',
          isLoading: false,
          loadingText: ''
        });
        
        dd.showToast({ content: '提交成功', type: 'success' });
      } else {
        if (result.errorCode === 'DUPLICATE_CODE' || (result.errorMessage && result.errorMessage.includes('已存在'))) {
          dd.alert({
            title: '提交失败',
            content: '该编码已存在，不可重复提交',
            buttonText: '知道了'
          });
          this.setData({ 
            checkResult: { exists: true },
            canSubmit: false,
            submitButtonText: '编码已存在',
            isLoading: false,
            loadingText: ''
          });
        } else {
          throw new Error(result.errorMessage || '提交失败');
        }
      }
    } catch (error) {
      this.setData({ isLoading: false, loadingText: '' });
      
      if (error.message && error.message.includes('已存在')) {
        dd.alert({
          title: '提交失败',
          content: '该编码已存在，不可重复提交',
          buttonText: '知道了'
        });
        this.setData({ 
          checkResult: { exists: true },
          canSubmit: false,
          submitButtonText: '编码已存在'
        });
      } else {
        dd.alert({
          title: '提交失败',
          content: error.message || '网络错误，请重试',
          buttonText: '知道了'
        });
      }
    }
  }
});
