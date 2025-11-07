'use client';

import { useState, useEffect } from 'react';

const defaultSettings = {
  s3_endpoint: '',
  s3_access_key: '',
  s3_secret_key: '',
  s3_bucket: 'pdftranslate',
  s3_region: 'us-east-1',
  s3_file_ttl_days: '7',
  admin_name: 'PDF Admin'
};

export function SettingsPanel() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/settings`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setSettings({ ...defaultSettings, ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setMessage('保存成功');
      } else {
        setMessage('保存失败');
      }
    } catch {
      setMessage('保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>加载中...</p>;

  return (
    <section className="task-board">
      <article className="panel">
        <header>
          <div>
            <p className="panel-label">系统配置</p>
            <h2>环境变量设置</h2>
          </div>
        </header>
        <form className="task-form" onSubmit={handleSave}>
          <h3 style={{ marginTop: 0 }}>S3 存储配置</h3>
          <label>
            <span>S3 Endpoint</span>
            <input
              value={settings.s3_endpoint}
              onChange={e => setSettings({ ...settings, s3_endpoint: e.target.value })}
              placeholder="http://localhost:9000"
            />
          </label>
          <label>
            <span>Access Key</span>
            <input
              value={settings.s3_access_key}
              onChange={e => setSettings({ ...settings, s3_access_key: e.target.value })}
            />
          </label>
          <label>
            <span>Secret Key</span>
            <input
              type="password"
              value={settings.s3_secret_key}
              onChange={e => setSettings({ ...settings, s3_secret_key: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              <span>Bucket</span>
              <input
                value={settings.s3_bucket}
                onChange={e => setSettings({ ...settings, s3_bucket: e.target.value })}
              />
            </label>
            <label>
              <span>Region</span>
              <input
                value={settings.s3_region}
                onChange={e => setSettings({ ...settings, s3_region: e.target.value })}
              />
            </label>
          </div>
          <label>
            <span>文件保留天数</span>
            <input
              type="number"
              value={settings.s3_file_ttl_days}
              onChange={e => setSettings({ ...settings, s3_file_ttl_days: e.target.value })}
            />
          </label>

          <h3>管理员配置</h3>
          <label>
            <span>管理员名称</span>
            <input
              value={settings.admin_name}
              onChange={e => setSettings({ ...settings, admin_name: e.target.value })}
            />
          </label>

          {message && <p className={message.includes('成功') ? 'form-success' : 'form-error'}>{message}</p>}
          <button type="submit" disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </form>
      </article>
    </section>
  );
}
