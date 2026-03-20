const { success, error, setCorsHeaders, handleOptions, parseBody } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    let key;
    
    if (req.method === 'POST') {
      const body = parseBody(req);
      key = body.key;
    } else {
      key = req.query?.key;
    }
    
    if (key) {
      const { data: result, error: dbError } = await supabase
        .from('config')
        .select('value')
        .eq('key', key)
        .single();
      
      if (dbError && dbError.code !== 'PGRST116') {
        throw dbError;
      }
      
      res.status(200).json(success(result ? { [key]: result.value } : null));
    } else {
      const { data: configs, error: dbError } = await supabase
        .from('config')
        .select('key, value');
      
      if (dbError) {
        throw dbError;
      }
      
      const data = {};
      (configs || []).forEach(c => {
        data[c.key] = c.value;
      });
      
      res.status(200).json(success(data));
    }
    
  } catch (err) {
    res.status(200).json(error('获取配置失败: ' + err.message));
  }
};
