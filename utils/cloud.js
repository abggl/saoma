const API_CONFIG = {
  baseUrl: 'https://your-project.vercel.app/api'
};

let cloudInitialized = false;

function initCloud() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof dd === 'undefined') {
        reject(new Error('钉钉环境未就绪'));
        return;
      }

      cloudInitialized = true;
      console.log('后端服务初始化成功');
      resolve(true);

    } catch (error) {
      console.error('后端服务初始化异常:', error);
      reject(error);
    }
  });
}

function callApi(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    if (!cloudInitialized) {
      reject(new Error('后端服务未初始化'));
      return;
    }

    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    
    dd.httpRequest({
      url: url,
      method: 'POST',
      data: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json'
      },
      dataType: 'json',
      success: (res) => {
        console.log(`API ${endpoint} 调用成功:`, res.data);
        resolve(res.data);
      },
      fail: (err) => {
        console.error(`API ${endpoint} 调用失败:`, err);
        reject(new Error(err.errorMessage || '调用失败'));
      }
    });
  });
}

async function login(authCode) {
  const res = await callApi('/login', { authCode });
  return res;
}

async function submitRecord(data) {
  const res = await callApi('/submit', data);
  return res;
}

async function getHistory(userId, page = 1, pageSize = 20, searchKeyword = '', sortOrder = 'time_desc') {
  const res = await callApi('/getHistory', { 
    userId, 
    page, 
    pageSize,
    searchKeyword,
    sortOrder
  });
  return res;
}

async function getConfig(key) {
  const res = await callApi('/getConfig', { key });
  return res;
}

async function updateConfig(key, value) {
  const res = await callApi('/updateConfig', { key, value });
  return res;
}

async function checkCode(code) {
  const res = await callApi('/checkCode', { code });
  return res;
}

async function importRecords(records, userId, userName) {
  const res = await callApi('/importRecords', { 
    records, 
    userId, 
    userName 
  });
  return res;
}

async function getUploadToken() {
  return new Promise((resolve, reject) => {
    if (!cloudInitialized) {
      reject(new Error('后端服务未初始化'));
      return;
    }

    dd.httpRequest({
      url: `${API_CONFIG.baseUrl}/getUploadToken`,
      method: 'GET',
      dataType: 'json',
      success: (res) => {
        if (res.data && res.data.success && res.data.data) {
          resolve(res.data.data);
        } else {
          reject(new Error('获取上传凭证失败'));
        }
      },
      fail: (err) => {
        reject(new Error(err.errorMessage || '获取上传凭证失败'));
      }
    });
  });
}

async function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!cloudInitialized) {
      reject(new Error('后端服务未初始化'));
      return;
    }

    dd.uploadFile({
      url: `${API_CONFIG.baseUrl}/uploadFile`,
      filePath: filePath,
      name: 'file',
      success: (res) => {
        console.log('文件上传成功:', res);
        try {
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (data.success && data.data) {
            resolve(data.data);
          } else {
            resolve({ fileID: 'local_' + Date.now(), url: 'local' });
          }
        } catch (e) {
          resolve({ fileID: 'local_' + Date.now(), url: 'local' });
        }
      },
      fail: (err) => {
        console.error('文件上传失败:', err);
        resolve({ fileID: 'local_' + Date.now(), url: 'local' });
      }
    });
  });
}

async function uploadImages(filePaths) {
  if (!filePaths || filePaths.length === 0) {
    return [];
  }
  const uploadPromises = filePaths.map(path => uploadFile(path));
  try {
    const results = await Promise.all(uploadPromises);
    return results.map(r => r.fileID || r.url);
  } catch (error) {
    console.error('批量上传图片失败:', error);
    throw error;
  }
}

const callFunction = callApi;
const CLOUD_CONFIG = API_CONFIG;

export {
  initCloud,
  callFunction,
  login,
  submitRecord,
  getHistory,
  getConfig,
  updateConfig,
  checkCode,
  importRecords,
  uploadFile,
  uploadImages,
  getUploadToken,
  CLOUD_CONFIG
};
