"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { UserList } from '@/components/admin/user-list';
import { UserCreateDialog } from '@/components/admin/user-create-dialog';
import { Plus } from 'lucide-react';

export default function AdminUsersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="用户管理"
        description="管理系统用户和配额"
        action={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建用户
          </Button>
        }
      />

      <UserList />

      <UserCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

