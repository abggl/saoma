const { success, error, setCorsHeaders, handleOptions, parseBody } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const { code } = parseBody(req);
    
    if (!code || code.trim() === '') {
      return res.status(200).json(success({ exists: false, code: code }));
    }
    
    const trimmedCode = code.trim();
    
    const { data: record, error: dbError } = await supabase
      .from('records')
      .select('*')
      .eq('code', trimmedCode)
      .single();
    
    if (dbError && dbError.code !== 'PGRST116') {
      throw dbError;
    }
    
    res.status(200).json(success({
      exists: !!record,
      code: trimmedCode,
      record: record ? {
        submitTime: record.submit_time,
        submitter: {
          userId: record.submitter_id,
          name: record.submitter_name
        }
      } : null
    }));
    
  } catch (err) {
    res.status(200).json(error('查重失败: ' + err.message));
  }
};
