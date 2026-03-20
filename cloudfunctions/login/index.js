const DING_CONFIG = {
  appKey: 'ding6idrow17ezdmn5pi',
  appSecret: 'GF4G2fFL1dP3y4Q-2nsZ07O5-K2lrkpAPVZYR5uC2TSgXvwCzRZS6vXgAkHTpTAF'
};

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON解析失败: ' + e.message));
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON解析失败: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = async (ctx) => {
  let authCode;
  
  if (ctx.args) {
    if (typeof ctx.args === 'string') {
      try {
        const parsed = JSON.parse(ctx.args);
        authCode = parsed.authCode;
      } catch (e) {
        authCode = ctx.args;
      }
    } else if (ctx.args.body) {
      if (typeof ctx.args.body === 'string') {
        try {
          const parsed = JSON.parse(ctx.args.body);
          authCode = parsed.authCode;
        } catch (e) {
          authCode = ctx.args.body;
        }
      } else {
        authCode = ctx.args.body.authCode;
      }
    } else {
      authCode = ctx.args.authCode;
    }
  }
  
  if (!authCode) {
    return {
      success: false,
      errorMessage: '缺少authCode参数'
    };
  }

  try {
    const appKey = DING_CONFIG.appKey;
    const appSecret = DING_CONFIG.appSecret;

    const tokenUrl = `https://oapi.dingtalk.com/gettoken?appkey=${appKey}&appsecret=${appSecret}`;
    const tokenData = await httpsGet(tokenUrl);

    if (tokenData.errcode !== 0) {
      return {
        success: false,
        errorMessage: `获取access_token失败: ${tokenData.errmsg}`
      };
    }

    const accessToken = tokenData.access_token;

    const userUrl = `https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${accessToken}`;
    const userData = await httpsPost(userUrl, JSON.stringify({ code: authCode }));

    if (userData.errcode !== 0) {
      return {
        success: false,
        errorMessage: `获取用户信息失败: ${userData.errmsg}`
      };
    }

    const userId = userData.result.userid;
    const unionId = userData.result.unionid;

    if (!userId) {
      return {
        success: false,
        errorMessage: '无法获取用户ID'
      };
    }

    const detailUrl = `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`;
    const detailData = await httpsPost(detailUrl, JSON.stringify({ userid: userId }));

    let userName = '未知用户';
    let avatar = '';
    let department = [];

    if (detailData.errcode === 0 && detailData.result) {
      userName = detailData.result.name || '未知用户';
      avatar = detailData.result.avatar || '';
      department = detailData.result.dept_id_list || [];
    }

    const db = ctx.mpserverless.db;
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ userId: userId });

    if (existingUser) {
      await usersCollection.updateOne(
        { userId: userId },
        {
          $set: {
            lastLoginTime: new Date().toISOString(),
            name: userName,
            avatar: avatar
          }
        }
      );
    } else {
      const newUser = {
        userId: userId,
        unionId: unionId || '',
        name: userName,
        avatar: avatar,
        department: department,
        createTime: new Date().toISOString(),
        lastLoginTime: new Date().toISOString()
      };
      
      await usersCollection.insertOne(newUser);
    }

    const returnData = {
      userId: userId,
      name: userName,
      avatar: avatar,
      department: department
    };

    console.log('login云函数返回数据:', JSON.stringify(returnData));

    return {
      success: true,
      data: returnData
    };

  } catch (error) {
    console.error('login云函数执行失败:', error);
    return {
      success: false,
      errorMessage: `登录失败: ${error.message}`
    };
  }
};
