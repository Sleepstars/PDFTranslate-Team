import { redirect } from 'next/navigation';

export default function AdminSettingsPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/admin/settings/s3`);
}
