/**
 * Display names for the seeded demonstration identifiers.
 * Sathurstiga S. (IT24103156).
 *
 * The Demand API returns facilities and medicines as bare GUIDs. Their names belong to
 * the Inventory vertical (Vaisnavi L., IT24102469), whose Medicines and Facilities
 * tables do not exist yet, so there is nothing to look them up against.
 *
 * The entries below are the fixed identifiers this vertical's own seed data defines in
 * Infrastructure/Persistence/Seed/SeedData.cs - they are not invented. Anything not in
 * the map degrades to a short id rather than a made-up name.
 *
 * The Inventory API now exists on develop, so registerReferenceNames() fills these
 * maps from GET /api/medicines and GET /api/facilities. The seeded entries below
 * remain as a fallback for this vertical's own demonstration data, whose ids were
 * chosen before the Inventory tables were built.
 */
const MEDICINE_NAMES: Record<string, string> = {
  'c1000000-0000-0000-0000-000000000001': 'Amoxicillin',
  'c1000000-0000-0000-0000-000000000002': 'Paracetamol',
};

const FACILITY_NAMES: Record<string, string> = {
  'b1000000-0000-0000-0000-000000000001': 'Hospital A',
  'b1000000-0000-0000-0000-000000000002': 'Hospital B',
};

/** Shortened identifier, used when no name is known. */
function shortId(id: string): string {
  return id ? `${id.slice(0, 8)}…` : '—';
}

export function medicineName(id: string): string {
  return MEDICINE_NAMES[id] ?? shortId(id);
}

export function facilityName(id: string): string {
  return FACILITY_NAMES[id] ?? shortId(id);
}

/** True when the id resolves to a real name rather than a fallback. */
export function hasMedicineName(id: string): boolean {
  return id in MEDICINE_NAMES;
}

/** Medicines available to filter by, from the seeded dataset. */
export const KNOWN_MEDICINES = Object.entries(MEDICINE_NAMES).map(([id, name]) => ({
  id,
  name,
}));


/**
 * Registers names fetched from the Inventory API.
 *
 * The display helpers above are plain functions called from table cell renderers,
 * so they cannot be hooks. Reference data is therefore held in these module maps
 * and topped up once it loads; components subscribe through useReferenceData() so
 * they re-render when it arrives.
 */
export function registerReferenceNames(
  medicines: ReadonlyArray<{ id: string; name: string }>,
  facilities: ReadonlyArray<{ id: string; name: string }>,
): void {
  for (const medicine of medicines) {
    MEDICINE_NAMES[medicine.id] = medicine.name;
  }
  for (const facility of facilities) {
    FACILITY_NAMES[facility.id] = facility.name;
  }
}
