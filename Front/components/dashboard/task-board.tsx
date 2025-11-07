'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, fetchTasks, mutateTask } from '@/lib/tasks/client';
import type { CreateTaskPayload, SerializedTask } from '@/lib/tasks/types';

const TASKS_QUERY_KEY = ['tasks'];

const defaultForm = {
  documentName: '',
  sourceLang: 'en',
  targetLang: 'zh',
  engine: 'google',
  priority: 'normal' as const,
  notes: '',
  file: null as File | null,
  modelConfig: {
    model: '',
    threads: 4,
    endpoint: ''
  }
};

const engineOptions = [
  { label: 'Google Translate', value: 'google' },
  { label: 'DeepL', value: 'deepl' },
  { label: 'DeepLX', value: 'deeplx' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Azure OpenAI', value: 'azure-openai' },
  { label: 'Tencent', value: 'tencent' }
];

const statusClasses: Record<string, string> = {
  queued: 'status-pill queued',
  processing: 'status-pill processing',
  completed: 'status-pill completed',
  failed: 'status-pill failed',
  canceled: 'status-pill canceled'
};

const statusText: Record<string, string> = {
  queued: '排队中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消'
};

export function TaskBoard({ initialTasks }: { initialTasks: SerializedTask[] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({ ...defaultForm }));
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const tasksQuery = useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: fetchTasks,
    initialData: initialTasks,
    refetchInterval: 4000
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      queryClient.setQueryData<SerializedTask[]>(TASKS_QUERY_KEY, (old = []) => [task, ...old]);
      setForm({ ...defaultForm });
      setFormError(null);
    },
    onError: (error: Error) => {
      setFormError(error.message);
    }
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'retry' | 'cancel' }) =>
      mutateTask(id, action),
    onSuccess: (task) => {
      queryClient.setQueryData<SerializedTask[]>(TASKS_QUERY_KEY, (old = []) => {
        return old.map((item) => (item.id === task.id ? task : item));
      });
    }
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const isLoading = tasksQuery.isInitialLoading;
  const isRefreshing = tasksQuery.isRefetching;

  function handleInputChange(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setForm((prev) => ({ ...prev, file, documentName: prev.documentName || file.name }));
    }
  }

  function handleModelConfigChange(key: string, value: any) {
    setForm((prev) => ({
      ...prev,
      modelConfig: { ...prev.modelConfig, [key]: value }
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!form.file) {
      setFormError('请选择要翻译的 PDF 文件');
      return;
    }

    try {
      const payload: CreateTaskPayload = {
        file: form.file,
        documentName: form.documentName,
        sourceLang: form.sourceLang,
        targetLang: form.targetLang,
        engine: form.engine,
        priority: form.priority,
        notes: form.notes?.trim() || undefined,
        modelConfig: form.modelConfig
      };
      await createMutation.mutateAsync(payload);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '提交失败，请稍后重试');
    }
  }

  function handleAction(id: string, action: 'retry' | 'cancel') {
    actionMutation.mutate({ id, action });
  }

  return (
    <section className="task-board">
      <div className="task-grid">
        <article className="panel">
          <header>
            <div>
              <p className="panel-label">新建翻译</p>
              <h2>发起 BabelDOC 翻译任务</h2>
            </div>
          </header>
          <form className="task-form" onSubmit={handleSubmit}>
            <label>
              <span>上传 PDF 文件</span>
              <input
                type="file"
                accept=".pdf"
                required
                onChange={handleFileChange}
              />
              {form.file && <span style={{ fontSize: '0.875rem', color: '#666' }}>{form.file.name}</span>}
            </label>
            <label>
              <span>文档名称</span>
              <input
                required
                value={form.documentName}
                onChange={(event) => handleInputChange('documentName', event.target.value)}
                placeholder="例如: ACL2024-main.pdf"
              />
            </label>
            <div className="form-row">
              <label>
                <span>源语言</span>
                <input
                  value={form.sourceLang}
                  onChange={(event) => handleInputChange('sourceLang', event.target.value)}
                />
              </label>
              <label>
                <span>目标语言</span>
                <input
                  value={form.targetLang}
                  onChange={(event) => handleInputChange('targetLang', event.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>翻译引擎</span>
                <select
                  value={form.engine}
                  onChange={(event) => handleInputChange('engine', event.target.value)}
                >
                  {engineOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>优先级</span>
                <select
                  value={form.priority}
                  onChange={(event) => handleInputChange('priority', event.target.value)}
                >
                  <option value="normal">正常</option>
                  <option value="high">高</option>
                </select>
              </label>
            </div>
            <label>
              <span>备注（可选）</span>
              <textarea
                rows={3}
                value={form.notes ?? ''}
                onChange={(event) => handleInputChange('notes', event.target.value)}
                placeholder="记录特殊指令、页码或术语偏好"
              />
            </label>
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ background: 'transparent', color: '#0066cc', padding: '0.5rem 0', marginBottom: '0.5rem' }}
              >
                {showAdvanced ? '隐藏' : '显示'}高级配置
              </button>
              {showAdvanced && (
                <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                  <label>
                    <span>API Endpoint（可选）</span>
                    <input
                      value={form.modelConfig.endpoint}
                      onChange={(event) => handleModelConfigChange('endpoint', event.target.value)}
                      placeholder="如: https://api.openai.com/v1"
                    />
                    <small style={{ fontSize: '0.75rem', color: '#666' }}>
                      自定义 API 地址，留空使用默认
                    </small>
                  </label>
                  <label>
                    <span>模型名称（可选）</span>
                    <input
                      value={form.modelConfig.model}
                      onChange={(event) => handleModelConfigChange('model', event.target.value)}
                      placeholder="如: gpt-4, gemma2 等"
                    />
                    <small style={{ fontSize: '0.75rem', color: '#666' }}>
                      仅 OpenAI/Ollama 等需要指定模型
                    </small>
                  </label>
                  <label>
                    <span>并发线程数</span>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={form.modelConfig.threads}
                      onChange={(event) => handleModelConfigChange('threads', parseInt(event.target.value))}
                    />
                    <small style={{ fontSize: '0.75rem', color: '#666' }}>
                      推荐 4-8，过高可能导致 API 限流
                    </small>
                  </label>
                </div>
              )}
            </div>
            {formError ? <p className="form-error">{formError}</p> : null}
            <button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '提交中...' : '创建任务'}
            </button>
          </form>
        </article>

        <article className="panel">
          <header>
            <div>
              <p className="panel-label">任务队列</p>
              <h2>
                当前任务 {tasks.length}
                {isRefreshing ? <span className="loading-dot" /> : null}
              </h2>
            </div>
          </header>
          <div className="task-table-wrapper">
            {isLoading ? (
              <p>加载任务中...</p>
            ) : tasks.length === 0 ? (
              <p>暂无任务，创建第一个翻译吧。</p>
            ) : (
              <table className="task-table">
                <thead>
                  <tr>
                    <th>文档</th>
                    <th>语言对</th>
                    <th>引擎</th>
                    <th>状态</th>
                    <th>进度</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div className="doc-name">
                          <p>{task.documentName}</p>
                          {task.notes ? <span>{task.notes}</span> : null}
                        </div>
                      </td>
                      <td>
                        {task.sourceLang} → {task.targetLang}
                      </td>
                      <td>{task.engine}</td>
                      <td>
                        <span className={statusClasses[task.status]}>{statusText[task.status]}</span>
                      </td>
                      <td>
                        <div className="progress-bar">
                          <div style={{ width: `${task.progress}%` }} />
                        </div>
                        <span className="progress-value">{task.progress}%</span>
                      </td>
                      <td>{formatDate(task.updatedAt)}</td>
                      <td>
                        <div className="row-actions">
                          {task.status === 'failed' ? (
                            <button
                              type="button"
                              disabled={actionMutation.isPending}
                              onClick={() => handleAction(task.id, 'retry')}
                            >
                              重试
                            </button>
                          ) : null}
                          {task.status === 'queued' || task.status === 'processing' ? (
                            <button
                              type="button"
                              disabled={actionMutation.isPending}
                              onClick={() => handleAction(task.id, 'cancel')}
                            >
                              取消
                            </button>
                          ) : null}
                          {task.status === 'completed' && task.outputUrl ? (
                            <a href={task.outputUrl} target="_blank" rel="noreferrer">
                              下载
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(date);
}
