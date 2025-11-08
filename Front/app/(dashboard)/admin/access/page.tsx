'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersAPI } from '@/lib/api/admin-providers';
import { adminUsersAPI } from '@/lib/api/admin-users';
import { Button } from '@/components/ui/button';
import { UserProviderAccess, GrantAccessRequest } from '@/lib/types/access';

export default function AdminAccessPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);

  const { data: accesses = [], isLoading } = useQuery({
    queryKey: ['admin', 'access'],
    queryFn: adminProvidersAPI.listAccess,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminUsersAPI.list,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: adminProvidersAPI.list,
  });

  const revokeMutation = useMutation({
    mutationFn: adminProvidersAPI.revokeAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access'] });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  const getUserName = (userId: string) => users.find((u: any) => u.id === userId)?.name || userId;
  const getProviderName = (providerId: string) => providers.find((p: any) => p.id === providerId)?.name || providerId;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Access Control</h1>
        <Button onClick={() => setShowDialog(true)}>Grant Access</Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Granted At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accesses.map((access: UserProviderAccess) => (
              <tr key={access.id}>
                <td className="px-6 py-4 whitespace-nowrap">{getUserName(access.userId)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getProviderName(access.providerConfigId)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {access.isDefault && <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Default</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(access.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Button variant="destructive" size="sm" onClick={() => revokeMutation.mutate(access.id)}>
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && <GrantAccessDialog users={users} providers={providers} onClose={() => setShowDialog(false)} />}
    </div>
  );
}

function GrantAccessDialog({ users, providers, onClose }: { users: any[]; providers: any[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    userId: '',
    providerConfigId: '',
    isDefault: false,
  });

  const grantMutation = useMutation({
    mutationFn: adminProvidersAPI.grantAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    grantMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Grant Provider Access</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">User</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              required
            >
              <option value="">Select user...</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.providerConfigId}
              onChange={(e) => setFormData({ ...formData, providerConfigId: e.target.value })}
              required
            >
              <option value="">Select provider...</option>
              {providers.map((provider: any) => (
                <option key={provider.id} value={provider.id}>{provider.name} ({provider.providerType})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="isDefault" className="text-sm font-medium">Set as default for this user</label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Grant Access</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
