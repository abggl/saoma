/**
 * 扫码查重系统 - 后端服务器 (SQLite版本)
 * 
 * 功能：
 * 1. 用户登录
 * 2. 编码查重
 * 3. 提交记录
 * 4. 查询历史记录
 * 5. 导入/导出数据
 * 
 * 数据存储：SQLite 数据库（数据永久保存）
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 钉钉配置
const DING_CONFIG = {
  appKey: 'ding6idrow17ezdmn5pi',
  appSecret: 'GF4G2fFL1dP3y4Q-2nsZ07O5-K2lrkpAPVZYR5uC2TSgXvwCzRZS6vXgAkHTpTAF'
};

// 缓存 access_token
let accessTokenCache = {
  token: null,
  expireTime: 0
};

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 数据库文件路径
const dbPath = path.join(__dirname, 'data.db');
let db = null;

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // 尝试加载现有数据库
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('已加载现有数据库:', dbPath);
  } else {
    db = new SQL.Database();
    console.log('创建新数据库:', dbPath);
  }
  
  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      remark TEXT,
      images TEXT,
      submitter_id TEXT,
      submitter_name TEXT,
      submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      has_images INTEGER DEFAULT 0,
      import_source TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  
  // 初始化默认配置
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('scanPageTitle', '扫码查重')`);
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('scanPageDesc', '扫描商品二维码/条码，检查是否重复')`);
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('databasePageTitle', '数据库管理')`);
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('databasePageDesc', '查看和管理已提交的记录')`);
  
  saveDatabase();
}

// 保存数据库到文件
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 辅助函数：查询所有记录
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

// 辅助函数：查询单条记录
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// 辅助函数：执行SQL
function runSql(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return { changes: db.getRowsModified(), lastInsertRowid: getLastInsertRowId() };
}

// 获取最后插入的ID
function getLastInsertRowId() {
  const result = queryOne('SELECT last_insert_rowid() as id');
  return result ? result.id : 0;
}

// 格式化本地时间（北京时间）
function formatLocalTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// ==================== 钉钉 API ====================

const https = require('https');

// HTTP 请求封装
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, postData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 获取 access_token
async function getAccessToken() {
  // 检查缓存是否有效
  if (accessTokenCache.token && Date.now() < accessTokenCache.expireTime) {
    return accessTokenCache.token;
  }
  
  const url = `https://oapi.dingtalk.com/gettoken?appkey=${DING_CONFIG.appKey}&appsecret=${DING_CONFIG.appSecret}`;
  const result = await httpsGet(url);
  
  if (result.errcode !== 0) {
    throw new Error('获取access_token失败: ' + result.errmsg);
  }
  
  // 缓存 token，提前5分钟过期
  accessTokenCache.token = result.access_token;
  accessTokenCache.expireTime = Date.now() + (result.expires_in - 300) * 1000;
  
  console.log('获取access_token成功');
  return result.access_token;
}

// 通过 authCode 获取用户信息
async function getUserInfoByAuthCode(authCode) {
  const accessToken = await getAccessToken();
  
  // 获取用户 userid
  const url = `https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${accessToken}`;
  const result = await httpsPost(url, JSON.stringify({ code: authCode }));
  
  if (result.errcode !== 0) {
    throw new Error('获取用户ID失败: ' + result.errmsg);
  }
  
  const userId = result.result.userid;
  
  // 获取用户详细信息
  const userDetailUrl = `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`;
  const userDetail = await httpsPost(userDetailUrl, JSON.stringify({ userid: userId }));
  
  if (userDetail.errcode !== 0) {
    // 如果获取详细信息失败，返回基本信息
    return {
      userId: userId,
      name: userId
    };
  }
  
  return {
    userId: userId,
    name: userDetail.result.name || userId,
    avatar: userDetail.result.avatar || '',
    mobile: userDetail.result.mobile || ''
  };
}

// ==================== API 接口 ====================

/**
 * 健康检查
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '扫码查重系统后端服务运行正常',
    version: '1.0.0',
    database: 'SQLite'
  });
});

/**
 * 用户登录
 */
app.post('/api/login', async (req, res) => {
  try {
    const { authCode } = req.body;
    console.log('登录请求，authCode:', authCode);
    
    if (!authCode) {
      res.json({
        success: false,
        errorMessage: 'authCode不能为空'
      });
      return;
    }
    
    // 尝试获取钉钉真实用户信息
    let userInfo;
    try {
      userInfo = await getUserInfoByAuthCode(authCode);
      console.log('获取钉钉用户信息成功:', userInfo);
    } catch (dingError) {
      console.error('获取钉钉用户信息失败，使用模拟数据:', dingError.message);
      // 如果获取钉钉用户信息失败，使用模拟数据
      userInfo = {
        userId: 'user_' + Date.now(),
        name: '用户' + Math.floor(Math.random() * 10000)
      };
    }
    
    res.json({
      success: true,
      data: userInfo
    });
    
  } catch (error) {
    console.error('登录失败:', error);
    res.json({
      success: false,
      errorMessage: '登录失败: ' + error.message
    });
  }
});

/**
 * 检查编码是否存在
 */
app.post('/api/checkCode', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('查重请求，code:', code);
    
    if (!code || code.trim() === '') {
      res.json({
        success: true,
        data: { exists: false, code: code }
      });
      return;
    }
    
    const trimmedCode = code.trim();
    const record = queryOne('SELECT * FROM records WHERE code = ?', [trimmedCode]);
    
    res.json({
      success: true,
      data: {
        exists: !!record,
        code: trimmedCode,
        record: record ? {
          submitTime: record.submit_time,
          submitter: {
            userId: record.submitter_id,
            name: record.submitter_name
          }
        } : null
      }
    });
    
  } catch (error) {
    console.error('查重失败:', error);
    res.json({
      success: false,
      errorMessage: '查重失败: ' + error.message
    });
  }
});

/**
 * 提交记录
 */
app.post('/api/submit', async (req, res) => {
  try {
    const { code, remark, images, submitterId, submitterName } = req.body;
    console.log('提交请求，code:', code);
    
    if (!code || code.trim() === '') {
      res.json({
        success: false,
        errorMessage: '编码不能为空'
      });
      return;
    }
    
    const trimmedCode = code.trim();
    
    const existing = queryOne('SELECT id FROM records WHERE code = ?', [trimmedCode]);
    if (existing) {
      res.json({
        success: false,
        errorCode: 'DUPLICATE_CODE',
        errorMessage: '该编码已存在'
      });
      return;
    }
    
    const imagesStr = images && images.length > 0 ? JSON.stringify(images) : '';
    const hasImages = images && images.length > 0 ? 1 : 0;
    const submitTime = formatLocalTime(new Date());
    
    const result = runSql(`
      INSERT INTO records (code, remark, images, submitter_id, submitter_name, has_images, submit_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [trimmedCode, remark || '', imagesStr, submitterId || 'unknown', submitterName || '未知用户', hasImages, submitTime]);
    
    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        code: trimmedCode,
        remark: remark || '',
        images: images || [],
        submitter: {
          userId: submitterId || 'unknown',
          name: submitterName || '未知用户'
        },
        submitTime: submitTime
      }
    });
    
  } catch (error) {
    console.error('提交失败:', error);
    res.json({
      success: false,
      errorMessage: '提交失败: ' + error.message
    });
  }
});

/**
 * 获取历史记录
 */
const handleGetHistory = async (req, res) => {
  try {
    const userId = req.body?.userId || req.query.userId;
    const page = parseInt(req.body?.page || req.query.page) || 1;
    const pageSize = parseInt(req.body?.pageSize || req.query.pageSize) || 20;
    const searchKeyword = req.body?.searchKeyword || req.query.searchKeyword || '';
    const sortOrder = req.body?.sortOrder || req.query.sortOrder || 'time_desc';
    
    console.log('获取历史记录，userId:', userId, 'page:', page);
    
    let whereClause = '1=1';
    let params = [];
    
    if (userId) {
      whereClause += ' AND submitter_id = ?';
      params.push(userId);
    }
    
    if (searchKeyword && searchKeyword.trim()) {
      whereClause += ' AND (code LIKE ? OR remark LIKE ?)';
      const keyword = '%' + searchKeyword.trim() + '%';
      params.push(keyword, keyword);
    }
    
    let orderClause = 'submit_time DESC';
    switch (sortOrder) {
      case 'time_asc':
        orderClause = 'submit_time ASC';
        break;
      case 'code_asc':
        orderClause = 'code ASC';
        break;
      case 'code_desc':
        orderClause = 'code DESC';
        break;
    }
    
    const countSql = `SELECT COUNT(*) as total FROM records WHERE ${whereClause}`;
    const countResult = queryOne(countSql, params);
    const total = countResult ? countResult.total : 0;
    
    const offset = (page - 1) * pageSize;
    const sql = `SELECT * FROM records WHERE ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`;
    const records = queryAll(sql, [...params, pageSize, offset]);
    
    const list = records.map(r => ({
      id: r.id,
      code: r.code,
      remark: r.remark || '',
      images: r.images ? JSON.parse(r.images) : [],
      submitter: {
        userId: r.submitter_id,
        name: r.submitter_name
      },
      submitTime: r.submit_time,
      hasImages: r.has_images === 1
    }));
    
    res.json({
      success: true,
      data: {
        list: list,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: offset + list.length < total
      }
    });
    
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.json({
      success: false,
      errorMessage: '获取历史记录失败: ' + error.message
    });
  }
};

app.get('/api/getHistory', handleGetHistory);
app.post('/api/getHistory', handleGetHistory);

/**
 * 获取配置
 */
const handleGetConfig = async (req, res) => {
  try {
    const key = req.body?.key || req.query.key;
    console.log('获取配置，key:', key);
    
    if (key) {
      const result = queryOne('SELECT value FROM config WHERE key = ?', [key]);
      res.json({
        success: true,
        data: result ? { [key]: result.value } : null
      });
    } else {
      const configs = queryAll('SELECT key, value FROM config');
      const data = {};
      configs.forEach(c => {
        data[c.key] = c.value;
      });
      res.json({
        success: true,
        data: data
      });
    }
    
  } catch (error) {
    console.error('获取配置失败:', error);
    res.json({
      success: false,
      errorMessage: '获取配置失败: ' + error.message
    });
  }
};

app.get('/api/getConfig', handleGetConfig);
app.post('/api/getConfig', handleGetConfig);

/**
 * 更新配置
 */
app.post('/api/updateConfig', async (req, res) => {
  try {
    const { key, value } = req.body;
    console.log('更新配置，key:', key, 'value:', value);
    
    if (!key) {
      res.json({
        success: false,
        errorMessage: '配置键不能为空'
      });
      return;
    }
    
    runSql('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
    
    res.json({
      success: true,
      message: '配置更新成功'
    });
    
  } catch (error) {
    console.error('更新配置失败:', error);
    res.json({
      success: false,
      errorMessage: '更新配置失败: ' + error.message
    });
  }
});

/**
 * 批量导入记录
 */
app.post('/api/importRecords', async (req, res) => {
  try {
    const { records, userId, userName } = req.body;
    console.log('导入记录，数量:', records ? records.length : 0);
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      res.json({
        success: false,
        errorMessage: '导入数据不能为空'
      });
      return;
    }
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const item of records) {
      try {
        const code = (item.code || item['编码'] || '').toString().trim();
        
        if (!code) {
          failCount++;
          continue;
        }
        
        const existing = queryOne('SELECT id FROM records WHERE code = ?', [code]);
        if (existing) {
          skipCount++;
          continue;
        }
        
        const remark = (item.remark || item['备注'] || '').toString().trim();
        const submitTime = formatLocalTime(new Date());
        
        runSql(`
          INSERT INTO records (code, remark, images, submitter_id, submitter_name, has_images, submit_time, import_source)
          VALUES (?, ?, '', ?, ?, 0, ?, 'excel')
        `, [code, remark, userId || 'import', userName || '导入用户', submitTime]);
        
        successCount++;
        
      } catch (e) {
        failCount++;
      }
    }
    
    res.json({
      success: true,
      data: {
        total: records.length,
        success: successCount,
        skip: skipCount,
        fail: failCount
      }
    });
    
  } catch (error) {
    console.error('导入失败:', error);
    res.json({
      success: false,
      errorMessage: '导入失败: ' + error.message
    });
  }
});

/**
 * 删除记录
 */
app.delete('/api/records/:id', async (req, res) => {
  try {
    const recordId = req.params.id;
    console.log('删除记录，id:', recordId);
    
    const existing = queryOne('SELECT id FROM records WHERE id = ?', [recordId]);
    if (!existing) {
      res.json({
        success: false,
        errorMessage: '记录不存在'
      });
      return;
    }
    
    runSql('DELETE FROM records WHERE id = ?', [recordId]);
    
    res.json({
      success: true,
      message: '删除成功'
    });
    
  } catch (error) {
    console.error('删除失败:', error);
    res.json({
      success: false,
      errorMessage: '删除失败: ' + error.message
    });
  }
});

/**
 * 导出所有记录
 */
app.get('/api/exportRecords', async (req, res) => {
  try {
    const userId = req.query.userId;
    console.log('导出记录，userId:', userId);
    
    let sql = 'SELECT * FROM records ORDER BY submit_time DESC';
    let params = [];
    
    if (userId) {
      sql = 'SELECT * FROM records WHERE submitter_id = ? ORDER BY submit_time DESC';
      params = [userId];
    }
    
    const records = queryAll(sql, params);
    
    const list = records.map(r => ({
      id: r.id,
      code: r.code,
      remark: r.remark || '',
      images: r.images ? JSON.parse(r.images) : [],
      submitter: {
        userId: r.submitter_id,
        name: r.submitter_name
      },
      submitTime: r.submit_time,
      hasImages: r.has_images === 1
    }));
    
    res.json({
      success: true,
      data: list
    });
    
  } catch (error) {
    console.error('导出失败:', error);
    res.json({
      success: false,
      errorMessage: '导出失败: ' + error.message
    });
  }
});

// ==================== 启动服务器 ====================

async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('===========================================');
      console.log('  扫码查重系统后端服务已启动');
      console.log('  本地地址: http://localhost:' + PORT);
      console.log('  局域网地址: http://192.168.2.7:' + PORT);
      console.log('  数据库: SQLite (数据永久保存)');
      console.log('  数据文件: ' + dbPath);
      console.log('===========================================');
      console.log('');
      console.log('提示: 按 Ctrl+C 可以停止服务器');
      console.log('');
    });
    
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭数据库...');
  if (db) {
    saveDatabase();
  }
  console.log('服务器已停止');
  process.exit(0);
});

startServer();
