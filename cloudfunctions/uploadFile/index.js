module.exports = async (ctx) => {
  console.log('uploadFile云函数被调用');
  
  try {
    const mpserverless = ctx.mpserverless;
    
    if (!ctx.files || ctx.files.length === 0) {
      return {
        success: false,
        errorMessage: '没有上传文件'
      };
    }

    const file = ctx.files[0];
    const cloudPath = `images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name || 'image.jpg'}`;
    
    const result = await mpserverless.file.uploadFile({
      cloudPath: cloudPath,
      fileContent: file.data
    });

    console.log('文件上传成功:', result);

    return {
      success: true,
      data: {
        fileID: result.fileId,
        url: result.fileId
      }
    };

  } catch (error) {
    console.error('uploadFile云函数执行失败:', error);
    return {
      success: false,
      errorMessage: `上传失败: ${error.message}`
    };
  }
};
