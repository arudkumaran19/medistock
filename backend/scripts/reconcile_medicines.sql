-- ============================================================================
-- MediStock Database Reconciliation Script
-- Date: 2026-10-14
-- Purpose: Reconcile medicines catalog between ApplicationDbContext ("Medicines")
--          and MediStockDbContext (medicines), ensuring 100% JOIN alignment.
-- ============================================================================

-- Step 1: Create Point-in-Time Backups
CREATE TABLE IF NOT EXISTS "InventoryBalances_backup_20261014" AS SELECT * FROM "InventoryBalances";
CREATE TABLE IF NOT EXISTS "Medicines_backup_20261014" AS SELECT * FROM "Medicines";
CREATE TABLE IF NOT EXISTS medicines_backup_20261014 AS SELECT * FROM medicines;

-- Step 2: Fix 77777777 collision in lowercase medicines table
-- (77777777 in InventoryBalances is Azithromycin 250 mg; Ceftriaxone is at b0000000-0000-0000-0000-000000000005)
UPDATE medicines SET 
    "Name" = 'Azithromycin 250 mg',
    "GenericName" = 'Azithromycin',
    "Sku" = 'MED-AZI-250',
    "UnitOfMeasure" = 'tablets',
    "Category" = 'Antibiotics',
    "RequiresRefrigeration" = false,
    "IsActive" = true
WHERE "Id" = '77777777-7777-7777-7777-777777777777';

-- Step 3: Insert missing 7 medicines into lowercase medicines table
INSERT INTO medicines ("Id", "Name", "GenericName", "Sku", "UnitOfMeasure", "Category", "RequiresRefrigeration", "IsActive")
VALUES 
    ('22222222-2222-2222-2222-222222222222', 'Paracetamol 500 mg', 'Paracetamol', 'MED-PCM-500-APP', 'tablets', 'Analgesics', false, true),
    ('33333333-3333-3333-3333-333333333333', 'Amoxicillin 250 mg', 'Amoxicillin', 'MED-AMX-250', 'capsules', 'Antibiotics', false, true),
    ('44444444-4444-4444-4444-444444444444', 'Ibuprofen 200 mg', 'Ibuprofen', 'MED-IBU-200', 'tablets', 'Analgesics', false, true),
    ('55555555-5555-5555-5555-555555555555', 'Cetirizine 10 mg', 'Cetirizine HCl', 'MED-CET-010', 'tablets', 'Antihistamines', false, true),
    ('66666666-6666-6666-6666-666666666666', 'Omeprazole 20 mg', 'Omeprazole', 'MED-OME-020', 'capsules', 'Gastrointestinal', false, true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vitamin C', 'Ascorbic Acid', 'MED-VIT-C', 'tablets', 'Vitamins', false, true),
    ('e6ec9e80-fd6b-4cb4-ab98-c781b77d65a0', 'betaleb-N', 'Betamethasone / Neomycin', 'MED-BET-N', 'bottles', 'Dermatology', false, true)
ON CONFLICT ("Id") DO UPDATE SET
    "Name" = EXCLUDED."Name",
    "GenericName" = EXCLUDED."GenericName",
    "Sku" = EXCLUDED."Sku",
    "UnitOfMeasure" = EXCLUDED."UnitOfMeasure",
    "Category" = EXCLUDED."Category",
    "RequiresRefrigeration" = EXCLUDED."RequiresRefrigeration",
    "IsActive" = EXCLUDED."IsActive";
