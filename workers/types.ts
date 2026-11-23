// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export interface Env extends Cloudflare.Env {
	/** 可选：自定义管理员邮箱，默认使用 admin@<主域名> */
	ADMIN_EMAIL?: string;
	/** 可选：首次部署自动初始化管理员密码，未设置时由首次访问页面引导设置 */
	ADMIN_PASSWORD?: string;
}
