# ADR-006: Database strategy

- Status: Accepted
- Date: 2026-09-21
- Primary owner: Sathurstiga S. (IT24103156)
- Deciders: all four members (reviewed)

## Context

The blueprint fixes PostgreSQL as the single source of truth and EF Core + Npgsql as the
ORM. It assigns primary ownership of
`backend/src/MediStock.Api/Infrastructure/Persistence/` to this vertical, with every
other vertical supplying its entity requirements through that boundary.

Four members develop four verticals in parallel against one schema. The blueprint's own
risk register rates "database schema conflicts" as high probability and high impact, and
"migration conflict" as medium/high, mitigated by a shared ERD and migration ownership
rules.

The Demand vertical owns four tables: `ConsumptionRecords`, `DemandForecasts`,
`ShortageAlerts` and `ReorderRules`.

## Decision

**One PostgreSQL database, one `ApplicationDbContext`, one migration history, with
per-vertical entity configuration files.**

1. **A single `DbContext`.** Every vertical registers its `DbSet`s on
   `ApplicationDbContext`. There is no context-per-feature and no second database.

2. **Configuration by file, not by method.** `OnModelCreating` calls
   `ApplyConfigurationsFromAssembly`. Each vertical adds its own
   `IEntityTypeConfiguration<T>` file under `Infrastructure/Persistence/Configurations/`.
   Two members adding tables therefore touch different files, so the common case
   produces no merge conflict.

3. **One migration in flight at a time.** Migrations are generated against `develop` and
   merged one pull request at a time, as the blueprint's mitigation requires. A member
   whose migration conflicts regenerates rather than hand-edits the snapshot.

4. **Exact numerics for quantities.** `decimal` maps to `numeric(18,2)` by convention,
   not floating point, so stock and consumption arithmetic is reproducible. Confidence
   scores use `numeric(5,4)`.

5. **UTC everywhere.** Dates are stored and returned as UTC and cross the API as ISO 8601.

6. **Startup seeding, not model seeding.** `SeedData.EnsureSeededAsync` migrates and then
   inserts the demonstration dataset if it is absent. The demand dataset is a rolling
   window relative to the current date, and EF model seeding (`HasData`) requires static
   values, so it cannot express it.

7. **Deployed on Neon.** Neon's free plan has no time limit, unlike Render's free
   PostgreSQL which expires after 30 days — and the submission must stay reachable until
   21 October 2026. See ADR-007 (owner: Arudkumaran V.) for the wider hosting decision.

### Demand vertical schema

| Table | Purpose | Key index |
| --- | --- | --- |
| `ConsumptionRecords` | Historical usage; the forecast input | `(FacilityId, MedicineId, ConsumptionDate)` |
| `DemandForecasts` | Deterministic forecast output | `(FacilityId, MedicineId, GeneratedAt)` |
| `ShortageAlerts` | Projected stockout and risk | `(FacilityId, Status, GeneratedAt)`, `RiskLevel` |
| `ReorderRules` | Threshold and lead time | `(FacilityId, MedicineId)` unique |

`ShortageAlerts.DemandForecastId` is a nullable foreign key with `ON DELETE SET NULL`, so
an alert calculated from a caller-supplied consumption rate is still valid while one
derived from a forecast stays traceable to it.

`ReorderRules` is unique on `(FacilityId, MedicineId)` so the `getShortageThreshold`
agent tool has a single unambiguous answer.

Facility and medicine identifiers are stored as `Guid` without a foreign key from this
vertical, because `Facilities` and `Medicines` belong to the Inventory vertical. The
constraints are added by that owner through this same persistence boundary.

## Alternatives considered

**A database or schema per vertical.** Rejected: it contradicts the blueprint's single
source of truth and would make a transfer spanning inventory and demand impossible to
commit atomically.

**Fluent configuration inline in `OnModelCreating`.** Rejected: it funnels all four
members into one method in one file, which is precisely the merge conflict the risk
register warns about.

**Data annotations on the model classes.** Rejected: indexes and delete behaviour are not
expressible, and it mixes persistence concerns into the domain models.

**`EnsureCreated` instead of migrations.** Rejected: it produces no migration history and
cannot evolve a deployed schema, and the blueprint requires migrations.

## Consequences

Positive:

- One connection string, one migration history, one transactional boundary — so a
  transfer that touches several verticals can commit or roll back as a unit.
- Adding a vertical's tables is an additive file, which keeps parallel development moving.
- Deterministic seed identifiers make the demonstration and golden cases reproducible.

Negative:

- Migrations serialise the team: only one migration pull request merges at a time.
- One shared context means a careless change can affect another vertical, so persistence
  changes need review by this ADR's owner.
- Cross-vertical foreign keys cannot be created until both verticals' entities exist.

## Related

- ADR-003: Flutter state management
- ADR-007: deployment (owner: Arudkumaran V.)
- `backend/src/MediStock.Api/Infrastructure/Persistence/`
- `docs/testing/README.md` — database testing plan

## Not specified in the final blueprint

The blueprint fixes PostgreSQL, EF Core, Npgsql, Neon and the four table names, but does
not specify the columns, indexes, numeric precision, delete behaviour, seeding mechanism
or the configuration-file convention. Those are decisions of this ADR.

**Not specified in the final blueprint. Do not assume or introduce a new decision without
team-level confirmation.**
