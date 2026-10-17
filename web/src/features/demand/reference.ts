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

/**
 * Identifiers that exist only in this vertical's own demonstration seed. They predate
 * the Inventory tables, so they are not rows in Medicines or Facilities: the 90 seeded
 * consumption records belong to these and to nothing else. They stay selectable so the
 * demonstration data remains reachable alongside the real catalogue.
 */
const DEMO_IDS = new Set<string>([
  'c1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000002',
]);

export interface ReferenceOption {
  id: string;
  name: string;
  /** True for this vertical's seed-only identifiers. */
  isDemo: boolean;
}

function toOptions(map: Record<string, string>): ReferenceOption[] {
  return Object.entries(map)
    .map(([id, name]) => ({ id, name, isDemo: DEMO_IDS.has(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Medicines available to choose from: the Inventory catalogue plus the seeded
 * demonstration medicines.
 *
 * A function, not a constant. This used to be a module-level array built once at
 * import time - before GET /api/medicines had answered - so it froze at the two
 * seeded entries and every dropdown showed Amoxicillin and Paracetamol only, however
 * many medicines Inventory held. Reading the map at render time picks up whatever
 * registerReferenceNames() has added since.
 */
export function knownMedicines(): ReferenceOption[] {
  return toOptions(MEDICINE_NAMES);
}

/** Facilities available to choose from, read at render time for the same reason. */
export function knownFacilities(): ReferenceOption[] {
  return toOptions(FACILITY_NAMES);
}

/** Dropdown label, marking seed-only entries so they are not mistaken for real stock. */
export function optionLabel(option: ReferenceOption): string {
  return option.isDemo ? `${option.name} (demo data)` : option.name;
}


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
