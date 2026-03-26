# Source Registry Deferred Metadata v1

This list is explicit on purpose. The MVP contract is not missing these items by accident. They are deferred to keep MP-47 scoped to the minimum operational registry needed for launch truth, confidence, freshness, and suppression.

## Deferred From `source_definition`

- `what_it_is`
- `what_it_is_not`
- `primary_use_cases`
- `prohibited_use_cases`
- `expected_completeness`
- `accuracy_statement`
- `accuracy_basis`
- `known_provider_contacts`
- `licensing_class`
- `redistribution_rights`
- `attribution_requirements`
- `source_homepage_url`
- `documentation_url`

## Deferred From `source_version`

- provider download URL
- archive location
- row-level checksum manifests
- ingestion snapshot IDs
- schema-diff details beyond a short change note
- full change audit history

## Deferred From `source_runtime_status`

- runtime-status history tables
- per-attempt ingest logs
- alert-delivery destinations
- ticket links
- automated incident ownership routing
- field-level completeness metrics
- per-geography completeness breakdowns

## Deferred From `source_dependency_rule`

- free-form policy prose as authoritative behavior
- expression-language support
- nested boolean rule groups
- metric-to-metric lineage trees
- field-level rule overrides
- operator-specific exception tables

## Deferred System Capabilities

- analyst-facing Source Registry UI
- dashboards and monitoring products
- full publish command implementation
- automatic contract migration tooling
- field-level lineage explorer
- external documentation generator

## Deferred Only If Needed Later

- finer-grained geography coverage classes
- richer truth-mode vocabulary
- per-surface copy templates
- confidence operator formulas in registry tables
- restricted-dataset legal review metadata

If any deferred item becomes necessary for `MP-53` or later tickets, it should be added through a deliberate contract revision rather than quietly expanding the MVP shape.
