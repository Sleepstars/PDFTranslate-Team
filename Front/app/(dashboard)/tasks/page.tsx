"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/components/user/task-list';
import { TaskCreateDialog } from '@/components/user/task-create-dialog';
import { Plus } from 'lucide-react';

export default function TasksPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="我的任务"
        description="管理您的翻译任务"
        action={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建任务
          </Button>
        }
      />

      <TaskList />

      <TaskCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

