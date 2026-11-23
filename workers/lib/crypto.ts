// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * 密码哈希、令牌生成与摘要计算工具（基于 Cloudflare Workers 原生 Web Crypto API）
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

/** 常量时间字节比较，防止时序攻击 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

/** 使用 PBKDF2-SHA256 对密码进行加盐哈希 */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		HASH_BYTES * 8,
	);
	const hashBytes = new Uint8Array(derivedBits);
	return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hashBytes)}`;
}

/** 校验明文密码与存储的 PBKDF2 哈希是否匹配 */
export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<boolean> {
	const parts = storedHash.split("$");
	if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
		return false;
	}
	const iterations = Number.parseInt(parts[1], 10);
	if (!Number.isFinite(iterations) || iterations < 1 || iterations > 100_000) {
		return false;
	}
	const salt = fromHex(parts[2]);
	const expected = fromHex(parts[3]);

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt as BufferSource,
			iterations,
			hash: "SHA-256",
		},
		keyMaterial,
		expected.length * 8,
	);
	return timingSafeEqual(new Uint8Array(derivedBits), expected);
}

/** 计算字符串的 SHA-256 十六进制摘要（用于存储 Session Token 与 API 密钥哈希） */
export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(input),
	);
	return toHex(new Uint8Array(digest));
}

/** 生成密码学安全的随机十六进制令牌 */
export function generateSecureToken(byteLength = 32): string {
	return toHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** 生成 MCP API 密钥及展示前缀 */
export function generateApiKey(): { key: string; keyPrefix: string } {
	const key = `agx_${generateSecureToken(24)}`;
	const keyPrefix = `${key.slice(0, 12)}...`;
	return { key, keyPrefix };
}
