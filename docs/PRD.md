# Culpa — PRD

A web app for tracking debts within a small group of people. One creator (authenticated) manages entries; other participants view via a shared link in read-only mode.

> Domain glossary lives in [CONTEXT.md](../CONTEXT.md). The schema-collapse decision is in [ADR-0001](./adr/0001-unified-entry-no-debt-entity.md). This PRD assumes the language defined there.

## Roles

- **Creator** — authenticated via Supabase Auth (magic link). Creates Groups, manages Participants, full CRUD on Entries. Always also a Participant in their own Group.
- **Viewer** — anonymous. Accesses a Group via share link. Read-only. On first open, picks which Participant they are from the current Participant list; choice stored in localStorage for personalization only (no server-side claim, no consequences if misidentified). If the Participant they previously picked has since been removed, the next open forces a re-pick.

## Core concepts

### Group
- `title`
- `currency` (single ISO 4217 code, fixed at creation)
- `share_token` (unguessable, grants read-only access; rotatable by Creator)
- `creator_id` (owner)
- Holds N Participants and N Entries.

### Participant
A named person inside a Group. No authentication. Identified by display name only.

- **Add:** Creator may add at any time. Forward-only — new Participants are not retroactively inserted into past Entries.
- **Remove:** allowed only when the Participant has a **zero pairwise balance against every other Participant** in the Group. Removed Participants are hidden from new-Entry forms and the Viewer picker; historical Entries that reference them remain intact and still render their name.

### Entry
A single recorded transaction inside a Group. Has a title, a total amount, a payer, and one or more Shares. Two kinds, sharing the same schema:

- **Expense** — payer fronted money for a real-world cost; one Share per Participant who owes a piece.
- **Payment** — one Participant paid another directly to even up. Exactly one Share, at 100% to the recipient.

### Share
A row inside an Entry: which Participant owes how much to the Entry's payer.

- **Amount is the source of truth.** Percentage is derived for display (`share.amount ÷ entry.total × 100`).
- Sum of all Share amounts in an Entry must equal the Entry total — validated on write. No rounding drift.
- A "Split equally" UI helper fills amounts as `floor(total ÷ N)` and parks any remainder cents on the payer's own Share so the sum is exact.

### Pairwise balance (derived, not stored)
For any two Participants A and B in a Group:

```
balance(A → B) = Σ share.amount where paid_by=A and share.participant=B
               − Σ share.amount where paid_by=B and share.participant=A
```

Positive → B owes A. Negative → A owes B. Zero → square. Computed on read; no Debt table.

## Features

### Group management
- Create Group (Creator only): title, currency, initial Participants.
- Edit Group title.
- Add Participants (forward-only).
- Remove Participants (allowed only when all pairwise balances involving them are zero).
- Rotate share link (overwrites the token; old URL 404s immediately; no rotation history).
- Delete Group (cascade delete Participants, Entries, Shares).

### Entry management
- Create Expense: title, total amount, who paid (`paid_by`), Shares (one per Participant who owes; amounts must sum to total).
- Create Payment: title (optional), amount, who paid (debtor side), single recipient (creditor side). UI is simpler than Expense; data shape is identical.
- "Split equally" helper on Expense form: divides amount among selected Participants with floor + remainder-to-payer.
- Edit Entry: title, total, paid_by, Shares all editable. Pairwise balance recomputes automatically. No special handling needed for "settled" state — there is none.
- Delete Entry: plain row delete with Share cascade. Pairwise balance recomputes. If deleting a past Expense leaves a Participant in net credit (they paid for something that no longer exists), the Creator is responsible for recording a reversing Payment.

### Settlement
Settlement is **per pair**, not per Entry. To even up, the Creator records a Payment Entry going from the debtor to the creditor. To undo, delete that Payment Entry.

There is no "mark as paid / unpaid" affordance — those operations are replaced by recording or deleting a Payment Entry.

### Overview (per-Group view)
- List of Entries, most recent first.
- **Pairwise balance** section: every pair with a non-zero balance, e.g. *"Bob owes Alex €10"*.
- The Viewer's own balances are highlighted using their localStorage Participant pick.
- Simplified/netted view ("the minimum set of payments to clear the group") is **out of scope for v1**; it composes on top of the same data model and can be added later.

### History
A flat chronological list of Entries with kind (Expense/Payment), title, amount, payer, Shares, and timestamps. No per-Entry edit audit in v1 — the displayed state is current; `updated_at` indicates the row has been edited.

### Sharing
- One share link per Group, rotatable.
- Viewer opens link → "who are you?" Participant picker → choice stored in localStorage as `{ [groupId]: participantId }`.
- Viewer sees the same data as the Creator but cannot mutate.

## Data model

### Schema (Supabase / Postgres)

```sql
groups (
  id           uuid primary key,
  creator_id   uuid references auth.users,
  title        text not null,
  currency     text not null check (length(currency) = 3),
  share_token  text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
)

participants (
  id            uuid primary key,
  group_id      uuid not null references groups on delete cascade,
  display_name  text not null,
  removed_at    timestamptz,  -- set when the Creator removes the Participant
  created_at    timestamptz not null default now()
)

entries (
  id            uuid primary key,
  group_id      uuid not null references groups on delete cascade,
  kind          text not null check (kind in ('expense', 'payment')),
  title         text not null,
  total_amount  numeric(12,2) not null check (total_amount > 0),
  paid_by       uuid not null references participants,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
)

shares (
  entry_id        uuid not null references entries on delete cascade,
  participant_id  uuid not null references participants,
  amount          numeric(12,2) not null check (amount > 0),
  primary key (entry_id, participant_id)
  -- constraint: a Participant doesn't owe themselves
  -- (enforced in application logic; a payer's own "share" is excluded from the row set)
  -- constraint: sum of amounts for an entry = entry.total_amount
  -- (enforced in application logic and/or a transactional trigger)
)
```

Indexes:
- `entries (group_id, created_at desc)` — history list.
- `shares (participant_id)` — for balance queries.

### TypeScript types

```typescript
type UUID = string;
type ISODateTime = string;

interface Group {
  id: UUID;
  creator_id: UUID;
  title: string;
  currency: string;     // ISO 4217
  share_token: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

interface Participant {
  id: UUID;
  group_id: UUID;
  display_name: string;
  removed_at: ISODateTime | null;
  created_at: ISODateTime;
}

type EntryKind = 'expense' | 'payment';

interface Entry {
  id: UUID;
  group_id: UUID;
  kind: EntryKind;
  title: string;
  total_amount: number;  // 2 decimal precision
  paid_by: UUID;         // participant id
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

interface Share {
  entry_id: UUID;
  participant_id: UUID;
  amount: number;        // source of truth; percentage is derived for display
}

// Computed on the client/server for the Overview, not stored
interface PairwiseBalance {
  from: UUID;  // creditor (the one currently in the positive)
  to: UUID;    // debtor
  amount: number;
}

// localStorage
interface ViewerIdentity {
  [groupId: UUID]: UUID;  // groupId -> participantId
}
```

## Access control (RLS)

- **Creator** — full CRUD on Groups where `auth.uid() = creator_id`, and on Participants/Entries/Shares belonging to those Groups.
- **Viewer** — read-only on Group + Participants + Entries + Shares where `share_token` matches the token passed via `current_setting('app.share_token')`. No write paths exposed to Viewers.

## Refresh strategy

Viewers poll every 30 seconds while the tab is foregrounded, and immediately on tab focus / reconnect. No realtime subscription in v1. Creator's own mutations trigger immediate refetch of the affected Group on success.

## Platform

Mobile-first responsive web app. No PWA / installable / native in v1.

## Non-goals for v1

- Simplified ("Splitwise-style") balance reduction. Defer.
- Realtime updates via WebSockets. Defer.
- Multiple currencies per Group, FX conversion. Out.
- Receipts / image attachments on Entries. Out.
- Recurring / scheduled Entries. Out.
- Multiple share links per Group, or per-participant invite tokens. Out.
- Exporting (CSV / PDF). Out.
- Notifications (email / push) on activity. Out.
- Audit log of edits. Out — `updated_at` only.
- PWA install, offline support, native apps. Defer.
- OAuth / password sign-in (Magic link only in v1).
