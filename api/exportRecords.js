const { success, error, setCorsHeaders, handleOptions } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const userId = req.query?.userId;
    
    let query = supabase
      .from('records')
      .select('*')
      .order('submit_time', { ascending: false });
    
    if (userId) {
      query = query.eq('submitter_id', userId);
    }
    
    const { data: records, error: dbError } = await query;
    
    if (dbError) {
      throw dbError;
    }
    
    const list = (records || []).map(r => ({
      id: r.id,
      code: r.code,
      remark: r.remark || '',
      images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : [],
      submitter: {
        userId: r.submitter_id,
        name: r.submitter_name
      },
      submitTime: r.submit_time,
      hasImages: r.has_images === true
    }));
    
    res.status(200).json(success(list));
    
  } catch (err) {
    res.status(200).json(error('导出失败: ' + err.message));
  }
};
