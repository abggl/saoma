module.exports = async (ctx) => {
  let key, value;
  
  if (ctx.args) {
    if (typeof ctx.args === 'string') {
      try {
        const parsed = JSON.parse(ctx.args);
        key = parsed.key;
        value = parsed.value;
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
          key = parsed.key;
          value = parsed.value;
        } catch (e) {
          return {
            success: false,
            errorMessage: '参数解析失败'
          };
        }
      } else {
        key = ctx.args.body.key;
        value = ctx.args.body.value;
      }
    } else {
      key = ctx.args.key;
      value = ctx.args.value;
    }
  }

  if (!key) {
    return {
      success: false,
      errorMessage: '配置键不能为空'
    };
  }

  try {
    const db = ctx.mpserverless.db;
    const configCollection = db.collection('config');

    const existingConfig = await configCollection.findOne({ key: key });

    if (existingConfig) {
      await configCollection.updateOne(
        { key: key },
        { $set: { value: value, updateTime: new Date().toISOString() } }
      );
    } else {
      await configCollection.insertOne({
        key: key,
        value: value,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
      });
    }

    return {
      success: true,
      data: { key: key, value: value }
    };
  } catch (error) {
    console.error('updateConfig云函数执行失败:', error);
    return {
      success: false,
      errorMessage: `更新配置失败: ${error.message}`
    };
  }
};
