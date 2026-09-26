-- =============================================================================
-- MediStock: Redistribution Management & Workflow Vertical Slice (Member 3)
-- Migration: 001_initial_redistribution_schema.sql
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. SUPPORT DOMAIN TABLES (Facilities, Medicines, Inventories)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    facility_code VARCHAR(50) NOT NULL UNIQUE,
    facility_type VARCHAR(50) NOT NULL DEFAULT 'Hospital',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address VARCHAR(300) NOT NULL,
    city VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    generic_name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'units',
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    requires_refrigeration BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS facility_inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    stock_on_hand INTEGER NOT NULL DEFAULT 0,
    safety_stock_threshold INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER NOT NULL DEFAULT 0,
    batch_number VARCHAR(100) NOT NULL DEFAULT '',
    expiry_date DATE NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_facility_inventories_facility_medicine 
    ON facility_inventories (facility_id, medicine_id);

-- -----------------------------------------------------------------------------
-- 2. WORKFLOW RUNS & AGENTIC EXECUTION TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_type VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    initiator_user_id UUID NOT NULL,
    context_json TEXT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_workflow_runs_status ON workflow_runs (status);

CREATE TABLE IF NOT EXISTS workflow_plan_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    status VARCHAR(30) NOT NULL,
    input_json TEXT NULL,
    output_json TEXT NULL,
    executed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    execution_time_ms BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    input_parameters_json TEXT NULL,
    output_result_json TEXT NULL,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    rule_name VARCHAR(200) NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    validation_details_json TEXT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id UUID NULL,
    approver_user_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    decision_notes TEXT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details_json TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs (entity_name, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp ON audit_logs (timestamp);

-- -----------------------------------------------------------------------------
-- 3. REDISTRIBUTION TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) NOT NULL UNIQUE,
    source_facility_id UUID NULL REFERENCES facilities(id) ON DELETE SET NULL,
    destination_facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    estimated_distance_km NUMERIC(10, 2) NULL,
    estimated_duration_minutes NUMERIC(10, 2) NULL,
    routing_provider VARCHAR(50) NULL,
    route_polyline TEXT NULL,
    requested_by_user_id UUID NOT NULL,
    approved_by_user_id UUID NULL,
    dispatched_at TIMESTAMPTZ NULL,
    received_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,
    notes TEXT NULL,
    workflow_run_id UUID NULL REFERENCES workflow_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_transfer_requests_status ON transfer_requests (status);
CREATE INDEX IF NOT EXISTS ix_transfer_requests_dest ON transfer_requests (destination_facility_id);
CREATE INDEX IF NOT EXISTS ix_transfer_requests_src ON transfer_requests (source_facility_id);
CREATE INDEX IF NOT EXISTS ix_transfer_requests_created_at ON transfer_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_request_id UUID NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    medicine_name VARCHAR(200) NOT NULL,
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
    allocated_quantity INTEGER NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
    received_quantity INTEGER NULL CHECK (received_quantity >= 0),
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'units',
    batch_number VARCHAR(100) NULL,
    expiry_date DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_transfer_items_transfer_request ON transfer_items (transfer_request_id);
CREATE INDEX IF NOT EXISTS ix_transfer_items_medicine ON transfer_items (medicine_id);

CREATE TABLE IF NOT EXISTS transfer_status_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_request_id UUID NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NOT NULL,
    changed_by_user_id UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NULL,
    metadata_json TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_transfer_status_histories_transfer_changed 
    ON transfer_status_histories (transfer_request_id, changed_at ASC);

-- -----------------------------------------------------------------------------
-- 4. SEED DATA (Realistic facilities, medicines & surplus inventory)
-- -----------------------------------------------------------------------------
INSERT INTO facilities (id, name, facility_code, facility_type, latitude, longitude, address, city, contact_phone, contact_person, is_active)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'National Hospital of Sri Lanka', 'FAC-COL-01', 'Central Depot', 6.9175, 79.8653, 'Regent Street, Colombo 10', 'Colombo', '+94 11 269 1111', 'Dr. Perera', TRUE),
    ('a0000000-0000-0000-0000-000000000002', 'Teaching Hospital Karapitiya', 'FAC-GAL-02', 'Hospital', 6.0682, 80.2217, 'Karapitiya, Galle', 'Galle', '+94 91 223 2250', 'Dr. Jayasinghe', TRUE),
    ('a0000000-0000-0000-0000-000000000003', 'Teaching Hospital Kandy', 'FAC-KAN-03', 'Hospital', 7.2882, 80.6278, 'William Gopallawa Mawatha, Kandy', 'Kandy', '+94 81 222 2261', 'Dr. Fernando', TRUE),
    ('a0000000-0000-0000-0000-000000000004', 'District General Hospital Negombo', 'FAC-NEG-04', 'Hospital', 7.2144, 79.8488, 'Colombo Road, Negombo', 'Negombo', '+94 31 222 2261', 'Dr. Silva', TRUE)
ON CONFLICT (facility_code) DO NOTHING;

INSERT INTO medicines (id, name, generic_name, sku, unit_of_measure, category, requires_refrigeration, is_active)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'Amoxicillin 500mg', 'Amoxicillin', 'MED-AMX-500', 'capsules', 'Antibiotics', FALSE, TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'Paracetamol 500mg', 'Paracetamol', 'MED-PCM-500', 'tablets', 'Analgesics', FALSE, TRUE),
    ('b0000000-0000-0000-0000-000000000003', 'Insulin Glargine 100IU/ml', 'Insulin Glargine', 'MED-INS-100', 'vials', 'Endocrine', TRUE, TRUE),
    ('b0000000-0000-0000-0000-000000000004', 'Metformin 500mg', 'Metformin HCl', 'MED-MET-500', 'tablets', 'Antidiabetic', FALSE, TRUE)
ON CONFLICT (sku) DO NOTHING;

-- Facility A (National Hospital Colombo): Surplus 700 of Amoxicillin
INSERT INTO facility_inventories (id, facility_id, medicine_id, stock_on_hand, safety_stock_threshold, reserved_stock, batch_number, expiry_date)
VALUES 
    ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 1200, 500, 0, 'BAT-AMX-2026A', '2027-12-31'),
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 3000, 1000, 0, 'BAT-MET-2026A', '2028-06-30')
ON CONFLICT DO NOTHING;

-- Facility C (Negombo): Surplus 300 of Amoxicillin
INSERT INTO facility_inventories (id, facility_id, medicine_id, stock_on_hand, safety_stock_threshold, reserved_stock, batch_number, expiry_date)
VALUES 
    ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 600, 300, 0, 'BAT-AMX-2026N', '2027-10-15')
ON CONFLICT DO NOTHING;

-- Facility B (Karapitiya Galle): Experiencing shortage (Stock 50, Safety Stock 500, needs 450)
INSERT INTO facility_inventories (id, facility_id, medicine_id, stock_on_hand, safety_stock_threshold, reserved_stock, batch_number, expiry_date)
VALUES 
    ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 50, 500, 0, 'BAT-AMX-2025G', '2026-11-30')
ON CONFLICT DO NOTHING;
