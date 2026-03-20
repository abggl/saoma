const https = require('https');

const DING_CONFIG = {
  appKey: process.env.DING_APP_KEY || 'ding6idrow17ezdmn5pi',
  appSecret: process.env.DING_APP_SECRET || 'GF4G2fFL1dP3y4Q-2nsZ07O5-K2lrkpAPVZYR5uC2TSgXvwCzRZS6vXgAkHTpTAF'
};

let accessTokenCache = {
  token: null,
  expireTime: 0
};

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

async function getAccessToken() {
  if (accessTokenCache.token && Date.now() < accessTokenCache.expireTime) {
    return accessTokenCache.token;
  }
  
  const url = `https://oapi.dingtalk.com/gettoken?appkey=${DING_CONFIG.appKey}&appsecret=${DING_CONFIG.appSecret}`;
  const result = await httpsGet(url);
  
  if (result.errcode !== 0) {
    throw new Error('获取access_token失败: ' + result.errmsg);
  }
  
  accessTokenCache.token = result.access_token;
  accessTokenCache.expireTime = Date.now() + (result.expires_in - 300) * 1000;
  
  return result.access_token;
}

async function getUserInfoByAuthCode(authCode) {
  const accessToken = await getAccessToken();
  
  const url = `https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${accessToken}`;
  const result = await httpsPost(url, JSON.stringify({ code: authCode }));
  
  if (result.errcode !== 0) {
    throw new Error('获取用户ID失败: ' + result.errmsg);
  }
  
  const userId = result.result.userid;
  
  const userDetailUrl = `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`;
  const userDetail = await httpsPost(userDetailUrl, JSON.stringify({ userid: userId }));
  
  if (userDetail.errcode !== 0) {
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

module.exports = {
  getAccessToken,
  getUserInfoByAuthCode
};
