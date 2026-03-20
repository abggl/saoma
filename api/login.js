const { success, error, setCorsHeaders, handleOptions, parseBody } = require('../lib/utils');
const { getUserInfoByAuthCode } = require('../lib/dingtalk');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const { authCode } = parseBody(req);
    
    if (!authCode) {
      return res.status(200).json(error('authCode不能为空'));
    }
    
    let userInfo;
    try {
      userInfo = await getUserInfoByAuthCode(authCode);
    } catch (dingError) {
      userInfo = {
        userId: 'user_' + Date.now(),
        name: '用户' + Math.floor(Math.random() * 10000)
      };
    }
    
    res.status(200).json(success(userInfo));
    
  } catch (err) {
    res.status(200).json(error('登录失败: ' + err.message));
  }
};
