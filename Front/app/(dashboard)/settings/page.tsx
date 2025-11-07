import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { SettingsPanel } from '@/components/dashboard/settings-panel';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  if (user.email !== 'admin@example.com') {
    redirect('/dashboard');
  }

  return <SettingsPanel />;
}
