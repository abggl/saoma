const { success, error, setCorsHeaders, handleOptions } = require('../lib/utils');
const { uploadBuffer, getUploadToken, getDomain, getBucket } = require('../lib/qiniu');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  if (req.method === 'GET') {
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
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json(error('方法不允许'));
  }
  
  try {
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return res.status(200).json(error('需要 multipart/form-data 格式'));
    }
    
    const chunks = [];
    let totalSize = 0;
    
    for await (const chunk of req) {
      chunks.push(chunk);
      totalSize += chunk.length;
      
      if (totalSize > 10 * 1024 * 1024) {
        return res.status(200).json(error('文件大小不能超过10MB'));
      }
    }
    
    const buffer = Buffer.concat(chunks);
    const boundary = contentType.split('boundary=')[1];
    
    if (!boundary) {
      return res.status(200).json(error('无法解析表单边界'));
    }
    
    const files = parseMultipart(buffer, boundary);
    
    if (files.length === 0) {
      return res.status(200).json(error('未找到上传文件'));
    }
    
    const file = files[0];
    const ext = getFileExtension(file.filename) || 'jpg';
    const key = `images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    const result = await uploadBuffer(file.data, key);
    
    res.status(200).json(success({
      fileID: result.url,
      url: result.url,
      key: result.key
    }));
    
  } catch (err) {
    console.error('文件上传失败:', err);
    res.status(200).json(error('文件上传失败: ' + err.message));
  }
};

function parseMultipart(buffer, boundary) {
  const files = [];
  const boundaryBuffer = Buffer.from('--' + boundary);
  const endBoundary = Buffer.from('--' + boundary + '--');
  
  let start = buffer.indexOf(boundaryBuffer);
  if (start === -1) return files;
  
  start += boundaryBuffer.length + 2;
  
  while (start < buffer.length) {
    const nextBoundary = buffer.indexOf(boundaryBuffer, start);
    if (nextBoundary === -1) break;
    
    const partEnd = nextBoundary - 2;
    const part = buffer.slice(start, partEnd);
    
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.slice(0, headerEnd).toString();
      const data = part.slice(headerEnd + 4);
      
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        files.push({
          filename: filenameMatch[1],
          data: data
        });
      }
    }
    
    start = nextBoundary + boundaryBuffer.length + 2;
    
    if (buffer.indexOf(endBoundary, start - boundaryBuffer.length - 4) !== -1) {
      break;
    }
  }
  
  return files;
}

function getFileExtension(filename) {
  if (!filename) return null;
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : null;
}
