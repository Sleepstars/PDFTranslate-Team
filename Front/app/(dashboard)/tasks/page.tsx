import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { CreateTaskForm } from "@/components/dashboard/create-task-form";
import { TaskList } from "@/components/dashboard/task-list";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">我的任务</h2>
        <p className="text-muted-foreground mt-1">
          创建和管理翻译任务
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CreateTaskForm />
        </div>
        <div className="lg:col-span-2">
          <TaskList />
        </div>
      </div>
    </div>
  );
}

