module.exports = async (ctx) => {
  let code;
  
  if (ctx.args) {
    if (typeof ctx.args === 'string') {
      try {
        const parsed = JSON.parse(ctx.args);
        code = parsed.code;
      } catch (e) {
        code = ctx.args;
      }
    } else if (ctx.args.body) {
      if (typeof ctx.args.body === 'string') {
        try {
          const parsed = JSON.parse(ctx.args.body);
          code = parsed.code;
        } catch (e) {
          code = ctx.args.body;
        }
      } else {
        code = ctx.args.body.code;
      }
    } else {
      code = ctx.args.code;
    }
  }

  console.log('checkCode云函数接收参数:', { code });

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return {
      success: true,
      data: {
        exists: false,
        code: code
      }
    };
  }

  try {
    const db = ctx.mpserverless.db;
    const recordsCollection = db.collection('records');

    const trimmedCode = code.trim();
    const existingRecord = await recordsCollection.findOne({ code: trimmedCode });

    console.log('查重结果:', { code: trimmedCode, exists: !!existingRecord });

    return {
      success: true,
      data: {
        exists: !!existingRecord,
        code: trimmedCode,
        record: existingRecord ? {
          submitTime: existingRecord.submitTime,
          submitter: existingRecord.submitter
        } : null
      }
    };

  } catch (error) {
    console.error('checkCode云函数执行失败:', error);
    return {
      success: false,
      errorMessage: `查重失败: ${error.message}`
    };
  }
};
