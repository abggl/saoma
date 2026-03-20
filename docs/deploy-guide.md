# 扫码查重系统 - 云部署指南

## 架构说明

```
钉钉小程序 → Vercel Serverless API → Supabase (PostgreSQL)
                    ↓
              七牛云对象存储 (图片)
```

## 第一步：创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并登录
2. 点击 "New Project" 创建新项目
3. 填写项目名称和数据库密码
4. 选择离你最近的区域
5. 等待项目创建完成（约2分钟）

### 获取 Supabase 配置信息

1. 进入项目后，点击左侧 "Settings" → "API"
2. 记录以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`
   - **service_role**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`（点击 "Reveal" 显示）

### 创建数据库表

1. 点击左侧 "SQL Editor"
2. 点击 "New query"
3. 复制 `supabase/schema.sql` 文件内容并粘贴
4. 点击 "Run" 执行

---

## 第二步：创建七牛云存储

1. 访问 [七牛云](https://www.qiniu.com) 并登录
2. 进入 "对象存储" → "新建存储空间"
3. 填写存储空间名称（如：`saom-images`）
4. 选择存储区域（建议选择离用户最近的区域）
5. 访问控制选择 "公开"

### 获取七牛云配置信息

1. 点击右上角头像 → "密钥管理"
2. 记录以下信息：
   - **AccessKey**: `xxxxx`
   - **SecretKey**: `xxxxx`

3. 进入存储空间 → "域名管理"
4. 记录：
   - **Bucket名称**: 存储空间名称
   - **域名**: 分配的CDN域名（如：`xxx.bkt.clouddn.com`）

---

## 第三步：部署到 Vercel

### 方式一：通过 GitHub（推荐）

1. 将代码推送到 GitHub 仓库
2. 访问 [Vercel](https://vercel.com) 并登录
3. 点击 "New Project"
4. 导入 GitHub 仓库
5. 配置环境变量（见下方）
6. 点击 "Deploy"

### 方式二：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase 公开密钥 | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 | `eyJhbGciOiJIUzI1NiIs...` |
| `QINIU_ACCESS_KEY` | 七牛云 AccessKey | `your-access-key` |
| `QINIU_SECRET_KEY` | 七牛云 SecretKey | `your-secret-key` |
| `QINIU_BUCKET` | 七牛云存储空间名 | `saom-images` |
| `QINIU_DOMAIN` | 七牛云域名 | `https://xxx.bkt.clouddn.com` |
| `DING_APP_KEY` | 钉钉 AppKey | `dingxxxxx` |
| `DING_APP_SECRET` | 钉钉 AppSecret | `xxxxx` |

---

## 第四步：更新小程序配置

1. 打开 `utils/cloud.js` 文件
2. 修改 `API_CONFIG.baseUrl` 为你的 Vercel 部署地址：

```javascript
const API_CONFIG = {
  baseUrl: 'https://your-project.vercel.app/api'
};
```

3. 在钉钉开发者工具中重新上传小程序

---

## 第五步：配置钉钉小程序服务器域名

1. 登录 [钉钉开发者后台](https://open-dev.dingtalk.com)
2. 进入小程序设置
3. 在 "服务器域名" 中添加：
   - request 合法域名: `https://your-project.vercel.app`
   - uploadFile 合法域名: `https://your-project.vercel.app`
   - downloadFile 合法域名: `https://your-qiniu-domain.com`（七牛云域名）

---

## 文件结构说明

```
saom/
├── api/                          # Vercel Serverless Functions
│   ├── lib/                      # 公共库
│   │   ├── supabase.js          # Supabase 客户端
│   │   ├── qiniu.js             # 七牛云 SDK 封装
│   │   ├── dingtalk.js          # 钉钉 API 封装
│   │   └── utils.js             # 工具函数
│   ├── index.js                  # 健康检查
│   ├── login.js                  # 用户登录
│   ├── checkCode.js              # 编码查重
│   ├── submit.js                 # 提交记录
│   ├── getHistory.js             # 获取历史
│   ├── getConfig.js              # 获取配置
│   ├── updateConfig.js           # 更新配置
│   ├── importRecords.js          # 批量导入
│   ├── exportRecords.js          # 导出记录
│   ├── uploadFile.js             # 文件上传
│   ├── getUploadToken.js         # 获取上传凭证
│   ├── records/
│   │   └── [id].js              # 删除记录
│   └── package.json
├── supabase/
│   └── schema.sql               # 数据库表结构
├── utils/
│   └── cloud.js                 # 前端 API 封装（已修改）
└── vercel.json                  # Vercel 配置
```

---

## API 接口列表

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api` | GET | 健康检查 |
| `/api/login` | POST | 用户登录 |
| `/api/checkCode` | POST | 编码查重 |
| `/api/submit` | POST | 提交记录 |
| `/api/getHistory` | GET/POST | 获取历史记录 |
| `/api/getConfig` | GET/POST | 获取配置 |
| `/api/updateConfig` | POST | 更新配置 |
| `/api/importRecords` | POST | 批量导入 |
| `/api/exportRecords` | GET | 导出记录 |
| `/api/records/:id` | DELETE | 删除记录 |
| `/api/uploadFile` | POST | 上传文件 |
| `/api/getUploadToken` | GET | 获取上传凭证 |

---

## 常见问题

### 1. API 返回 500 错误
- 检查 Vercel 环境变量是否正确配置
- 查看 Vercel 部署日志

### 2. 数据库连接失败
- 确认 Supabase 项目状态正常
- 检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`

### 3. 文件上传失败
- 确认七牛云存储空间已创建
- 检查 `QINIU_ACCESS_KEY` 和 `QINIU_SECRET_KEY`
- 确认域名配置正确

### 4. 小程序请求失败
- 确认已在钉钉后台配置服务器域名
- 检查 `utils/cloud.js` 中的 `baseUrl` 是否正确

---

## 成本估算

| 服务 | 免费额度 | 超出费用 |
|------|----------|----------|
| Vercel | 100GB带宽/月 | $20/月起 |
| Supabase | 500MB数据库 + 1GB文件 | $25/月起 |
| 七牛云 | 10GB存储 + 10GB流量 | 按量计费 |

对于小型应用，免费额度通常足够使用。
