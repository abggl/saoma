const { success, error, setCorsHeaders, handleOptions, parseBody, formatLocalTime } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const { records, userId, userName } = parseBody(req);
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(200).json(error('导入数据不能为空'));
    }
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    const existingCodes = new Set();
    const { data: existingRecords } = await supabase
      .from('records')
      .select('code');
    
    (existingRecords || []).forEach(r => existingCodes.add(r.code));
    
    const recordsToInsert = [];
    
    for (const item of records) {
      const code = (item.code || item['编码'] || '').toString().trim();
      
      if (!code) {
        failCount++;
        continue;
      }
      
      if (existingCodes.has(code)) {
        skipCount++;
        continue;
      }
      
      const remark = (item.remark || item['备注'] || '').toString().trim();
      const submitTime = formatLocalTime(new Date());
      
      recordsToInsert.push({
        code,
        remark,
        images: null,
        submitter_id: userId || 'import',
        submitter_name: userName || '导入用户',
        has_images: false,
        submit_time: submitTime,
        import_source: 'excel'
      });
      
      existingCodes.add(code);
      successCount++;
    }
    
    if (recordsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('records')
        .insert(recordsToInsert);
      
      if (insertError) {
        console.error('批量插入失败:', insertError);
      }
    }
    
    res.status(200).json(success({
      total: records.length,
      success: successCount,
      skip: skipCount,
      fail: failCount
    }));
    
  } catch (err) {
    res.status(200).json(error('导入失败: ' + err.message));
  }
};
