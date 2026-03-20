module.exports = async (ctx) => {
  let records, userId, userName;
  
  if (ctx.args) {
    if (typeof ctx.args === 'string') {
      try {
        const parsed = JSON.parse(ctx.args);
        records = parsed.records;
        userId = parsed.userId;
        userName = parsed.userName;
      } catch (e) {
        return {
          success: false,
          errorMessage: '参数解析失败'
        };
      }
    } else if (ctx.args.body) {
      if (typeof ctx.args.body === 'string') {
        try {
          const parsed = JSON.parse(ctx.args.body);
          records = parsed.records;
          userId = parsed.userId;
          userName = parsed.userName;
        } catch (e) {
          return {
            success: false,
            errorMessage: '参数解析失败'
          };
        }
      } else {
        records = ctx.args.body.records;
        userId = ctx.args.body.userId;
        userName = ctx.args.body.userName;
      }
    } else {
      records = ctx.args.records;
      userId = ctx.args.userId;
      userName = ctx.args.userName;
    }
  }

  console.log('importRecords云函数接收参数:', { recordsCount: records?.length, userId, userName });

  if (!records || !Array.isArray(records) || records.length === 0) {
    return {
      success: false,
      errorMessage: '导入数据不能为空'
    };
  }

  if (!userId) {
    return {
      success: false,
      errorMessage: '用户ID不能为空'
    };
  }

  try {
    const db = ctx.mpserverless.db;
    const recordsCollection = db.collection('records');

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const item = records[i];
      
      try {
        const code = (item.code || item['编码'] || '').toString().trim();
        
        if (!code) {
          failCount++;
          errors.push(`第${i + 1}行: 编码为空`);
          continue;
        }

        const existingRecord = await recordsCollection.findOne({ code: code });
        
        if (existingRecord) {
          skipCount++;
          continue;
        }

        const remark = (item.remark || item['备注'] || '').toString().trim();
        const images = item.images || [];
        
        const record = {
          code: code,
          remark: remark,
          images: Array.isArray(images) ? images : [],
          submitter: {
            userId: userId,
            name: userName || '导入用户'
          },
          submitTime: new Date().toISOString(),
          hasImages: Array.isArray(images) && images.length > 0,
          importSource: 'excel'
        };

        await recordsCollection.insertOne(record);
        successCount++;

      } catch (itemError) {
        failCount++;
        errors.push(`第${i + 1}行: ${itemError.message}`);
      }
    }

    console.log('导入完成:', { successCount, skipCount, failCount });

    return {
      success: true,
      data: {
        total: records.length,
        success: successCount,
        skip: skipCount,
        fail: failCount,
        errors: errors.slice(0, 10)
      }
    };

  } catch (error) {
    console.error('importRecords云函数执行失败:', error);
    return {
      success: false,
      errorMessage: `导入失败: ${error.message}`
    };
  }
};
