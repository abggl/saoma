-- 扫码查重系统 - Supabase 数据库表结构
-- 请在 Supabase SQL Editor 中执行此脚本

-- 1. 创建 records 表（扫码记录）
CREATE TABLE IF NOT EXISTS records (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  remark TEXT DEFAULT '',
  images JSONB,
  submitter_id TEXT DEFAULT 'unknown',
  submitter_name TEXT DEFAULT '未知用户',
  submit_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  has_images BOOLEAN DEFAULT FALSE,
  import_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建 config 表（系统配置）
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_records_code ON records(code);
CREATE INDEX IF NOT EXISTS idx_records_submitter_id ON records(submitter_id);
CREATE INDEX IF NOT EXISTS idx_records_submit_time ON records(submit_time DESC);
CREATE INDEX IF NOT EXISTS idx_records_import_source ON records(import_source);

-- 4. 插入默认配置
INSERT INTO config (key, value) VALUES 
  ('scanPageTitle', '扫码查重'),
  ('scanPageDesc', '扫描商品二维码/条码，检查是否重复'),
  ('databasePageTitle', '数据库管理'),
  ('databasePageDesc', '查看和管理已提交的记录')
ON CONFLICT (key) DO NOTHING;

-- 5. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. 为 records 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_records_updated_at ON records;
CREATE TRIGGER update_records_updated_at
    BEFORE UPDATE ON records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 为 config 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_config_updated_at ON config;
CREATE TRIGGER update_config_updated_at
    BEFORE UPDATE ON config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. 设置 RLS (Row Level Security) - 可选，根据需要开启
-- ALTER TABLE records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- 9. 创建允许所有操作的策略（如果开启了 RLS）
-- CREATE POLICY "Allow all operations" ON records FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all operations" ON config FOR ALL USING (true) WITH CHECK (true);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '数据库表创建完成！';
  RAISE NOTICE '- records 表：存储扫码记录';
  RAISE NOTICE '- config 表：存储系统配置';
  RAISE NOTICE '- 已创建索引和触发器';
END $$;
