"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { ProviderList } from '@/components/admin/provider-list';
import { ProviderCreateDialog } from '@/components/admin/provider-create-dialog';
import { Plus } from 'lucide-react';

export default function AdminProvidersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="服务配置"
        description="管理翻译服务配置"
        action={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建服务
          </Button>
        }
      />

      <ProviderList />

      <ProviderCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

