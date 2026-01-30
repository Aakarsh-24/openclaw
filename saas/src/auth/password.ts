import argon2 from "argon2";

// Argon2id configuration following OWASP recommendations
const ARGON2_CONFIG: argon2.Options = {
	type: argon2.argon2id,
	memoryCost: 65536, // 64 MiB
	timeCost: 3, // 3 iterations
	parallelism: 4, // 4 parallel threads
	hashLength: 32, // 256 bits
};

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
	return argon2.hash(password, ARGON2_CONFIG);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
	password: string,
	hash: string
): Promise<boolean> {
	try {
		return await argon2.verify(hash, password);
	} catch {
		// Invalid hash format or other error
		return false;
	}
}

/**
 * Check if a password hash needs to be rehashed (due to config changes)
 */
export function needsRehash(hash: string): boolean {
	return argon2.needsRehash(hash, ARGON2_CONFIG);
}

/**
 * Validate password strength
 * Returns an array of validation errors, empty if valid
 */
export function validatePasswordStrength(password: string): string[] {
	const errors: string[] = [];

	if (password.length < 8) {
		errors.push("Password must be at least 8 characters long");
	}

	if (password.length > 128) {
		errors.push("Password must be at most 128 characters long");
	}

	if (!/[a-z]/.test(password)) {
		errors.push("Password must contain at least one lowercase letter");
	}

	if (!/[A-Z]/.test(password)) {
		errors.push("Password must contain at least one uppercase letter");
	}

	if (!/[0-9]/.test(password)) {
		errors.push("Password must contain at least one number");
	}

	// Check for common weak passwords
	const weakPasswords = [
		"password",
		"12345678",
		"qwerty",
		"letmein",
		"welcome",
		"admin",
		"password1",
		"Password1",
	];
	if (weakPasswords.some((weak) => password.toLowerCase().includes(weak))) {
		errors.push("Password is too common or easily guessable");
	}

	return errors;
}
