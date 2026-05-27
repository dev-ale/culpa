# Unified Entry concept; no Debt entity

The data model has a single transactional concept — the **Entry** — with two *kinds*: Expense (shared cost, multiple Shares) and Payment (one Participant pays another, one Share at 100%). There is no Debt table, no `settled_at` flag, no separate Payment entity that references a Debt. Pairwise balance is computed at read time from Entries alone.

## Considered options

- **Debt + Payment as separate entities.** Debts derived per Expense per debtor; Payments as immutable events referencing a Debt. Granular per-debt settlement, richer audit, but doubled schema and a settled/unsettled state machine to maintain.
- **Settled flag on Debt.** Simplest read model, but makes editing or deleting an Expense with paid Debts genuinely lossy (a flag is not a record of money changing hands).
- **Unified Entry (chosen).** Everything is an Entry. A "settlement" is just an Entry going the other way. Pairwise balance is `Σ(forward shares) − Σ(reverse shares)`.

## Why

For a friends-group debt tracker, settlement is *per pair*, not per individual obligation. People say "we're square" or "I owe you 20", not "I'll settle the dinner Debt but leave the brunch Debt open." Modelling that with derived Debts and event-style Payments produces accurate audit history but a more complex schema and a long tail of edge cases (editing settled Expenses, partial settlement, refund Payments). The unified Entry model collapses those edge cases — there's no settled state to inconsistently update, and editing or deleting an Expense doesn't have to special-case "what about its paid Debts." The cost is that Payments don't reference a specific Expense; we accept this because pairwise settlement is what users actually do.

## Consequences

- **No `Debt` table or type.** "Debt" survives only as informal UI copy for a positive pairwise balance.
- **No `settled_at`.** A pair is "square" iff their balance is zero.
- **Payment reversal = delete the Payment Entry.** No negative-amount Payments, no soft-delete.
- **Pairwise simplification (Splitwise-style minimal-transactions reduction) is deferred** but composes cleanly on top of this model.
