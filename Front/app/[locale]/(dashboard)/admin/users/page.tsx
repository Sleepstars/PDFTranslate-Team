'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminUsersAPI } from '@/lib/api/admin-users';
import { adminGroupsAPI, type Group } from '@/lib/api/admin-groups';
import { Button } from '@/components/ui/button';
import { Portal } from '@/components/ui/portal';
import { Badge } from '@/components/ui/badge';
import { User } from '@/lib/types/user';
import { useAdminUpdates } from '@/lib/hooks/use-admin-updates';
import { useAuth } from '@/lib/hooks/use-auth';
import { Search, MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SkeletonTable } from '@/components/ui/skeleton';

export default function AdminUsersPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const isRealtimeConnected = useAdminUpdates('users');
  const { user: currentUser } = useAuth();
  const t = useTranslations('users');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminUsersAPI.list,
    refetchOnWindowFocus: !isRealtimeConnected,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: adminGroupsAPI.list,
  });

  const createMutation = useMutation({
    mutationFn: adminUsersAPI.create,
    onSuccess: () => {
      toast.success(t('createSuccess'));
      setShowDialog(false);
      // WebSocket 会自动更新数据，无需手动 invalidate
    },
    onError: () => {
      toast.error(t('createError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminUsersAPI.delete,
    onSuccess: () => {
      toast.success(t('deleteSuccess'));
      setDeleteUser(null);
      // WebSocket 会自动更新数据，无需手动 invalidate
    },
    onError: (error: Error) => {
      // Display specific error message from backend
      const errorMessage = error.message;
      if (errorMessage.includes('Cannot deactivate your own account')) {
        toast.error(t('cannotDeleteSelf'));
      } else if (errorMessage.includes('Cannot deactivate the last active admin')) {
        toast.error(t('cannotDeleteLastAdmin'));
      } else {
        toast.error(t('deleteError'));
      }
      setDeleteUser(null);
    },
  });

  // 使用 useDeferredValue 延迟搜索查询,避免每次输入都触发过滤
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredUsers = useMemo(() =>
    users.filter((user: User) =>
      user.email.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(deferredSearchQuery.toLowerCase())
    ), [users, deferredSearchQuery]);

  // Calculate which users cannot be deleted
  const activeAdminCount = useMemo(() =>
    users.filter((u: User) => u.role === 'admin' && u.isActive).length,
    [users]
  );

  const canDeleteUser = (user: User) => {
    // Cannot delete self
    if (currentUser && user.id === currentUser.id) {
      return { canDelete: false, reason: t('cannotDeleteSelf') };
    }
    // Cannot delete last active admin
    if (user.role === 'admin' && user.isActive && activeAdminCount <= 1) {
      return { canDelete: false, reason: t('cannotDeleteLastAdmin') };
    }
    return { canDelete: true, reason: '' };
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setShowDialog(true)} size="sm" className="h-9">
          + {t('create')}
        </Button>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search')}
            className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="ml-auto text-sm text-muted-foreground">{t('actions')}</div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : (
        <div className="bg-card border border-border rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">{t('email')}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t('status')}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t('role')}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t('used')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user: User) => {
              const usagePercent = user.dailyPageLimit > 0 ? (user.dailyPageUsed / user.dailyPageLimit) * 100 : 0;
              const deleteCheck = canDeleteUser(user);
              return (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-sm">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={user.isActive ? 'success' : 'error'} className="text-xs">
                      {user.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-sm">{user.role === 'admin' ? 'ADMIN' : 'USER'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium min-w-[3rem]">{user.dailyPageUsed.toFixed(1)}</span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={(e) => {
                        const isOpen = activeMenu === user.id;
                        if (isOpen) {
                          setActiveMenu(null);
                          setMenuPos(null);
                          return;
                        }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        // Menu width = w-32 = 128px
                        const menuWidth = 128;
                        const left = Math.min(
                          Math.max(8, rect.right - menuWidth),
                          window.innerWidth - 8 - menuWidth,
                        );
                        const top = Math.min(rect.bottom + 4, window.innerHeight - 8);
                        setMenuPos({ top, left });
                        setActiveMenu(user.id);
                      }}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {activeMenu === user.id && menuPos && (
                      <Portal>
                        <div className="fixed inset-0 z-[60]" onClick={() => { setActiveMenu(null); setMenuPos(null); }} />
                        <div
                          className="fixed z-[61] w-32 bg-popover border border-border rounded-md shadow-lg"
                          style={{ top: menuPos.top, left: menuPos.left }}
                        >
                          <button
                            onClick={() => {
                              setEditUser(user);
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('edit')}
                          </button>
                          <button
                            onClick={() => {
                              if (!deleteCheck.canDelete) {
                                toast.error(deleteCheck.reason);
                                setActiveMenu(null);
                                setMenuPos(null);
                                return;
                              }
                              setDeleteUser(user);
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                              deleteCheck.canDelete
                                ? 'text-destructive hover:bg-muted'
                                : 'text-muted-foreground cursor-not-allowed opacity-50'
                            }`}
                            title={!deleteCheck.canDelete ? deleteCheck.reason : ''}
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </Portal>
                    )}
                  </td>
                </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showDialog && <UserDialog onClose={() => setShowDialog(false)} onCreate={createMutation.mutate} />}
      {editUser && <EditUserDialog user={editUser} groups={groups as Group[]} onClose={() => setEditUser(null)} />}
      {deleteUser && (
        <DeleteConfirmDialog
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={() => deleteMutation.mutate(deleteUser.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function UserDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (data: { email: string; name: string; password: string; role: 'admin' | 'user'; dailyPageLimit: number }) => void }) {
  const t = useTranslations('users.createDialog');
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    dailyPageLimit: 50,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 8) {
      setError(t('passwordError'));
      return;
    }

    if (!Number.isInteger(formData.dailyPageLimit) || formData.dailyPageLimit < 0) {
      setError(t('limitError'));
      return;
    }

    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('name')}</label>
            <input
              type="text"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
            <input
              type="email"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('password')}</label>
            <input
              type="password"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('role')}</label>
            <select
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
            >
              <option value="user">{t('user')}</option>
              <option value="admin">{t('admin')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('dailyLimit')}</label>
            <input
              type="number"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={Number.isNaN(formData.dailyPageLimit) ? '' : formData.dailyPageLimit}
              onChange={(e) => {
                const value = e.target.value;
                const parsed = value === '' ? Number.NaN : parseInt(value, 10);
                setFormData({ ...formData, dailyPageLimit: parsed });
              }}
              min={0}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} size="sm">{t('cancel')}</Button>
            <Button type="submit" size="sm">{t('submit')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ user, onClose, onConfirm, isDeleting }: { user: User; onClose: () => void; onConfirm: () => void; isDeleting: boolean }) {
  const t = useTranslations('users.confirmDelete');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('message', { name: user.name || user.email })}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} size="sm" disabled={isDeleting}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} size="sm" disabled={isDeleting}>
            {isDeleting ? '...' : t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditUserDialog({ user, groups, onClose }: { user: User; groups: Group[]; onClose: () => void }) {
  const t = useTranslations('users.editDialog');
  const tCreate = useTranslations('users.createDialog');
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    groupId: user.groupId?.toString() || '',
    isActive: user.isActive,
    dailyPageLimit: user.dailyPageLimit,
  });
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string; password?: string; role?: 'admin' | 'user'; groupId?: number; isActive?: boolean; dailyPageLimit?: number }) => adminUsersAPI.update(user.id, data),
    onSuccess: () => {
      onClose();
      // WebSocket 会自动更新数据，无需手动 invalidate
    },
    onError: () => {
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isInteger(formData.dailyPageLimit) || formData.dailyPageLimit < 0) {
      setError(tCreate('limitError'));
      return;
    }

    const { password, groupId, ...rest } = formData;
    const updateData = {
      ...rest,
      groupId: groupId ? parseInt(groupId, 10) : undefined,
      ...(password && { password }),
    };
    updateMutation.mutate(updateData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-sm font-medium mb-1.5">{tCreate('name')}</label>
            <input
              type="text"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{tCreate('email')}</label>
            <input
              type="email"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{tCreate('password')} <span className="text-xs text-muted-foreground">(optional)</span></label>
            <input
              type="password"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{tCreate('role')}</label>
            <select
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
            >
              <option value="user">{tCreate('user')}</option>
              <option value="admin">{tCreate('admin')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{tCreate('group')}</label>
            <select
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
            >
              <option value="">{tCreate('noGroup')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{tCreate('dailyLimit')}</label>
            <input
              type="number"
              className="w-full h-9 border-input bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={Number.isNaN(formData.dailyPageLimit) ? '' : formData.dailyPageLimit}
              onChange={(e) => {
                const value = e.target.value;
                const parsed = value === '' ? Number.NaN : parseInt(value, 10);
                setFormData({ ...formData, dailyPageLimit: parsed });
              }}
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-input"
            />
            <label htmlFor="isActive" className="text-sm font-medium">{t('activeStatus')}</label>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} size="sm">{tCreate('cancel')}</Button>
            <Button type="submit" size="sm">{t('submit')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
