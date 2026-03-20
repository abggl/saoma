const { success, error, setCorsHeaders, handleOptions, parseBody, formatLocalTime } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const { code, remark, images, submitterId, submitterName } = parseBody(req);
    
    if (!code || code.trim() === '') {
      return res.status(200).json(error('编码不能为空'));
    }
    
    const trimmedCode = code.trim();
    
    const { data: existing, error: checkError } = await supabase
      .from('records')
      .select('id')
      .eq('code', trimmedCode)
      .single();
    
    if (existing) {
      return res.status(200).json(error('该编码已存在', 'DUPLICATE_CODE'));
    }
    
    const submitTime = formatLocalTime(new Date());
    const imagesStr = images && images.length > 0 ? JSON.stringify(images) : null;
    
    const { data: newRecord, error: insertError } = await supabase
      .from('records')
      .insert({
        code: trimmedCode,
        remark: remark || '',
        images: imagesStr,
        submitter_id: submitterId || 'unknown',
        submitter_name: submitterName || '未知用户',
        has_images: images && images.length > 0,
        submit_time: submitTime
      })
      .select()
      .single();
    
    if (insertError) {
      throw insertError;
    }
    
    res.status(200).json(success({
      id: newRecord.id,
      code: trimmedCode,
      remark: remark || '',
      images: images || [],
      submitter: {
        userId: submitterId || 'unknown',
        name: submitterName || '未知用户'
      },
      submitTime: submitTime
    }));
    
  } catch (err) {
    res.status(200).json(error('提交失败: ' + err.message));
  }
};
