-- Moltbot SaaS Database Schema
-- PostgreSQL 15+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
CREATE TYPE tenant_status AS ENUM ('provisioning', 'active', 'suspended', 'terminated');
CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    display_name VARCHAR(100),
    avatar_url TEXT,

    -- Security
    totp_secret BYTEA,  -- Encrypted TOTP secret
    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    -- Soft delete
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);

-- Email verification tokens
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of token
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_expires ON email_verifications(expires_at);

-- Password reset tokens
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_password_resets_user ON password_resets(user_id);
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);

-- User sessions (JWT refresh tokens)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Token info
    refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,

    -- Session metadata
    user_agent TEXT,
    ip_address INET,
    device_fingerprint VARCHAR(64),

    -- Status
    status session_status NOT NULL DEFAULT 'active',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id) WHERE status = 'active';
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_refresh ON user_sessions(refresh_token_hash);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Subscription info
    tier subscription_tier NOT NULL DEFAULT 'free',
    status subscription_status NOT NULL DEFAULT 'active',

    -- Stripe integration
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),

    -- Billing period
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canceled_at TIMESTAMPTZ,

    CONSTRAINT unique_active_subscription UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- Tenant instances (compute resources)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Kubernetes resources
    namespace VARCHAR(63) NOT NULL UNIQUE,  -- k8s namespace limit
    pod_name VARCHAR(63),
    service_name VARCHAR(63),

    -- Status
    status tenant_status NOT NULL DEFAULT 'provisioning',

    -- Resource allocation
    cpu_limit VARCHAR(20) NOT NULL DEFAULT '500m',
    memory_limit VARCHAR(20) NOT NULL DEFAULT '512Mi',
    storage_limit VARCHAR(20) NOT NULL DEFAULT '1Gi',

    -- Encryption
    vault_key_id VARCHAR(255),  -- Vault transit key reference

    -- Gateway connection
    gateway_port INTEGER,
    gateway_token_hash VARCHAR(64),  -- For internal auth

    -- Scaling
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scaled_down_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_user_tenant UNIQUE (user_id)
);

CREATE INDEX idx_tenants_user ON tenants(user_id);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_last_activity ON tenants(last_activity_at);
CREATE INDEX idx_tenants_namespace ON tenants(namespace);

-- Usage tracking (for billing and limits)
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Usage metrics
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Message counts
    messages_sent INTEGER NOT NULL DEFAULT 0,
    messages_received INTEGER NOT NULL DEFAULT 0,

    -- Token usage
    tokens_input BIGINT NOT NULL DEFAULT 0,
    tokens_output BIGINT NOT NULL DEFAULT 0,

    -- Compute time (seconds)
    compute_seconds INTEGER NOT NULL DEFAULT 0,

    -- Storage (bytes)
    storage_bytes BIGINT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_usage_period UNIQUE (user_id, period_start, period_end)
);

CREATE INDEX idx_usage_user_period ON usage_records(user_id, period_start, period_end);
CREATE INDEX idx_usage_tenant ON usage_records(tenant_id);

-- API keys for programmatic access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Key info
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,  -- First 8 chars for identification
    key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of full key

    -- Permissions
    scopes TEXT[] NOT NULL DEFAULT '{}',

    -- Rate limiting
    rate_limit INTEGER,  -- Requests per minute, NULL = use tier default

    -- Expiration
    expires_at TIMESTAMPTZ,

    -- Metadata
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- Audit log for security events
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

    -- Event info
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    description TEXT,

    -- Context
    ip_address INET,
    user_agent TEXT,

    -- Additional data (JSON)
    metadata JSONB,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Tier limits configuration
CREATE TABLE tier_limits (
    tier subscription_tier PRIMARY KEY,

    -- Message limits (per day)
    daily_message_limit INTEGER,  -- NULL = unlimited

    -- Token limits (per month)
    monthly_token_limit BIGINT,

    -- Compute limits
    max_compute_hours_month INTEGER,
    max_concurrent_sessions INTEGER NOT NULL DEFAULT 1,

    -- Storage limits (bytes)
    max_storage_bytes BIGINT NOT NULL,

    -- Features
    voice_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    video_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    custom_models_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    api_access_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Rate limits
    api_rate_limit INTEGER NOT NULL DEFAULT 60,  -- Requests per minute

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default tier limits
INSERT INTO tier_limits (tier, daily_message_limit, monthly_token_limit, max_compute_hours_month, max_storage_bytes, voice_enabled, video_enabled, custom_models_enabled, api_access_enabled, api_rate_limit) VALUES
    ('free', 50, 100000, 10, 104857600, FALSE, FALSE, FALSE, FALSE, 10),           -- 100MB storage
    ('starter', 500, 1000000, 100, 1073741824, TRUE, FALSE, FALSE, TRUE, 60),      -- 1GB storage
    ('pro', NULL, 10000000, 500, 10737418240, TRUE, TRUE, TRUE, TRUE, 300),        -- 10GB storage
    ('enterprise', NULL, NULL, NULL, 107374182400, TRUE, TRUE, TRUE, TRUE, 1000);  -- 100GB storage

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_records_updated_at BEFORE UPDATE ON usage_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tier_limits_updated_at BEFORE UPDATE ON tier_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup job helper: Delete expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM email_verifications WHERE expires_at < NOW() - INTERVAL '7 days';
    DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL '7 days';
    DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
