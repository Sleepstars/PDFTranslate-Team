import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div>
          <h1>PDFTranslate 管理后台</h1>
          <p className="auth-subtitle">使用管理员账号登录以管理 BabelDOC 翻译任务。</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
