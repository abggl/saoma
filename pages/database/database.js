const app = getApp();
const excelUtil = require('../../utils/excel.js');
import { getHistory, getConfig, updateConfig, uploadImages, importRecords } from '../../utils/cloud.js';

const PAGE_SIZE = 20;
const DATABASE_PASSWORD = '123456';

Page({
  data: {
    isPasswordVerified: false,
    passwordInput: '',
    passwordError: '',
    
    isLoggedIn: false,
    userInfo: null,
    records: [],
    totalCount: 0,
    currentPage: 1,
    hasMore: true,
    isLoading: false,
    loadingText: '',
    
    searchKeyword: '',
    sortOrder: 'time_desc',
    showSortModal: false,
    
    showDetailModal: false,
    currentItem: null,
    
    showConfigModal: false,
    config: {
      scanPageTitle: '扫码查重',
      scanPageDesc: '扫描商品二维码/条码，检查是否重复',
      backgroundImage: ''
    },
    configForm: {
      scanPageTitle: '',
      scanPageDesc: '',
      backgroundImage: ''
    },
    
    showImportModal: false,
    importProgress: 0,
    importStatus: '',
    importResult: null
  },

  onLoad() {
    this.checkLogin();
    this.loadConfig();
  },

  onShow() {
    this.checkLogin();
  },

  onPasswordInput(e) {
    this.setData({ 
      passwordInput: e.detail.value,
      passwordError: ''
    });
  },

  verifyPassword() {
    const { passwordInput } = this.data;
    if (passwordInput === DATABASE_PASSWORD) {
      this.setData({ 
        isPasswordVerified: true,
        passwordInput: '',
        passwordError: ''
      });
    } else {
      this.setData({ 
        passwordError: '密码错误，请重试',
        passwordInput: ''
      });
    }
  },

  goBack() {
    dd.navigateBack();
  },

  async checkLogin() {
    if (app.isLoggedIn()) {
      const userInfo = app.getUserInfo();
      if (userInfo && userInfo.userId) {
        this.setData({
          isLoggedIn: true,
          userInfo: userInfo
        });
        if (this.data.isPasswordVerified) {
          await this.loadData();
        }
        return;
      }
    }

    try {
      dd.showLoading({ content: '正在登录...' });
      const userInfo = await app.login();
      if (userInfo && userInfo.userId) {
        this.setData({
          isLoggedIn: true,
          userInfo: userInfo
        });
        dd.hideLoading();
        if (this.data.isPasswordVerified) {
          await this.loadData();
        }
      } else {
        throw new Error('获取用户信息失败');
      }
    } catch (error) {
      dd.hideLoading();
      dd.alert({
        title: '登录失败',
        content: error.message || '请检查网络后重试',
        buttonText: '知道了'
      });
    }
  },

  async loadConfig() {
    try {
      const result = await getConfig();
      if (result.success && result.data) {
        const config = {
          scanPageTitle: result.data.scanPageTitle || '扫码查重',
          scanPageDesc: result.data.scanPageDesc || '扫描商品二维码/条码，检查是否重复',
          backgroundImage: result.data.backgroundImage || ''
        };
        this.setData({ config });
        app.globalData.config = config;
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  },

  async loadData() {
    const { isLoading, searchKeyword, sortOrder } = this.data;
    
    if (isLoading) return;

    this.setData({ isLoading: true, loadingText: '正在加载数据...' });

    try {
      const result = await getHistory(null, 1, PAGE_SIZE, searchKeyword, sortOrder);

      if (result.success && result.data) {
        this.setData({
          records: result.data.list || [],
          totalCount: result.data.total || 0,
          hasMore: result.data.hasMore || false,
          currentPage: 1,
          isLoading: false,
          loadingText: ''
        });
      } else {
        throw new Error(result.errorMessage || '加载失败');
      }
    } catch (error) {
      this.setData({ isLoading: false, loadingText: '' });
      dd.showToast({ content: error.message || '加载失败', type: 'fail' });
    }
  },

  async loadMore() {
    const { currentPage, records, hasMore, isLoading, searchKeyword, sortOrder } = this.data;
    
    if (isLoading || !hasMore) return;

    this.setData({ isLoading: true, loadingText: '加载更多...' });

    try {
      const nextPage = currentPage + 1;
      const result = await getHistory(null, nextPage, PAGE_SIZE, searchKeyword, sortOrder);

      if (result.success && result.data) {
        this.setData({
          records: [...records, ...(result.data.list || [])],
          currentPage: nextPage,
          hasMore: result.data.hasMore || false,
          isLoading: false,
          loadingText: ''
        });
      } else {
        throw new Error(result.errorMessage || '加载失败');
      }
    } catch (error) {
      this.setData({ isLoading: false, loadingText: '' });
      dd.showToast({ content: error.message || '加载失败', type: 'fail' });
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.setData({ currentPage: 1 });
    this.loadData();
  },

  clearSearch() {
    this.setData({ searchKeyword: '', currentPage: 1 });
    this.loadData();
  },

  showSort() {
    this.setData({ showSortModal: true });
  },

  hideSort() {
    this.setData({ showSortModal: false });
  },

  selectSort(e) {
    const order = e.currentTarget.dataset.order;
    this.setData({ 
      sortOrder: order, 
      showSortModal: false,
      currentPage: 1
    });
    this.loadData();
  },

  showDetail(e) {
    const index = e.currentTarget.dataset.index;
    const { records } = this.data;
    
    if (records[index]) {
      this.setData({
        showDetailModal: true,
        currentItem: records[index]
      });
    }
  },

  hideDetail() {
    this.setData({
      showDetailModal: false,
      currentItem: null
    });
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const { currentItem } = this.data;
    
    if (currentItem && currentItem.images && currentItem.images.length > 0) {
      dd.previewImage({
        urls: currentItem.images,
        current: currentItem.images[index] || currentItem.images[0]
      });
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  async refreshData() {
    this.setData({ currentPage: 1, searchKeyword: '' });
    await this.loadData();
    dd.showToast({ content: '刷新成功', type: 'success' });
  },

  async exportToExcel() {
    const { records } = this.data;
    
    if (!records || records.length === 0) {
      dd.showToast({ content: '没有可导出的数据', type: 'fail' });
      return;
    }

    dd.showLoading({ content: '正在生成Excel...' });

    try {
      const columns = [
        { key: 'index', title: '序号', width: 8 },
        { key: 'code', title: '编码', width: 20 },
        { key: 'remark', title: '备注', width: 30 },
        { key: 'submitTime', title: '提交时间', width: 20 },
        { key: 'submitterName', title: '提交人', width: 15 },
        { key: 'imageCount', title: '图片数量', width: 10 }
      ];

      const exportData = records.map((item, index) => ({
        index: index + 1,
        code: item.code || '',
        remark: (item.remark || '').replace(/,/g, '，').replace(/\n/g, ' '),
        submitTime: this.formatDate(item.submitTime),
        submitterName: item.submitter ? item.submitter.name : '',
        imageCount: item.images ? item.images.length : 0
      }));

      const fileName = `扫码记录_${this.formatDateTimeForFile(new Date())}.xlsx`;

      const filePath = await excelUtil.exportToExcel(exportData, {
        sheetName: '扫码记录',
        fileName: fileName,
        columns: columns
      });

      dd.hideLoading();

      dd.showActionSheet({
        title: '导出成功',
        items: ['分享文件', '保存文件'],
        success: (res) => {
          if (res.index === 0) {
            excelUtil.shareFile(filePath, fileName);
          } else {
            dd.saveFile({
              tempFilePath: filePath,
              success: () => {
                dd.showToast({ content: '保存成功', type: 'success' });
              },
              fail: () => {
                dd.showToast({ content: '保存失败', type: 'fail' });
              }
            });
          }
        }
      });
    } catch (error) {
      dd.hideLoading();
      dd.showToast({ content: error.message || '导出失败', type: 'fail' });
    }
  },

  formatDateTimeForFile(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  },

  showImport() {
    this.setData({ showImportModal: true, importProgress: 0, importResult: null });
  },

  hideImport() {
    this.setData({ showImportModal: false });
  },

  async importFromExcel() {
    const { userInfo } = this.data;
    
    if (!userInfo || !userInfo.userId) {
      dd.showToast({ content: '请先登录', type: 'fail' });
      return;
    }

    if (typeof dd.chooseFile !== 'function') {
      dd.alert({
        title: '提示',
        content: '模拟器不支持文件选择功能，请在真机上测试导入功能',
        buttonText: '知道了'
      });
      return;
    }

    dd.chooseFile({
      count: 1,
      type: 'file',
      extension: ['.xlsx', '.xls', '.csv'],
      success: async (res) => {
        const filePath = res.filePaths[0];
        dd.showLoading({ content: '正在解析文件...' });
        
        try {
          const data = await excelUtil.importFromExcel(filePath);
          
          if (!data || data.length === 0) {
            dd.hideLoading();
            dd.showToast({ content: '文件内容为空', type: 'fail' });
            return;
          }

          dd.hideLoading();
          dd.showLoading({ content: `正在导入 ${data.length} 条数据...` });

          const result = await importRecords(data, userInfo.userId, userInfo.name);
          
          dd.hideLoading();
          
          if (result.success && result.data) {
            this.setData({ 
              importResult: {
                total: result.data.total,
                success: result.data.success,
                skip: result.data.skip,
                fail: result.data.fail
              }
            });
            
            await this.loadData();
            
            dd.showToast({ content: '导入完成', type: 'success' });
          } else {
            throw new Error(result.errorMessage || '导入失败');
          }
        } catch (error) {
          dd.hideLoading();
          dd.showToast({ content: error.message || '导入失败', type: 'fail' });
        }
      },
      fail: () => {
        dd.showToast({ content: '选择文件失败', type: 'fail' });
      }
    });
  },

  showConfig() {
    const { config } = this.data;
    this.setData({
      showConfigModal: true,
      configForm: {
        scanPageTitle: config.scanPageTitle,
        scanPageDesc: config.scanPageDesc,
        backgroundImage: config.backgroundImage
      }
    });
  },

  hideConfig() {
    this.setData({ showConfigModal: false });
  },

  onConfigTitleInput(e) {
    this.setData({ 'configForm.scanPageTitle': e.detail.value });
  },

  onConfigDescInput(e) {
    this.setData({ 'configForm.scanPageDesc': e.detail.value });
  },

  chooseBackgroundImage() {
    const that = this;
    dd.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        dd.showLoading({ content: '上传中...' });
        try {
          const urls = await uploadImages(res.filePaths);
          if (urls && urls.length > 0) {
            that.setData({ 'configForm.backgroundImage': urls[0] });
            dd.hideLoading();
            dd.showToast({ content: '上传成功', type: 'success' });
          }
        } catch (error) {
          dd.hideLoading();
          dd.showToast({ content: '上传失败', type: 'fail' });
        }
      },
      fail: () => {
        dd.showToast({ content: '选择图片失败', type: 'fail' });
      }
    });
  },

  clearBackgroundImage() {
    this.setData({ 'configForm.backgroundImage': '' });
  },

  async saveConfig() {
    const { configForm } = this.data;
    
    dd.showLoading({ content: '保存中...' });
    
    try {
      await updateConfig('scanPageTitle', configForm.scanPageTitle);
      await updateConfig('scanPageDesc', configForm.scanPageDesc);
      await updateConfig('backgroundImage', configForm.backgroundImage);
      
      const newConfig = {
        scanPageTitle: configForm.scanPageTitle,
        scanPageDesc: configForm.scanPageDesc,
        backgroundImage: configForm.backgroundImage
      };
      
      this.setData({
        config: newConfig,
        showConfigModal: false
      });
      
      app.globalData.config = newConfig;
      
      dd.hideLoading();
      dd.showToast({ content: '保存成功', type: 'success' });
    } catch (error) {
      dd.hideLoading();
      dd.showToast({ content: error.message || '保存失败', type: 'fail' });
    }
  }
});
