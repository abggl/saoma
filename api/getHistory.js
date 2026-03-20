const { success, error, setCorsHeaders, handleOptions, parseBody } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    let userId, page, pageSize, searchKeyword, sortOrder;
    
    if (req.method === 'POST') {
      const body = parseBody(req);
      userId = body.userId;
      page = parseInt(body.page) || 1;
      pageSize = parseInt(body.pageSize) || 20;
      searchKeyword = body.searchKeyword || '';
      sortOrder = body.sortOrder || 'time_desc';
    } else {
      const query = req.query || {};
      userId = query.userId;
      page = parseInt(query.page) || 1;
      pageSize = parseInt(query.pageSize) || 20;
      searchKeyword = query.searchKeyword || '';
      sortOrder = query.sortOrder || 'time_desc';
    }
    
    let query = supabase.from('records').select('*', { count: 'exact' });
    
    if (userId) {
      query = query.eq('submitter_id', userId);
    }
    
    if (searchKeyword && searchKeyword.trim()) {
      const keyword = `%${searchKeyword.trim()}%`;
      query = query.or(`code.ilike.${keyword},remark.ilike.${keyword}`);
    }
    
    let orderColumn = 'submit_time';
    let ascending = false;
    
    switch (sortOrder) {
      case 'time_asc':
        ascending = true;
        break;
      case 'code_asc':
        orderColumn = 'code';
        ascending = true;
        break;
      case 'code_desc':
        orderColumn = 'code';
        break;
    }
    
    query = query.order(orderColumn, { ascending });
    
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);
    
    const { data: records, count, error: dbError } = await query;
    
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
    
    res.status(200).json(success({
      list: list,
      total: count || 0,
      page: page,
      pageSize: pageSize,
      hasMore: offset + list.length < (count || 0)
    }));
    
  } catch (err) {
    res.status(200).json(error('获取历史记录失败: ' + err.message));
  }
};
