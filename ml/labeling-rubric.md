# HintLint ML Labeling Rubric

## Purpose

Human labels define advisory behavior classes for ambiguous MCP tools. Labels must be based on source evidence when available, not declared annotations alone.

## Labels

- `read_only`: The tool only retrieves or computes information and does not mutate internal state or external systems.
- `writes_internal_state`: The tool creates, updates, archives, imports, syncs, or stores state controlled by the server or connected internal system.
- `external_side_effect`: The tool sends, publishes, calls a mutating external API, emails, pays, creates tickets, or otherwise affects a third party.
- `destructive`: The tool deletes, revokes, terminates, drops, overwrites, disables access, or performs a hard-to-recover action.
- `open_world`: The tool reaches a network, external service, user-controlled URL, cloud account, email provider, payment provider, or similar external boundary.
- `requires_human_approval`: A reasonable agent policy should require human approval before automatic invocation.

## Ambiguity Rules

- `archive`, `close`, `disable`, `suspend`, and `deactivate` are not automatically destructive; label based on reversibility and business impact.
- `sync`, `reconcile`, `submit`, `publish`, and `approve` often create external side effects. Use `requires_human_approval` unless source proves the action is read-only simulation.
- Source-backed static evidence overrides model intuition.
- Source-unavailable tools can be labeled for review, but cannot be labeled verified-safe.

## Review Requirements

- Two reviewers are required for examples used in public model metrics.
- Disagreements become `needs_review` until resolved.
- Package-level holdout must be preserved. Do not split tools from the same MCP server across train and validation.
- At least 500 manually reviewed tools are required before any model benchmark claim.
