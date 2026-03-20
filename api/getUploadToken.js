const { success, error, setCorsHeaders, handleOptions } = require('../lib/utils');
const { getUploadToken, getDomain, getBucket } = require('../lib/qiniu');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const token = getUploadToken();
    const domain = getDomain();
    const bucket = getBucket();
    
    res.status(200).json(success({
      uploadToken: token,
      domain: domain,
      bucket: bucket
    }));
    
  } catch (err) {
    res.status(200).json(error('获取上传凭证失败: ' + err.message));
  }
};
