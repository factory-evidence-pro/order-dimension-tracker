-- ============================================
-- ORDER DIMENSION TRACKER - COMPLETE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
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
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================
-- ORDERS TABLE (with duplicate prevention)
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100),
    tracking_number VARCHAR(100) NOT NULL UNIQUE, -- ✅ PREVENTS DUPLICATES
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
    deleted_at TIMESTAMP WITH TIME ZONE,
    duplicate_scan_count INTEGER DEFAULT 0, -- ✅ TRACKS DUPLICATES
    last_duplicate_scan TIMESTAMP WITH TIME ZONE -- ✅ TRACKS LAST DUPLICATE
);

-- Indexes for performance
CREATE INDEX idx_orders_tracking ON orders(tracking_number);
CREATE INDEX idx_orders_date ON orders(date_scanned DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_scanned_by ON orders(scanned_by);
CREATE INDEX idx_orders_tracking_status ON orders(tracking_number, status);
CREATE INDEX idx_orders_date_status ON orders(date_scanned, status);

-- ============================================
-- ORDERS HISTORY (audit trail for changes)
-- ============================================
CREATE TABLE orders_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    tracking_number VARCHAR(100),
    old_dimensions VARCHAR(50),
    new_dimensions VARCHAR(50),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    old_quantity INTEGER,
    new_quantity INTEGER,
    changed_by UUID REFERENCES users(id),
    change_type VARCHAR(20) CHECK (change_type IN ('CREATE', 'UPDATE', 'DUPLICATE_SCAN', 'OVERWRITE')),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_history_order ON orders_history(order_id);
CREATE INDEX idx_history_tracking ON orders_history(tracking_number);
CREATE INDEX idx_history_changed_at ON orders_history(changed_at);

-- ============================================
-- BIGSELLER CACHE (from Google Drive)
-- ============================================
CREATE TABLE bigseller_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    order_data JSONB NOT NULL,
    source_file VARCHAR(255),
    file_modified TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_valid BOOLEAN DEFAULT TRUE,
    validation_errors JSONB
);

CREATE INDEX idx_cache_tracking ON bigseller_cache(tracking_number);
CREATE INDEX idx_cache_updated ON bigseller_cache(last_updated);
CREATE INDEX idx_cache_valid ON bigseller_cache(is_valid);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

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

-- ✅ Log order changes to history
CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO orders_history (
            order_id, tracking_number, new_dimensions, new_status,
            new_quantity, changed_by, change_type, metadata
        ) VALUES (
            NEW.id, NEW.tracking_number, NEW.dimensions, NEW.status,
            NEW.quantity, NEW.scanned_by, 'CREATE',
            jsonb_build_object('source', NEW.source)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if something changed
        IF OLD.dimensions IS DISTINCT FROM NEW.dimensions OR 
           OLD.status IS DISTINCT FROM NEW.status OR
           OLD.quantity IS DISTINCT FROM NEW.quantity THEN
            
            INSERT INTO orders_history (
                order_id, tracking_number, 
                old_dimensions, new_dimensions,
                old_status, new_status,
                old_quantity, new_quantity,
                changed_by, change_type, metadata
            ) VALUES (
                NEW.id, NEW.tracking_number,
                OLD.dimensions, NEW.dimensions,
                OLD.status, NEW.status,
                OLD.quantity, NEW.quantity,
                NEW.modified_by, 
                CASE 
                    WHEN OLD.dimensions IS NOT NULL AND NEW.dimensions IS NOT NULL 
                        AND OLD.dimensions != NEW.dimensions 
                    THEN 'OVERWRITE'
                    ELSE 'UPDATE'
                END,
                jsonb_build_object(
                    'old_data', jsonb_build_object(
                        'dimensions', OLD.dimensions,
                        'status', OLD.status,
                        'quantity', OLD.quantity
                    ),
                    'new_data', jsonb_build_object(
                        'dimensions', NEW.dimensions,
                        'status', NEW.status,
                        'quantity', NEW.quantity
                    )
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for orders
CREATE TRIGGER log_orders_insert 
    AFTER INSERT ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION log_order_changes();

CREATE TRIGGER log_orders_update 
    AFTER UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION log_order_changes();

-- ✅ Cleanup audit logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM orders_history WHERE changed_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ✅ Function to check for duplicate scans
CREATE OR REPLACE FUNCTION check_duplicate_scan(p_tracking VARCHAR)
RETURNS TABLE (
    is_duplicate BOOLEAN,
    existing_dimensions VARCHAR,
    scan_count INTEGER,
    last_scan TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) > 1,
        MAX(dimensions),
        COUNT(*)::INTEGER,
        MAX(date_scanned)
    FROM orders
    WHERE tracking_number = p_tracking AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DEFAULT ADMIN USER
-- Password: Admin123!
-- ============================================
INSERT INTO users (id, email, username, password_hash, full_name, role)
VALUES (
    gen_random_uuid(),
    'admin@example.com',
    'admin',
    '$2a$10$Q2J7XzFfLxz3vZzqQgWJwuV7lWYg9YhKxJzGfJmNvQwLpMkXyZzC2',
    'Administrator',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- RLS POLICIES (Optional - Enable if needed)
-- ============================================
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY orders_select_own ON orders FOR SELECT USING (auth.uid() = scanned_by);
-- CREATE POLICY orders_insert_own ON orders FOR INSERT WITH CHECK (auth.uid() = scanned_by);
-- CREATE POLICY orders_update_own ON orders FOR UPDATE USING (auth.uid() = scanned_by);
-- CREATE POLICY admin_all ON orders FOR ALL USING (auth.role() = 'admin');

-- ============================================
-- VIEW: Duplicate Orders Report
-- ============================================
CREATE OR REPLACE VIEW duplicate_orders_view AS
SELECT 
    tracking_number,
    COUNT(*) as scan_count,
    STRING_AGG(DISTINCT dimensions, ', ') as all_dimensions,
    STRING_AGG(DISTINCT scanned_by::text, ', ') as scanned_by_users,
    COUNT(DISTINCT scanned_by) as unique_scanners,
    MAX(date_scanned) as last_scan,
    MIN(date_scanned) as first_scan
FROM orders
WHERE deleted_at IS NULL
GROUP BY tracking_number
HAVING COUNT(*) > 1
ORDER BY scan_count DESC;

-- ============================================
-- VIEW: Daily Stats
-- ============================================
CREATE OR REPLACE VIEW daily_stats_view AS
SELECT 
    DATE(date_scanned) as scan_date,
    COUNT(*) as total_orders,
    COUNT(DISTINCT tracking_number) as unique_orders,
    COUNT(CASE WHEN status = 'SAVED' THEN 1 END) as saved,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
    COUNT(DISTINCT scanned_by) as active_users
FROM orders
WHERE deleted_at IS NULL
GROUP BY DATE(date_scanned)
ORDER BY scan_date DESC;
