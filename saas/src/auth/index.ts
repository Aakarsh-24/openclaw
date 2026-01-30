export { AuthService } from "./service.js";
export type { AuthResult, SignupInput, LoginInput } from "./service.js";
export { authMiddleware, optionalAuthMiddleware, requireTier } from "./middleware.js";
export {
	generateAccessToken,
	generateRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
	generateSecureToken,
	hashToken,
} from "./jwt.js";
export type { AccessTokenPayload, RefreshTokenPayload } from "./jwt.js";
export {
	hashPassword,
	verifyPassword,
	validatePasswordStrength,
} from "./password.js";
