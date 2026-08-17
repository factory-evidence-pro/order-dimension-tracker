-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100),
    tracking_number VARCHAR(100) NOT NULL,
    skus TEXT,
    quantity INTEGER DEFAULT 0,
    dimensions VARCHAR(50),
    weight DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SAVED', 'SHIPPED', 'ERROR')),
    date_scanned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scanned_by UUID REFERENCES users(id),
    modified_by UUID REFERENCES users(id),
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'bigseller', 'api')),
    metadata JSONB DEFAULT '{}',
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_tracking ON orders(tracking_number);
CREATE INDEX idx_orders_date ON orders(date_scanned DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_scanned_by ON orders(scanned_by);
CREATE INDEX idx_orders_tracking_status ON orders(tracking_number, status);
CREATE INDEX idx_orders_date_status ON orders(date_scanned, status);

-- BigSeller cache table
CREATE TABLE bigseller_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    order_data JSONB NOT NULL,
    source_file VARCHAR(255),
    file_modified TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_valid BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_cache_tracking ON bigseller_cache(tracking_number);
CREATE INDEX idx_cache_updated ON bigseller_cache(last_updated);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for audit logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Initial admin user (password: Admin123!)
INSERT INTO users (id, email, username, password_hash, full_name, role)
VALUES (
    gen_random_uuid(),
    'admin@example.com',
    'admin',
    '$2a$10$YourHashedPasswordHere', -- Use bcrypt to generate: "Admin123!"
    'Administrator',
    'admin'
) ON CONFLICT (email) DO NOTHING;