const { success, error, setCorsHeaders, handleOptions } = require('../lib/utils');
const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method !== 'DELETE') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const recordId = req.query?.id;
    
    if (!recordId) {
      return res.status(200).json(error('记录ID不能为空'));
    }
    
    const { data: existing, error: checkError } = await supabase
      .from('records')
      .select('id')
      .eq('id', recordId)
      .single();
    
    if (!existing) {
      return res.status(200).json(error('记录不存在'));
    }
    
    const { error: deleteError } = await supabase
      .from('records')
      .delete()
      .eq('id', recordId);
    
    if (deleteError) {
      throw deleteError;
    }
    
    res.status(200).json(success({ message: '删除成功' }));
    
  } catch (err) {
    res.status(200).json(error('删除失败: ' + err.message));
  }
};
