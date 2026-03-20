module.exports = async (ctx) => {
  let userId, page = 1, pageSize = 20, searchKeyword = '', sortOrder = 'time_desc';
  
  if (ctx.args && ctx.args.body) {
    try {
      const body = typeof ctx.args.body === 'string' ? JSON.parse(ctx.args.body) : ctx.args.body;
      userId = body.userId;
      page = body.page || 1;
      pageSize = body.pageSize || 20;
      searchKeyword = body.searchKeyword || '';
      sortOrder = body.sortOrder || 'time_desc';
    } catch (e) {
      userId = ctx.args.userId;
      page = ctx.args.page || 1;
      pageSize = ctx.args.pageSize || 20;
      searchKeyword = ctx.args.searchKeyword || '';
      sortOrder = ctx.args.sortOrder || 'time_desc';
    }
  } else if (ctx.args) {
    userId = ctx.args.userId;
    page = ctx.args.page || 1;
    pageSize = ctx.args.pageSize || 20;
    searchKeyword = ctx.args.searchKeyword || '';
    sortOrder = ctx.args.sortOrder || 'time_desc';
  }

  console.log('getHistory云函数接收参数:', { userId, page, pageSize, searchKeyword, sortOrder });

  if (!userId) {
    return {
      success: false,
      errorMessage: '用户ID不能为空'
    };
  }

  try {
    const db = ctx.mpserverless.db;
    const recordsCollection = db.collection('records');

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    let query = { 'submitter.userId': userId };
    
    if (searchKeyword && searchKeyword.trim()) {
      const keyword = searchKeyword.trim();
      query = {
        'submitter.userId': userId,
        $or: [
          { code: { $regex: keyword, $options: 'i' } },
          { remark: { $regex: keyword, $options: 'i' } }
        ]
      };
    }

    const countResult = await recordsCollection.count(query);
    const total = countResult || 0;

    let sortOption = { submitTime: -1 };
    switch (sortOrder) {
      case 'time_desc':
        sortOption = { submitTime: -1 };
        break;
      case 'time_asc':
        sortOption = { submitTime: 1 };
        break;
      case 'code_asc':
        sortOption = { code: 1 };
        break;
      case 'code_desc':
        sortOption = { code: -1 };
        break;
      default:
        sortOption = { submitTime: -1 };
    }

    const records = await recordsCollection
      .find(query, {
        sort: sortOption,
        skip: skip,
        limit: limit
      });

    console.log('查询结果:', { total, recordsCount: records?.length });

    return {
      success: true,
      data: {
        list: records || [],
        total: total,
        page: parseInt(page),
        pageSize: limit,
        hasMore: skip + (records ? records.length : 0) < total,
        searchKeyword: searchKeyword,
        sortOrder: sortOrder
      }
    };

  } catch (error) {
    console.error('getHistory云函数执行失败:', error);
    return {
      success: false,
      errorMessage: `查询失败: ${error.message}`
    };
  }
};
