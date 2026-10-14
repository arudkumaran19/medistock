-- ============================================================================
-- MediStock Database Restore Script (Rollback)
-- Date: 2026-10-14
-- Purpose: Restores medicines and InventoryBalances tables from 20261014 backups.
-- ============================================================================

TRUNCATE TABLE medicines CASCADE;
INSERT INTO medicines SELECT * FROM medicines_backup_20261014;

TRUNCATE TABLE "Medicines" CASCADE;
INSERT INTO "Medicines" SELECT * FROM "Medicines_backup_20261014";

TRUNCATE TABLE "InventoryBalances" CASCADE;
INSERT INTO "InventoryBalances" SELECT * FROM "InventoryBalances_backup_20261014";
