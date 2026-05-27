# Culpa

A debt tracker for small groups of friends. One authenticated Creator records who paid for what; everyone else views read-only via a share link. Settlement is just another entry going the other way.

## Language

**Group**:
A container that holds a fixed set of Participants, a currency, and all Entries between them. Created by a Creator.
_Avoid_: trip, list, ledger

**Participant**:
A named person inside a Group. Not authenticated. Identified by display name only.
- **Add:** the Creator may add Participants at any time. New Participants are *forward-only* — they appear from the moment they're added; pre-existing Entries are untouched.
- **Remove:** allowed only when the Participant has a **zero pairwise balance against every other Participant** in the Group. Removed Participants disappear from the Viewer's "who am I?" picker and from new-Entry forms; historical rows that reference them remain intact (so their name still renders in past Entries).
_Avoid_: member, user, friend

**Creator**:
The authenticated person who owns a Group and has full edit rights on it. Always also a Participant in their own Group.
_Avoid_: admin, owner, host

**Viewer**:
An anonymous reader who reaches a Group through its share link. Read-only. On first open, picks which Participant they are from the group's current (non-removed) Participant list; the choice is stored in localStorage for personalization only and carries no authority. If their previously-picked Participant has since been removed, the next open forces a re-pick.
_Avoid_: guest, anonymous user

**Entry**:
A single recorded transaction inside a Group. Has a title, a total amount, a payer (`paid_by`), and one or more Shares. Two **kinds**:
- **Expense** — payer fronted money for a real-world cost; one Share per Participant who owes a piece (the payer's own portion may be included as a Share, but a Participant never owes themselves). Sum of all Share amounts equals the Entry total.
- **Payment** — one Participant paid another directly to even up. Exactly one Share, at 100% to the recipient. No real-world cost behind it; this is just money changing hands.

Both kinds share the same schema. The UI labels and forms differ, but the data model is uniform.
_Avoid_: transaction, line item, record. **Don't** use the word "debt" for an Entry — see Pairwise balance.

**Share**:
A row inside an Entry that says "this Participant owes this much to the Entry's payer." The **amount** is the source of truth. The percentage is derived for display only (`share.amount ÷ entry.total × 100`). The sum of all Shares in an Entry must equal the Entry's total — no rounding drift is possible because we never round on the way in. A "split equally" UI helper fills amounts using `floor(total ÷ N)` and parks any remainder cents on the payer's own Share.
_Avoid_: portion, allocation, share_percent (it's derived, not stored)

**Pairwise balance**:
For any two Participants A and B in a Group, a derived number computed from all Entries:
```
balance(A → B) = Σ share.amount where paid_by=A and share.participant=B  (B owes A)
               − Σ share.amount where paid_by=B and share.participant=A  (A owes B)
```
If positive, B owes A that amount. If negative, A owes B. If zero, they're square. There is no stored "Debt" entity — balance is recomputed on read.
_Avoid_: debt (the word "debt" is informal UI copy only; the model has no Debt row), IOU, ledger entry

**Share link**:
The single unguessable URL per Group that grants read-only access. The Creator can rotate it at any time via group settings; rotation overwrites the token and the previous URL 404s immediately. There is one valid token at a time and no rotation history.
_Avoid_: invite link, public link

## Flagged ambiguities

**"Paid"** appears in two distinct senses and must not be conflated in UI copy:
- `Entry.paid_by` — who advanced the money for *this specific Entry*. On an Expense it's the person who fronted the cost; on a Payment it's the person settling up.
- "Pay back" / "settle up" — recording a Payment Entry that reduces an existing pairwise balance.

Prefer **"fronted by"** for Expense payers; **"paid to"** for Payment recipients.

**"Debt"** is *not* a domain entity. It's informal UI copy for a positive pairwise balance. If you find yourself writing `debts` as a table name or `Debt` as a type, stop — you mean Entry or pairwise balance.

## Example dialogue

> **Dev:** Alex pays for dinner and splits it 3 ways with Bob and Michelle. What do I record?
>
> **Domain expert:** One Entry, kind=Expense. Title "Dinner", total €90, paid_by Alex. Three Shares — Alex €30, Bob €30, Michelle €30. The amounts sum to €90.
>
> **Dev:** Where does "Michelle owes Alex €30" live as data?
>
> **Domain expert:** Nowhere as a row. It's computed: balance(Alex → Michelle) reads the Entries and gets €30. Same for Bob.
>
> **Dev:** Now Michelle hands Alex €30 cash. What do I record?
>
> **Domain expert:** Another Entry, kind=Payment. Total €30, paid_by Michelle, one Share: Alex €30.
>
> **Dev:** Are Michelle and Alex square now?
>
> **Domain expert:** Yes. balance(Alex → Michelle) = +€30 − €30 = €0. Bob still owes Alex €30 from the dinner.
>
> **Dev:** What if Alex realises the dinner was actually €120 and edits the Expense?
>
> **Domain expert:** The Entry's total and Shares get edited. Michelle's Share becomes €40. Her €30 Payment Entry is untouched — she really did hand him €30. So balance(Alex → Michelle) = €40 − €30 = €10. She still owes him €10.
>
> **Dev:** And if Alex deletes the Dinner Entry?
>
> **Domain expert:** Plain row delete. Its Shares go away with it. Michelle's €30 Payment is a separate Entry, untouched. So balance(Alex → Michelle) = €0 − €30 = −€30. Alex now owes Michelle €30 — she paid him for a dinner that no longer exists. If that's wrong, Alex should record a Payment going the other way, or not have deleted the dinner.
