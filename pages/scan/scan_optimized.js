const app = getApp();

// 防抖函数工具
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 节流函数工具（用于按钮防重复点击）
const throttle = (fn, interval) => {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
};

Page({
  data: {
    pageTitle: '扫码查重',
    pageDesc: '扫描商品二维码/条码，检查是否重复',
    backgroundImage: '',
    
    // 表单数据
    codeInput: '',
    remark: '',
    images: [],
    
    // 查重结果
    checkResult: null,
    
    // 提交按钮状态
    canSubmit: false,
    submitButtonText: '提交',
    
    // 按钮锁定状态
    isSubmitting: false
  },

  onLoad() {
    this.loadConfig();
    // 创建防抖查重函数（500ms延迟，避免输入时卡顿）
    this.debouncedCheckDuplicate = debounce(this._checkDuplicateImpl, 500);
  },

  onShow() {
    this.loadConfig();
  },

  // 加载配置
  loadConfig() {
    const config = app.globalData.config;
    this.setData({
      pageTitle: config.scanPageTitle || '扫码查重',
      pageDesc: config.scanPageDesc || '扫描商品二维码/条码，检查是否重复',
      backgroundImage: config.backgroundImage || ''
    });
  },

  /**
   * 编码输入优化 - 解决跳码问题
   * 关键优化：
   * 1. 不返回value，避免受控组件冲突
   * 2. 使用防抖延迟查重
   * 3. 立即更新UI，异步执行查重
   */
  onCodeInput(e) {
    let value = e.detail.value;
    
    // 过滤非数字字母
    value = value.replace(/[^a-zA-Z0-9]/g, '');
    
    // 立即更新输入框（不等待setData回调）
    this.setData({
      codeInput: value,
      checkResult: null  // 重置查重结果
    });
    
    // 更新按钮状态（不依赖查重结果）
    this.updateSubmitButton(value);
    
    // 防抖查重（停止输入500ms后执行）
    if (value) {
      this.debouncedCheckDuplicate(value);
    }
  },

  // 更新提交按钮状态（简化版，不依赖查重）
  updateSubmitButton(value) {
    const canSubmit = value && value.length > 0;
    this.setData({
      canSubmit: canSubmit,
      submitButtonText: value ? '提交' : '请输入编码'
    });
  },

  // 实际查重实现（防抖后执行）
  _checkDuplicateImpl(code) {
    // 使用Map查重，O(1)复杂度
    const codeMap = app.globalData.codeMap || new Map();
    const exists = codeMap.has(code);
    
    this.setData({
      checkResult: { exists },
      // 根据查重结果更新按钮
      canSubmit: code && !exists,
      submitButtonText: exists ? '编码已存在' : '提交'
    });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 扫码（优化：扫码后清除防抖定时器）
  startScan() {
    const that = this;
    
    // 清除输入防抖
    if (this.debouncedCheckDuplicate) {
      this.debouncedCheckDuplicate.cancel && this.debouncedCheckDuplicate.cancel();
    }
    
    dd.scan({
      type: 'all',
      success(res) {
        const code = (res.code || res.result || '').replace(/[^a-zA-Z0-9]/g, '');
        
        that.setData({
          codeInput: code,
          checkResult: null
        });
        
        that.updateSubmitButton(code);
        
        // 扫码后立即查重（不防抖）
        if (code) {
          that._checkDuplicateImpl(code);
        }
        
        dd.showToast({ content: '扫描成功', type: 'success' });
      },
      fail() {
        dd.showToast({ content: '扫码失败，请重试', type: 'fail' });
      }
    });
  },

  // 选择图片
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
      }
    });
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const { images } = this.data;
    
    dd.previewImage({
      urls: images,
      current: images[index]
    });
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const { images } = this.data;
    
    const newImages = images.filter((_, i) => i !== index);
    this.setData({ images: newImages });
    dd.showToast({ content: '已删除', type: 'success' });
  },

  /**
   * 提交表单（防重复点击优化）
   * 使用节流机制，1秒内只能提交一次
   */
  submitForm: throttle(function() {
    const { codeInput, remark, images, checkResult, isSubmitting } = this.data;
    
    // 防重复提交
    if (isSubmitting) {
      dd.showToast({ content: '正在提交，请稍候', type: 'none' });
      return;
    }
    
    if (!codeInput || codeInput.trim() === '') {
      dd.showToast({ content: '请输入编码', type: 'fail' });
      return;
    }
    
    if (checkResult && checkResult.exists) {
      dd.showToast({ content: '编码已存在，不可提交', type: 'fail' });
      return;
    }
    
    // 锁定提交按钮
    this.setData({ isSubmitting: true });
    
    const record = {
      id: this.generateId(),
      code: codeInput.trim(),
      remark: remark.trim(),
      images: images,
      submitTime: this.formatDateTime(new Date()),
      submitter: app.globalData.userInfo,
      hasImages: images.length > 0
    };
    
    // 添加到数据库
    const database = app.globalData.database || [];
    database.unshift(record);
    app.globalData.database = database;
    
    // 同步更新codeMap（用于快速查重）
    if (!app.globalData.codeMap) {
      app.globalData.codeMap = new Map();
    }
    app.globalData.codeMap.set(record.code, record);
    
    // 清空表单
    this.setData({
      codeInput: '',
      remark: '',
      images: [],
      checkResult: null,
      canSubmit: false,
      submitButtonText: '提交',
      isSubmitting: false
    });
    
    dd.showToast({ content: '提交成功', type: 'success' });
  }, 1000),

  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
});
