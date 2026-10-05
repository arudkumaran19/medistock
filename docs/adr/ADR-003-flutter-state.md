# ADR-003: Flutter state management

- Status: Accepted
- Date: 2026-09-21
- Primary owner: Sathurstiga S. (IT24103156)
- Deciders: all four members (reviewed)

## Context

The blueprint mandates Flutter + Dart for the operational field application and names
Riverpod in the stack table, with Provider listed as the alternative. Flutter is the
operational application — Look up, Scan, Update, Request, Receive, Track, Notify — and
React is the management application. That split is fixed by ADR-008.

The Demand & Shortage vertical needs mobile state that can:

- hold asynchronous server data with explicit loading, empty and error states, because
  the blueprint requires all three in every feature;
- be read by several screens without rebuilding the widget tree above them (the
  facility a store officer works at is read by all four demand screens);
- be replaced wholesale in tests, so widget tests run without a live backend;
- invalidate and refetch after a write, so recording consumption refreshes the history.

The screens in scope are `ConsumptionEntryScreen`, `ShortageAlertsScreen`,
`ForecastScreen` and `DemandHistoryScreen`.

## Decision

**Use Riverpod (`flutter_riverpod`) as the single state-management approach for Flutter.**

Specifically:

| Concern | Mechanism |
| --- | --- |
| Async server data | `FutureProvider` / `FutureProvider.family` |
| Form submission with progress and failure | `StateNotifierProvider` |
| Injected dependencies (API client, repository) | `Provider` |
| Session values read across screens (facility id) | `Provider`, overridden at app start |
| Transient widget state (text controllers, filter chips) | `StatefulWidget` local state |

Client-side validation mirrors the backend rules but never replaces them. The backend
remains authoritative; `ConsumptionEntryValidator` exists only to avoid an obviously
invalid round trip, and the backend's rejection message is displayed verbatim when one
comes back.

## Alternatives considered

**Provider** (the blueprint's listed alternative). Rejected: it resolves by `BuildContext`
and `InheritedWidget` type, so overriding a dependency in a widget test means rebuilding
the tree around it, and two providers of the same type cannot coexist cleanly. Riverpod's
`ProviderScope(overrides: …)` swaps the repository in one line, which is what the required
widget tests need.

**`setState` plus direct repository calls.** Rejected: it leaves each screen to reimplement
loading, empty and error handling, which is exactly the duplication the shared design
system is meant to remove.

**BLoC.** Rejected: not listed in the blueprint stack table, and it is more ceremony than
four screens justify. Introducing it would be an unsanctioned technology decision.

## Consequences

Positive:

- `AsyncValue.when(loading:, error:, data:)` makes the three required states impossible to
  forget; the shared `LoadingView`, `EmptyView` and `ErrorView` render them consistently.
- Widget tests override `demandRepositoryProvider` with a fake, so no live backend is
  needed. This is how the mobile tests in `mobile/test/demand/` run.
- `ref.invalidate(...)` gives pull-to-refresh and post-write refresh for free.
- Compile-time safety: providers are typed top-level objects, not string keys.

Negative:

- Riverpod is a dependency beyond the Flutter SDK, and every member must understand
  `Provider`, `FutureProvider`, `StateNotifierProvider` and `ProviderScope` for the viva.
- `ProviderScope` must wrap the application root, so a missing scope is a runtime error
  rather than a compile error.

## Related

- ADR-006: database strategy
- ADR-008: client responsibility split (owner: ILHAM MM)
- `mobile/lib/features/demand/application/demand_providers.dart`
- `mobile/lib/shared/` — shared Flutter design system (owner: Sathurstiga S.)

## Not specified in the final blueprint

The blueprint names Riverpod but does not prescribe which Riverpod primitive to use for
which concern, nor whether client-side validation is permitted alongside backend
validation. The mapping table above and the "mirror but never replace" validation rule
are decisions of this ADR.

**Not specified in the final blueprint. Do not assume or introduce a new decision without
team-level confirmation.**
