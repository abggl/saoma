App({
  onLaunch(options) {
    console.log('App Launch', options);
    
    // 初始化时构建codeMap（如果已有数据）
    this.rebuildCodeMap();
  },
  
  onShow() {
    console.log('App Show');
  },
  
  onHide() {
    console.log('App Hide');
  },
  
  /**
   * 构建编码映射表（全局查重优化）
   * 从 O(n) 数组遍历 优化到 O(1) Map查询
   * 
   * 云数据库迁移建议：
   * 1. 在云端创建唯一索引（UNIQUE INDEX）on code字段
   * 2. 使用云函数批量导入，利用数据库原生去重
   * 3. 查询时使用数据库索引，无需全表扫描
   */
  rebuildCodeMap() {
    const database = this.globalData.database || [];
    const codeMap = new Map();
    const idMap = new Map();
    
    // 一次性遍历构建映射表
    database.forEach(item => {
      if (item.code) {
        codeMap.set(item.code, item);
      }
      if (item.id) {
        idMap.set(item.id, item);
      }
    });
    
    this.globalData.codeMap = codeMap;
    this.globalData.idMap = idMap;
    
    console.log(`CodeMap重建完成：共 ${codeMap.size} 条编码`);
    return { codeMap, idMap };
  },
  
  /**
   * 添加单条记录（同步更新codeMap）
   * @param {Object} record - 记录对象
   * @returns {boolean} - 是否添加成功（编码不重复）
   */
  addRecord(record) {
    if (!record || !record.code) {
      return false;
    }
    
    // 使用Map快速查重 O(1)
    if (this.globalData.codeMap && this.globalData.codeMap.has(record.code)) {
      return false; // 编码已存在
    }
    
    // 添加到数据库
    this.globalData.database.unshift(record);
    
    // 同步更新codeMap
    if (!this.globalData.codeMap) {
      this.globalData.codeMap = new Map();
    }
    this.globalData.codeMap.set(record.code, record);
    
    if (!this.globalData.idMap) {
      this.globalData.idMap = new Map();
    }
    this.globalData.idMap.set(record.id, record);
    
    return true;
  },
  
  /**
   * 批量添加记录（导入优化）
   * @param {Array} records - 记录数组
   * @returns {Object} - 导入结果统计
   */
  batchAddRecords(records) {
    const result = {
      total: records.length,
      imported: 0,
      skipped: 0,
      failed: 0
    };
    
    if (!this.globalData.codeMap) {
      this.globalData.codeMap = new Map();
    }
    if (!this.globalData.idMap) {
      this.globalData.idMap = new Map();
    }
    
    const codeMap = this.globalData.codeMap;
    const newRecords = [];
    
    records.forEach(record => {
      if (!record || !record.code) {
        result.failed++;
        return;
      }
      
      if (codeMap.has(record.code)) {
        result.skipped++;
        return;
      }
      
      newRecords.push(record);
      codeMap.set(record.code, record);
      if (record.id) {
        this.globalData.idMap.set(record.id, record);
      }
      result.imported++;
    });
    
    // 批量添加到数据库
    if (newRecords.length > 0) {
      this.globalData.database = [...this.globalData.database, ...newRecords];
    }
    
    return result;
  },
  
  /**
   * 检查编码是否重复
   * @param {string} code - 编码
   * @returns {boolean} - 是否存在
   */
  checkDuplicate(code) {
    if (!code || !this.globalData.codeMap) {
      return false;
    }
    return this.globalData.codeMap.has(code);
  },
  
  /**
   * 删除记录（同步更新codeMap）
   * @param {string} id - 记录ID
   * @returns {boolean} - 是否删除成功
   */
  deleteRecord(id) {
    const record = this.globalData.idMap ? this.globalData.idMap.get(id) : null;
    if (!record) {
      return false;
    }
    
    // 从数据库删除
    const database = this.globalData.database || [];
    this.globalData.database = database.filter(item => item.id !== id);
    
    // 同步更新映射表
    if (this.globalData.codeMap) {
      this.globalData.codeMap.delete(record.code);
    }
    if (this.globalData.idMap) {
      this.globalData.idMap.delete(id);
    }
    
    return true;
  },
  
  globalData: {
    // 数据库 - 存放所有提交的记录
    database: [],
    
    // 编码映射表（用于O(1)查重）
    // 云数据库迁移时，可用数据库唯一索引替代
    codeMap: null,
    
    // ID映射表（用于快速查找）
    idMap: null,
    
    // 个性化配置
    config: {
      scanPageTitle: '扫码查重',
      scanPageDesc: '扫描商品二维码/条码，检查是否重复',
      backgroundImage: ''
    },
    
    // 当前用户信息（后续接入登录）
    userInfo: {
      name: '测试用户',
      userId: 'test001'
    }
  }
});
