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
 * TEMPORARY. Replace with a lookup against the Inventory API once it exists.
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
