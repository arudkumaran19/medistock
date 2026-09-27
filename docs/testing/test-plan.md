# Consolidated test plan

Primary owner: **Sathurstiga S. (IT24103156)**.

## 1. Layers and tools

| Layer | Tool | Location |
| --- | --- | --- |
| Backend unit | xUnit + FluentAssertions | `backend/tests/MediStock.UnitTests` |
| Backend API / authorization | xUnit + `WebApplicationFactory` | `backend/tests/MediStock.IntegrationTests` |
| Agent | pytest + httpx `MockTransport` | `agent-service/tests` |
| React | Vitest + Testing Library | `web/src/**/*.test.tsx` (co-located) |
| Flutter | `flutter_test` | `mobile/test` |
| Performance | k6 | `performance/k6` |

## 2. What every member produces

For their own vertical:

- service unit tests
- validation tests
- controller / API tests
- authorization tests (which roles may and may not call each endpoint)
- integration tests
- React tests: rendering, form validation, routes, role restrictions, API success, API
  failure, loading, empty, pagination, search and filter
- Flutter tests: unit, widget, form validation, navigation, API, feature integration
- agent contract tests and the golden cases that touch their agent

## 3. Required individual evidence

| Member | Evidence |
| --- | --- |
| Vaisnavi L. (IT24102469) | Inventory API + DataMatrix + stock rules |
| Sathurstiga S. (IT24103156) | **Forecast + shortage calculations** |
| ILHAM MM (IT24103530) | Transfer + routing + transaction |
| Arudkumaran V. (IT24103011) | Procurement + validation + approval |
| All | The full end-to-end workflow |

## 4. Demand vertical coverage (this member)

### Forecast calculations — `ForecastCalculationTests`

Daily-series construction (gaps become zero; same-day records sum; records outside the
window are excluded), all three sanctioned methods, confidence, and the guard rails.
Every expected value is hand-computed in a comment above the assertion.

| Case | Input | Expected |
| --- | --- | --- |
| Moving average | 30 days at 20/day | 20/day, 600 over 30 days |
| Gaps lower the mean | `[20, 0, 0, 0]` | 5/day, not 20 |
| Weighted moving average | `[10, 20, 30]`, weights 1,2,3 | 140/6 = 23.3333 |
| Weighted on a flat series | 30 days at 20/day | equals the moving average |
| Simple trend | `[10,12,14,16,18]`, horizon 3 | 22/day (x = 5,6,7 → 20,22,24) |
| Trend never goes negative | `[50,40,30,20,10]`, horizon 30 | ≥ 0 |
| Confidence | 30 of 30 days observed | 1.0 |
| Confidence | 2 of 4 days observed | 0.5 |
| Unsupported method | `"NEURAL_NETWORK"` | throws |
| No history | empty series | 0, not an exception |

### Shortage calculations — `ShortageCalculationTests`

| Case | Input | Expected |
| --- | --- | --- |
| Blueprint worked example | stock 120, 20/day, lead 10 | 6 days, HIGH, transfer required |
| Ample stock | stock 400, 20/day, lead 10 | 20 days, MEDIUM, no transfer |
| Boundary: equal to lead time | stock 200, 20/day, lead 10 | 10 days, **no** alert |
| Boundary: one day short | stock 180, 20/day, lead 10 | 9 days, alert |
| Rounds down | stock 125, 20/day | 6 days, not 7 |
| No consumption | 0/day | `daysRemaining` null, no alert |
| Empty shelf | stock 0, 20/day | 0 days, stockout today, alert |
| Zero lead time | lead 0 | never requires a transfer |
| Negative input | any negative | throws |

The two boundary cases matter most: the rule is strictly `daysRemaining < leadTimeDays`,
so equality must not raise an alert.

### Validation, services and API

`DemandValidatorTests` covers every consumption, forecast and recalculation rule plus
paging normalisation. `DemandServiceTests` exercises filtering, pagination, clamping,
search, sorting and the full chain against a real `DbContext`. `DemandApiTests` covers
the seven contract endpoints, the role matrix, the success envelope, the error contract,
and the chain over HTTP.

### The chain, end to end

`DemandServiceTests.DemandChain_FromConsumptionToShortageAlert` and
`DemandApiTests.DemandChain_OverHttp_ProducesAShortageAlert` both walk:

```
consumption data → forecast → projected stockout → shortage alert
```

30 days at 20/day are recorded; with 120 units on hand and a 10-day lead time the derived
forecast gives 6 days of cover; 6 < 10 raises an alert traceable back to that forecast.

### Agent

`test_demand_agent.py` covers the worked example, tool-selection economy, safe failure,
bounded retries and prompt-injection refusal. `test_tool_permissions.py` covers the
allow-list. `test_schema_validation.py` covers the frozen output contract.
`test_coordinator.py` covers intent classification and demand delegation.

## 5. Running the suites

```bash
dotnet test backend/MediStock.sln
```

```bash
cd agent-service && python -m pytest -q
```

```bash
cd web && npm test
```

```bash
cd mobile && flutter test
```

## 6. Environment notes

- Backend tests use the EF Core in-memory provider, so no PostgreSQL server is needed in
  CI. Integration tests set the `Testing` environment, which skips startup seeding.
- Agent tests drive the real tool client over an httpx mock transport, so retry and
  error-mapping behaviour is exercised on the real path.
- React tests mock `@/services/demandApi` and disable query retries so failure assertions
  do not wait for backoff.
- Flutter tests override `demandRepositoryProvider` with a fake repository.

## 7. Verification status

| Suite | Verified on this machine |
| --- | --- |
| Backend unit (82 tests) | Yes — passing |
| Backend integration (12 tests) | Yes — passing |
| Agent (80 tests) | Yes — passing |
| React | Pending — awaiting `npm install` |
| Flutter | **Not verified** — the Flutter SDK is not installed on this machine |

The Flutter tests are written against the documented `flutter_test`, Riverpod and Dio
APIs but have not been executed. They must be run before this is treated as evidence.

## Not specified in the final blueprint

Coverage thresholds and naming conventions are not specified.

**Not specified in the final blueprint. Do not assume or introduce a new decision without
team-level confirmation.**

## Principles

1. **Deterministic business rules are tested as pure functions first.** Forecasting and
   the shortage rule are arithmetic. They are unit-tested directly, without a database
   or an HTTP layer, so a failure points at the rule rather than at the plumbing.

2. **The model is never the thing under test for a number.** Agent tests assert that the
   agent called the right tool and reported the tool's answer faithfully. They never
   assert that a language model computed something correctly.

3. **Every feature proves three states.** Loading, empty and error are required of every
   React and Flutter feature, not just the success path.

4. **Authorization is tested through the real pipeline.** Role tests issue a signed JWT
   and go through the application's own authentication middleware.

5. **Failure is a tested outcome.** Unreachable backends, timeouts and refused objectives
   have expected results, not undefined behaviour.
