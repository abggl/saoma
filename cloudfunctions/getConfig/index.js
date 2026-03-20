module.exports = async (ctx) => {
  let key;
  
  if (ctx.args) {
    if (typeof ctx.args === 'string') {
      try {
        const parsed = JSON.parse(ctx.args);
        key = parsed.key;
      } catch (e) {
        key = ctx.args;
      }
    } else if (ctx.args.body) {
      if (typeof ctx.args.body === 'string') {
        try {
          const parsed = JSON.parse(ctx.args.body);
          key = parsed.key;
        } catch (e) {
          key = ctx.args.body;
        }
      } else {
        key = ctx.args.body.key;
      }
    } else {
      key = ctx.args.key;
    }
  }

  console.log('getConfig云函数接收参数:', { key });

  try {
    const db = ctx.mpserverless.db;
    const configCollection = db.collection('config');

    if (key) {
      const config = await configCollection.findOne({ key: key });
      return {
        success: true,
        data: config ? { [key]: config.value } : null
      };
    } else {
      const configs = await configCollection.find({});
      const result = {};
      if (configs && configs.length > 0) {
        configs.forEach(item => {
          result[item.key] = item.value;
        });
      }
      console.log('getConfig返回数据:', result);
      return {
        success: true,
        data: result
      };
    }
  } catch (error) {
    console.error('getConfig云函数执行失败:', error);
    return {
      success: false,
      errorMessage: `获取配置失败: ${error.message}`
    };
  }
};
