// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { ApiError } from "~/services/api";
import type {
	AdminSettings,
	AdminUsersResponse,
	ApiKeyInfo,
	AuthStatus,
	AuthUser,
} from "~/types";
import { queryKeys } from "./keys";

export function useAuthStatus() {
	return useQuery<AuthStatus>({
		queryKey: queryKeys.auth.status,
		queryFn: () => api.getAuthStatus(),
		staleTime: 10_000,
	});
}

export function useCurrentUser() {
	return useQuery<AuthUser | null>({
		queryKey: queryKeys.auth.me,
		queryFn: async () => {
			try {
				const res = await api.getMe();
				return res.user;
			} catch (err) {
				if (err instanceof ApiError && err.status === 401) {
					return null;
				}
				throw err;
			}
		},
		staleTime: 30_000,
		retry: false,
	});
}

export function useSetupAdmin() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: { password: string; displayName?: string }) =>
			api.setupAdmin(data),
		onSuccess: (res) => {
			qc.setQueryData(queryKeys.auth.me, res.user);
			qc.invalidateQueries({ queryKey: queryKeys.auth.status });
		},
	});
}

export function useLogin() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: { email: string; password: string }) => api.login(data),
		onSuccess: (res) => {
			qc.clear();
			qc.setQueryData(queryKeys.auth.me, res.user);
		},
	});
}

export function useRegister() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: {
			prefix: string;
			domain: string;
			displayName?: string;
			password: string;
		}) => api.register(data),
		onSuccess: (res) => {
			qc.clear();
			qc.setQueryData(queryKeys.auth.me, res.user);
		},
	});
}

export function useLogout() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api.logout(),
		onSuccess: () => {
			qc.clear();
			qc.setQueryData(queryKeys.auth.me, null);
		},
	});
}

export function useChangePassword() {
	return useMutation({
		mutationFn: (data: { currentPassword: string; newPassword: string }) =>
			api.changePassword(data),
	});
}

// ── MCP 密钥 ───────────────────────────────────────────────────────

export function useApiKeys(enabled = true) {
	return useQuery<ApiKeyInfo[]>({
		queryKey: queryKeys.apiKeys,
		queryFn: async () => {
			const res = await api.listApiKeys();
			return res.keys;
		},
		enabled,
	});
}

export function useCreateApiKey() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => api.createApiKey(name),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.apiKeys });
		},
	});
}

export function useDeleteApiKey() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.deleteApiKey(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.apiKeys });
		},
	});
}

// ── 管理员接口 ─────────────────────────────────────────────────────

export function useAdminSettings(enabled = true) {
	return useQuery<AdminSettings>({
		queryKey: queryKeys.admin.settings,
		queryFn: () => api.getAdminSettings(),
		enabled,
	});
}

export function useUpdateAdminSettings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (settings: AdminSettings) => api.updateAdminSettings(settings),
		onSuccess: (data) => {
			qc.setQueryData(queryKeys.admin.settings, data);
			qc.invalidateQueries({ queryKey: queryKeys.auth.status });
		},
	});
}

export function useAdminUsers(enabled = true) {
	return useQuery<AdminUsersResponse>({
		queryKey: queryKeys.admin.users,
		queryFn: () => api.listAdminUsers(),
		enabled,
	});
}

export function useAdminCreateUser() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: {
			prefix?: string;
			domain?: string;
			email?: string;
			displayName?: string;
			password: string;
		}) => api.createAdminUser(data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.admin.users });
		},
	});
}

export function useAdminUpdateUser() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			email,
			data,
		}: {
			email: string;
			data: { displayName?: string; disabled?: boolean; password?: string };
		}) => api.updateAdminUser(email, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.admin.users });
		},
	});
}

export function useAdminDeleteUser() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (email: string) => api.deleteAdminUser(email),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.admin.users });
		},
	});
}
