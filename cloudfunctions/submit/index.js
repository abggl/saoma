module.exports = async (ctx) => {
  let code, remark, images, submitterId, submitterName;
  
  if (ctx.args) {
    if (typeof ctx.args === 'string') {
      try {
        const parsed = JSON.parse(ctx.args);
        code = parsed.code;
        remark = parsed.remark;
        images = parsed.images;
        submitterId = parsed.submitterId;
        submitterName = parsed.submitterName;
      } catch (e) {
        code = ctx.args;
      }
    } else if (ctx.args.body) {
      if (typeof ctx.args.body === 'string') {
        try {
          const parsed = JSON.parse(ctx.args.body);
          code = parsed.code;
          remark = parsed.remark;
          images = parsed.images;
          submitterId = parsed.submitterId;
          submitterName = parsed.submitterName;
        } catch (e) {
          console.error('解析body失败:', e);
        }
      } else {
        code = ctx.args.body.code;
        remark = ctx.args.body.remark;
        images = ctx.args.body.images;
        submitterId = ctx.args.body.submitterId;
        submitterName = ctx.args.body.submitterName;
      }
    } else {
      code = ctx.args.code;
      remark = ctx.args.remark;
      images = ctx.args.images;
      submitterId = ctx.args.submitterId;
      submitterName = ctx.args.submitterName;
    }
  }

  console.log('submit云函数接收参数:', { code, remark, images, submitterId, submitterName });

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return {
      success: false,
      errorMessage: '编码不能为空'
    };
  }

  if (!submitterId) {
    return {
      success: false,
      errorMessage: '提交人ID不能为空'
    };
  }

  if (!submitterName) {
    return {
      success: false,
      errorMessage: '提交人名称不能为空'
    };
  }

  try {
    const db = ctx.mpserverless.db;
    const recordsCollection = db.collection('records');

    const trimmedCode = code.trim();
    console.log('查询编码是否存在:', trimmedCode);
    
    const existingRecord = await recordsCollection.findOne({ code: trimmedCode });
    console.log('查询结果:', existingRecord);

    if (existingRecord) {
      console.log('编码已存在:', trimmedCode);
      return {
        success: false,
        errorMessage: '编码已存在，不可重复提交',
        errorCode: 'DUPLICATE_CODE'
      };
    }

    const record = {
      code: trimmedCode,
      remark: (remark || '').trim(),
      images: Array.isArray(images) ? images : [],
      submitter: {
        userId: submitterId,
        name: submitterName
      },
      submitTime: new Date().toISOString(),
      hasImages: Array.isArray(images) && images.length > 0
    };

    console.log('准备插入记录:', record);
    const insertResult = await recordsCollection.insertOne(record);
    console.log('插入结果:', insertResult);

    return {
      success: true,
      data: {
        _id: insertResult.insertedId,
        ...record
      }
    };

  } catch (error) {
    console.error('submit云函数执行失败:', error);
    
    if (error.code === 11000 || (error.message && error.message.includes('duplicate key'))) {
      return {
        success: false,
        errorMessage: '编码已存在，不可重复提交',
        errorCode: 'DUPLICATE_CODE'
      };
    }

    return {
      success: false,
      errorMessage: `提交失败: ${error.message}`
    };
  }
};
