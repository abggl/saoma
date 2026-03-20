const { success, error, setCorsHeaders, handleOptions, parseBody } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const { key, value } = parseBody(req);
    
    if (!key) {
      return res.status(200).json(error('配置键不能为空'));
    }
    
    const { error: dbError } = await supabase
      .from('config')
      .upsert({ key, value }, { onConflict: 'key' });
    
    if (dbError) {
      throw dbError;
    }
    
    res.status(200).json(success({ message: '配置更新成功' }));
    
  } catch (err) {
    res.status(200).json(error('更新配置失败: ' + err.message));
  }
};
