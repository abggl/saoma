const { success, setCorsHeaders, handleOptions } = require('../lib/utils');

module.exports = (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  res.status(200).json(success({
    message: '扫码查重系统后端服务运行正常',
    version: '2.0.0',
    database: 'Supabase (PostgreSQL)',
    storage: 'Qiniu Cloud',
    platform: 'Vercel Serverless'
  }));
};
