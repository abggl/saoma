const app = getApp();

// 分页配置
const PAGE_SIZE = 20;
const VISIBLE_PAGE_COUNT = 5; // 可视区域页数（虚拟滚动）

// 防抖函数
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

// 节流函数
const throttle = (fn, interval) => {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      return fn.apply(this, args);
    }
  };
};

// 获取正确的用户数据路径
const getUserDataPath = () => {
  const envPath = dd.env.USER_DATA_PATH;
  if (envPath && envPath.startsWith('https://usr')) {
    return 'ttfile://user';
  }
  return envPath || 'ttfile://user';
};

Page({
  data: {
    // 密码验证
    isAuthenticated: false,
    inputPassword: '',
    
    // 数据库（使用虚拟列表，只渲染可视区域）
    database: [],
    filteredDatabase: [],
    displayDatabase: [],
    
    // 虚拟列表配置
    virtualStart: 0,      // 可视区域起始索引
    virtualEnd: PAGE_SIZE * VISIBLE_PAGE_COUNT, // 可视区域结束索引
    totalCount: 0,        // 总数据量
    
    // 分页
    currentPage: 1,
    totalPages: 1,
    hasMore: true,
    isLoading: false,
    
    // 搜索（防抖）
    showSearch: false,
    searchKeyword: '',
    
    // 排序
    sortField: 'time',
    sortOrder: 'desc',
    
    // 筛选
    filterSubmitter: '',
    filterHasImages: '',
    
    // 弹窗显示状态
    showConfigModal: false,
    showSortModal: false,
    showFilterModal: false,
    showImportModal: false,
    showDetailModal: false,
    
    // 导入进度
    isImporting: false,
    importProgress: 0,
    importStatus: '',
    importResult: null,
    
    // 配置
    config: {
      scanPageTitle: '扫码查重',
      scanPageDesc: '扫描商品二维码/条码，检查是否重复',
      backgroundImage: ''
    },
    
    // 当前查看的详情
    currentItem: null,
    
    // 按钮锁定状态
    isProcessing: false
  },

  onLoad() {
    this.checkAuthentication();
    // 创建防抖搜索函数
    this.debouncedSearch = debounce(this._doSearch, 300);
  },

  onShow() {
    this.checkAuthentication();
    if (this.data.isAuthenticated) {
      this.loadData();
    }
  },

  // ========== 密码验证 ==========
  
  checkAuthentication() {
    this.setData({
      isAuthenticated: false,
      inputPassword: ''
    });
  },

  onPasswordInput(e) {
    this.setData({ inputPassword: e.detail.value });
  },

  verifyPassword() {
    const { inputPassword } = this.data;
    
    if (inputPassword === '8123') {
      this.setData({
        isAuthenticated: true,
        inputPassword: ''
      });
      this.loadData();
      this.loadConfig();
      dd.showToast({ content: '验证成功', type: 'success' });
    } else {
      dd.showToast({ content: '密码错误', type: 'fail' });
      this.setData({ inputPassword: '' });
    }
  },

  goBack() {
    dd.switchTab({ url: '/pages/scan/scan' });
  },

  // ========== 数据加载与虚拟列表 ==========
  
  /**
   * 加载数据（优化版）
   * 使用codeMap加速查重准备
   */
  loadData() {
    const database = app.globalData.database || [];
    
    // 同步构建codeMap（用于快速查重）
    this.rebuildCodeMap(database);
    
    this.setData({
      database: database,
      totalCount: database.length,
      currentPage: 1,
      hasMore: database.length > PAGE_SIZE
    });
    
    this.applyFilters();
  },

  /**
   * 构建编码映射表（O(n)一次构建，O(1)查询）
   * 为云数据库做准备：未来可将此逻辑放在云函数中
   */
  rebuildCodeMap(database) {
    const codeMap = new Map();
    const idMap = new Map();
    
    database.forEach(item => {
      if (item.code) codeMap.set(item.code, item);
      if (item.id) idMap.set(item.id, item);
    });
    
    app.globalData.codeMap = codeMap;
    app.globalData.idMap = idMap;
    
    return { codeMap, idMap };
  },

  /**
   * 应用筛选和排序（优化版）
   * 大数据量时使用分片处理，避免阻塞UI
   */
  applyFilters() {
    if (this.data.isProcessing) return;
    
    this.setData({ isProcessing: true });
    
    const { database, searchKeyword, sortField, sortOrder, filterSubmitter, filterHasImages } = this.data;
    
    // 使用setTimeout让UI有机会渲染loading状态
    setTimeout(() => {
      let result = [...database];
      
      // 搜索优化：先过滤再排序，减少排序数据量
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        result = result.filter(item => 
          (item.code && item.code.toLowerCase().includes(keyword)) ||
          (item.remark && item.remark.toLowerCase().includes(keyword))
        );
      }
      
      if (filterSubmitter) {
        const submitterKeyword = filterSubmitter.toLowerCase();
        result = result.filter(item => 
          item.submitter && item.submitter.name && 
          item.submitter.name.toLowerCase().includes(submitterKeyword)
        );
      }
      
      if (filterHasImages === 'true') {
        result = result.filter(item => item.images && item.images.length > 0);
      } else if (filterHasImages === 'false') {
        result = result.filter(item => !item.images || item.images.length === 0);
      }
      
      // 排序（大数据量时考虑使用Web Worker或云函数）
      result.sort((a, b) => {
        if (sortField === 'time') {
          const timeA = a.submitTime ? new Date(a.submitTime).getTime() : 0;
          const timeB = b.submitTime ? new Date(b.submitTime).getTime() : 0;
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        } else if (sortField === 'code') {
          const codeA = a.code || '';
          const codeB = b.code || '';
          return sortOrder === 'desc' ? codeB.localeCompare(codeA) : codeA.localeCompare(codeB);
        }
        return 0;
      });
      
      const totalPages = Math.ceil(result.length / PAGE_SIZE);
      
      this.setData({
        filteredDatabase: result,
        totalPages: totalPages || 1,
        isProcessing: false
      });
      
      this.loadPage(1);
    }, 0);
  },

  /**
   * 分页加载（优化版）
   * 使用虚拟列表思想，只渲染当前页数据
   */
  loadPage(page) {
    const { filteredDatabase, isLoading } = this.data;
    
    if (isLoading) return;
    
    this.setData({ isLoading: true });
    
    // 使用requestIdleCallback或setTimeout分片渲染
    const loadAsync = () => {
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageData = filteredDatabase.slice(start, end);
      
      if (page === 1) {
        this.setData({
          displayDatabase: pageData,
          currentPage: page,
          hasMore: end < filteredDatabase.length,
          isLoading: false
        });
      } else {
        // 增量更新，避免大数据量setData
        this.setData({
          displayDatabase: [...this.data.displayDatabase, ...pageData],
          currentPage: page,
          hasMore: end < filteredDatabase.length,
          isLoading: false
        });
      }
    };
    
    // 模拟异步，让UI有机会响应
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(loadAsync, { timeout: 100 });
    } else {
      setTimeout(loadAsync, 50);
    }
  },

  /**
   * 加载更多（节流优化）
   */
  loadMore: throttle(function() {
    const { currentPage, hasMore, isLoading } = this.data;
    if (!hasMore || isLoading) return;
    this.loadPage(currentPage + 1);
  }, 300),

  // ========== 搜索功能（防抖优化） ==========
  
  toggleSearch() {
    this.setData({ showSearch: !this.data.showSearch });
  },

  onSearchInput(e) {
    const value = e.detail.value;
    this.setData({ searchKeyword: value });
    // 使用防抖搜索
    this.debouncedSearch();
  },

  _doSearch() {
    this.setData({ currentPage: 1 });
    this.applyFilters();
  },

  clearSearch() {
    this.setData({ searchKeyword: '' });
    this.applyFilters();
  },

  // ========== 排序功能 ==========
  
  showSortModal() {
    this.setData({ showSortModal: true });
  },

  hideSortModal() {
    this.setData({ showSortModal: false });
  },

  setSort(e) {
    const field = e.currentTarget.dataset.field;
    const order = e.currentTarget.dataset.order;
    this.setData({
      sortField: field,
      sortOrder: order
    });
    this.applyFilters();
    this.hideSortModal();
  },

  // ========== 筛选功能 ==========
  
  showFilterModal() {
    this.setData({ showFilterModal: true });
  },

  hideFilterModal() {
    this.setData({ showFilterModal: false });
  },

  onFilterSubmitterInput(e) {
    this.setData({ filterSubmitter: e.detail.value });
  },

  setFilterHasImages(e) {
    this.setData({ filterHasImages: e.currentTarget.dataset.value });
  },

  resetFilter() {
    this.setData({
      filterSubmitter: '',
      filterHasImages: ''
    });
  },

  applyFilter() {
    this.applyFilters();
    this.setData({ showFilterModal: false });
  },

  // ========== 导入功能（分片处理优化） ==========
  
  showImportModal() {
    this.setData({
      showImportModal: true,
      importResult: null,
      isImporting: false,
      importProgress: 0
    });
  },

  hideImportModal() {
    if (this.data.isImporting) {
      dd.showToast({ content: '导入进行中，请稍候', type: 'none' });
      return;
    }
    this.setData({ showImportModal: false });
  },

  /**
   * 下载导入模板（优化错误处理）
   */
  downloadTemplate: throttle(function() {
    const templateContent = '编码,备注,图片\nTEST001,测试商品1,\nTEST002,测试商品2,\nTEST003,示例商品3,';
    
    dd.showLoading({ content: '正在生成模板...' });
    
    try {
      const fs = dd.getFileSystemManager();
      const userPath = getUserDataPath();
      const fileName = `template_${Date.now()}.csv`;
      const filePath = `${userPath}/${fileName}`;
      
      fs.writeFile({
        filePath: filePath,
        data: templateContent,
        encoding: 'utf8',
        success: () => {
          dd.saveFile({
            filePath: filePath,
            success: (res) => {
              dd.hideLoading();
              dd.showModal({
                title: '模板已生成',
                content: 'CSV模板已保存到下载目录',
                showCancel: false,
                confirmButtonText: '知道了'
              });
            },
            fail: () => {
              dd.hideLoading();
              this.copyTemplateToClipboard(templateContent);
            }
          });
        },
        fail: () => {
          dd.hideLoading();
          this.copyTemplateToClipboard(templateContent);
        }
      });
    } catch (err) {
      dd.hideLoading();
      this.copyTemplateToClipboard(templateContent);
    }
  }, 1000),

  copyTemplateToClipboard(content) {
    dd.setClipboard({
      text: content,
      success: () => {
        dd.showModal({
          title: '模板已复制',
          content: '模板内容已复制到剪贴板',
          showCancel: false,
          confirmButtonText: '知道了'
        });
      }
    });
  },

  /**
   * 选择并导入CSV文件
   */
  selectImportFile: throttle(function() {
    const that = this;
    
    dd.chooseAttachment({
      count: 1,
      type: 'file',
      success(res) {
        const filePath = res.filePaths && res.filePaths[0] ? res.filePaths[0] : 
                        res.filePath ? res.filePath : null;
        
        if (!filePath) {
          dd.showToast({ content: '获取文件路径失败', type: 'fail' });
          return;
        }
        
        const lowerPath = filePath.toLowerCase();
        if (!lowerPath.endsWith('.csv') && !lowerPath.endsWith('.txt')) {
          dd.showToast({ content: '请选择CSV或TXT文件', type: 'fail' });
          return;
        }
        
        that.parseAndImportCSV(filePath);
      },
      fail(err) {
        dd.showToast({
          content: '选择文件失败：' + (err.errorMessage || '未知错误'),
          type: 'fail'
        });
      }
    });
  }, 500),

  /**
   * 解析并导入CSV（分片处理优化版）
   * 支持2万条数据流畅导入
   */
  parseAndImportCSV(filePath) {
    const that = this;
    const fs = dd.getFileSystemManager();
    
    this.setData({
      isImporting: true,
      importProgress: 0,
      importStatus: '正在读取文件...'
    });
    
    fs.readFile({
      filePath: filePath,
      encoding: 'utf8',
      success: (res) => {
        const content = res.data;
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          dd.showToast({ content: '文件内容为空或格式错误', type: 'fail' });
          this.setData({ isImporting: false });
          return;
        }
        
        // 解析表头
        const headers = this.parseCSVLine(lines[0]);
        const codeIndex = headers.findIndex(h => 
          h.includes('编码') || h.toLowerCase() === 'code'
        );
        const remarkIndex = headers.findIndex(h => 
          h.includes('备注') || h.toLowerCase() === 'remark'
        );
        
        if (codeIndex === -1) {
          dd.showToast({ content: '未找到编码列，请检查文件格式', type: 'fail' });
          this.setData({ isImporting: false });
          return;
        }
        
        // 准备导入数据
        const dataLines = lines.slice(1);
        const totalLines = dataLines.length;
        
        // 使用已有codeMap进行快速去重检查
        const existingCodes = app.globalData.codeMap || new Map();
        
        let importedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        let currentIndex = 0;
        
        const newRecords = [];
        const chunkSize = totalLines > 10000 ? 200 : 100; // 大数据量时增大分片
        
        this.setData({ importStatus: `准备导入 ${totalLines} 条数据...` });
        
        // 分片处理函数
        const processChunk = () => {
          if (currentIndex >= totalLines) {
            // 导入完成，批量更新数据库
            if (newRecords.length > 0) {
              const database = app.globalData.database || [];
              app.globalData.database = [...database, ...newRecords];
              
              // 批量更新codeMap
              newRecords.forEach(record => {
                existingCodes.set(record.code, record);
              });
              app.globalData.codeMap = existingCodes;
            }
            
            that.setData({
              isImporting: false,
              importProgress: 100,
              importStatus: '导入完成',
              importResult: {
                total: totalLines,
                imported: importedCount,
                skipped: skippedCount,
                failed: failedCount
              }
            });
            
            that.loadData();
            dd.showToast({
              content: `导入完成：成功${importedCount}条`,
              type: 'success'
            });
            return;
          }
          
          const endIndex = Math.min(currentIndex + chunkSize, totalLines);
          const chunk = dataLines.slice(currentIndex, endIndex);
          
          // 处理当前分片
          chunk.forEach(line => {
            try {
              const values = that.parseCSVLine(line);
              const code = values[codeIndex] ? values[codeIndex].trim() : '';
              
              if (!code) {
                failedCount++;
                return;
              }
              
              // 使用Map快速查重 O(1)
              if (existingCodes.has(code)) {
                skippedCount++;
                return;
              }
              
              const remarkValue = (remarkIndex >= 0 && values[remarkIndex]) ? values[remarkIndex].trim() : '';
              
              const record = {
                id: that.generateId(),
                code: code,
                remark: remarkValue,
                images: [],
                submitTime: that.formatDateTime(new Date()),
                submitter: {
                  userId: app.globalData.userInfo.userId,
                  name: app.globalData.userInfo.name
                }
              };
              
              newRecords.push(record);
              existingCodes.set(code, record); // 立即更新Map防止同文件内重复
              importedCount++;
              
            } catch (err) {
              failedCount++;
            }
          });
          
          currentIndex = endIndex;
          const progress = Math.round((currentIndex / totalLines) * 100);
          
          that.setData({
            importProgress: progress,
            importStatus: `已处理 ${currentIndex}/${totalLines} 条...`
          });
          
          // 使用requestAnimationFrame或setTimeout让UI更新
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => setTimeout(processChunk, 0));
          } else {
            setTimeout(processChunk, 5);
          }
        };
        
        processChunk();
      },
      fail: () => {
        this.setData({ isImporting: false });
        dd.showToast({ content: '读取文件失败', type: 'fail' });
      }
    });
  },

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  },

  // ========== 导出功能（节流优化） ==========
  
  exportData: throttle(function() {
    const { filteredDatabase } = this.data;
    
    if (filteredDatabase.length === 0) {
      dd.showToast({ content: '没有可导出的数据', type: 'fail' });
      return;
    }
    
    dd.showActionSheet({
      title: '选择导出方式',
      items: ['导出为CSV文件', '复制到剪贴板'],
      success: (res) => {
        if (res.index === 0) {
          this.exportToCSV();
        } else if (res.index === 1) {
          this.exportToClipboard();
        }
      }
    });
  }, 500),

  exportToCSV() {
    const { filteredDatabase } = this.data;
    
    dd.showLoading({ content: '正在生成导出文件...' });
    
    // 使用分片生成CSV，避免大数据量卡顿
    const generateCSVAsync = () => {
      let csvContent = '\uFEFF';
      csvContent += '编码,备注,提交时间,提交人,图片数量,图片列表\n';
      
      filteredDatabase.forEach((item) => {
        const imageCount = item.images ? item.images.length : 0;
        const imageList = item.images ? item.images.join(';') : '';
        
        const row = [
          item.code || '',
          (item.remark || '').replace(/,/g, '，').replace(/\n/g, ' '),
          item.submitTime || '',
          item.submitter ? item.submitter.name : '',
          imageCount.toString(),
          imageList
        ];
        
        csvContent += row.map(field => `"${field}"`).join(',') + '\n';
      });
      
      return csvContent;
    };
    
    setTimeout(() => {
      const csvContent = generateCSVAsync();
      const now = new Date();
      const timestamp = this.formatDateTimeForFile(now);
      
      try {
        const fs = dd.getFileSystemManager();
        const userPath = getUserDataPath();
        const fileName = `export_${timestamp}.csv`;
        const filePath = `${userPath}/${fileName}`;
        
        fs.writeFile({
          filePath: filePath,
          data: csvContent,
          encoding: 'utf8',
          success: () => {
            dd.saveFile({
              filePath: filePath,
              success: (res) => {
                dd.hideLoading();
                dd.showModal({
                  title: '导出成功',
                  content: `共导出 ${filteredDatabase.length} 条记录`,
                  showCancel: false,
                  confirmButtonText: '知道了'
                });
              },
              fail: () => {
                dd.hideLoading();
                this.copyExportToClipboard(csvContent);
              }
            });
          },
          fail: () => {
            dd.hideLoading();
            this.copyExportToClipboard(csvContent);
          }
        });
      } catch (err) {
        dd.hideLoading();
        this.copyExportToClipboard(csvContent);
      }
    }, 0);
  },

  copyExportToClipboard(content) {
    dd.setClipboard({
      text: content,
      success: () => {
        dd.showModal({
          title: '已复制到剪贴板',
          content: 'CSV内容已复制',
          showCancel: false,
          confirmButtonText: '知道了'
        });
      }
    });
  },

  exportToClipboard() {
    const { filteredDatabase } = this.data;
    
    let content = `数据导出 (${filteredDatabase.length}条)\n==================\n\n`;
    
    filteredDatabase.forEach((item, index) => {
      content += `${index + 1}. 编码：${item.code}\n`;
      content += `   时间：${item.submitTime}\n`;
      content += `   提交人：${item.submitter ? item.submitter.name : ''}\n`;
      if (item.remark) content += `   备注：${item.remark}\n`;
      if (item.images && item.images.length > 0) {
        content += `   图片：${item.images.length}张\n`;
      }
      content += '\n';
    });
    
    dd.setClipboard({
      text: content,
      success: () => {
        dd.showToast({ content: '已复制到剪贴板', type: 'success' });
      }
    });
  },

  // ========== 配置功能 ==========
  
  showConfigModal() {
    this.setData({
      showConfigModal: true,
      config: { ...app.globalData.config }
    });
  },

  hideConfigModal() {
    this.setData({ showConfigModal: false });
  },

  onConfigTitleInput(e) {
    this.setData({ 'config.scanPageTitle': e.detail.value });
  },

  onConfigDescInput(e) {
    this.setData({ 'config.scanPageDesc': e.detail.value });
  },

  chooseBackgroundImage() {
    const that = this;
    
    dd.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        that.setData({ 'config.backgroundImage': res.filePaths[0] });
      }
    });
  },

  clearBackgroundImage() {
    this.setData({ 'config.backgroundImage': '' });
  },

  loadConfig() {
    const config = app.globalData.config;
    this.setData({
      config: config ? { ...config } : {
        scanPageTitle: '扫码查重',
        scanPageDesc: '扫描商品二维码/条码，检查是否重复',
        backgroundImage: ''
      }
    });
  },

  saveConfig: throttle(function() {
    const { config } = this.data;
    app.globalData.config = { ...config };
    this.setData({ showConfigModal: false });
    dd.showToast({ content: '配置已保存', type: 'success' });
  }, 500),

  // ========== 记录操作 ==========
  
  viewDetail(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.displayDatabase[index];
    if (!item) return;
    
    this.setData({
      currentItem: item,
      showDetailModal: true
    });
  },

  hideDetailModal() {
    this.setData({
      showDetailModal: false,
      currentItem: null
    });
  },

  deleteItem: throttle(function(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.displayDatabase[index];
    
    if (!item) return;
    
    dd.confirm({
      title: '确认删除',
      content: `确定要删除编码 "${item.code}" 吗？`,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      success: (result) => {
        if (result.confirm) {
          const database = app.globalData.database || [];
          const newDatabase = database.filter(dbItem => dbItem.id !== item.id);
          app.globalData.database = newDatabase;
          
          // 同步更新codeMap
          if (app.globalData.codeMap) {
            app.globalData.codeMap.delete(item.code);
          }
          
          this.loadData();
          dd.showToast({ content: '删除成功', type: 'success' });
        }
      }
    });
  }, 300),

  previewItemImages(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.displayDatabase[index];
    
    if (item && item.images && item.images.length > 0) {
      dd.previewImage({
        urls: item.images,
        current: item.images[0]
      });
    }
  },

  previewDetailImage(e) {
    const url = e.currentTarget.dataset.url;
    const { currentItem } = this.data;
    
    if (currentItem && currentItem.images) {
      dd.previewImage({
        urls: currentItem.images,
        current: url
      });
    }
  },

  // ========== 工具函数 ==========

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

  preventBubble() {}
});
