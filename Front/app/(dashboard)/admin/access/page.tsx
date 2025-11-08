"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { AccessList } from '@/components/admin/access-list';
import { AccessGrantDialog } from '@/components/admin/access-grant-dialog';
import { Plus } from 'lucide-react';

export default function AdminAccessPage() {
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="访问管理"
        description="管理用户对翻译服务的访问权限"
        action={
          <Button onClick={() => setGrantDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            授予访问
          </Button>
        }
      />

      <AccessList />

      <AccessGrantDialog
        open={grantDialogOpen}
        onOpenChange={setGrantDialogOpen}
      />
    </div>
  );
}

