/**
 * Reference lists for the Demand dropdowns.
 * Sathurstiga S. (IT24103156).
 *
 * Guards a regression that hid for weeks: the medicine list used to be a module-level
 * constant built at import time, before GET /api/medicines had answered, so every
 * dropdown showed the two seeded medicines however large the real catalogue was.
 */
import { describe, expect, it } from 'vitest';

import { facilityName, knownFacilities, knownMedicines, optionLabel, registerReferenceNames } from './reference';

describe('reference lists', () => {
  it('include medicines and facilities registered after import', () => {
    registerReferenceNames(
      [{ id: '33333333-3333-3333-3333-333333333333', name: 'Amoxicillin 250 mg' }],
      [{ id: '11111111-1111-1111-1111-111111111111', name: 'Central Facility' }],
    );

    expect(knownMedicines().map((m) => m.name)).toContain('Amoxicillin 250 mg');
    expect(knownFacilities().map((f) => f.name)).toContain('Central Facility');
  });

  it('marks seed-only entries so they are not mistaken for real stock when registered', () => {
    registerReferenceNames(
      [],
      [{ id: 'b1000000-0000-0000-0000-000000000002', name: 'Teaching Hospital Kandy' }],
    );

    const demo = knownFacilities().find((f) => f.id === 'b1000000-0000-0000-0000-000000000002');
    const real = knownFacilities().find((f) => f.id === '11111111-1111-1111-1111-111111111111');

    expect(demo && optionLabel(demo)).toBe('Teaching Hospital Kandy (demo data)');
    expect(real && optionLabel(real)).toBe('Central Facility');
  });

  it('does not show fake fallback names when unregistered', () => {
    expect(facilityName('unknown-id')).toBe('unknown-…');
  });
});
