# Astitva Family Model --- Brainstorming Reference

**Status:** Brainstorming / Reference\
**Purpose:** Preserve the family-model decisions agreed during B001
discussions.\
**Important:** This document does **not** replace or rewrite `B001.md`,
does not represent implementation, and does not mark any feature
Approved.

## 1. Core Model

Astitva should model family as a **family graph containing multiple
family units**, rather than assuming that every user belongs to one
single family.

A family unit exists in Astitva only when relationships are explicitly
established through actions such as adding a member, inviting someone,
accepting a relationship, or linking an existing user.

Astitva should not infer real-world family relationships automatically.

A person may participate in multiple family units.

## 2. Family Context Is Relative to the Person

Terms such as **Born-in Family** and **Spouse/Formed Family** describe a
person's relationship to a family unit. They are not necessarily
permanent intrinsic types of the family record itself.

Example:

-   A's original family containing A's parents and siblings is A's
    Born-in Family.
-   A + B + C + D is A's Formed/Spouse Family.
-   The same A + B + C + D family is C's Born-in Family.
-   If C later forms a family with J, C + J becomes C's Formed/Spouse
    Family.

Therefore, the same stored family unit may have different meaning
depending on the logged-in member.

## 3. Relationship First, Family Context Derived

When adding a member, the user should provide the **relationship
first**. Astitva determines the appropriate family context from that
relationship.

Examples:

-   Father / Mother / Brother / Sister → Born-in Family
-   Wife / Husband / Partner → Formed/Spouse Family
-   Son / Daughter → Formed Family

The user should not normally have to choose "Born-in" or "Spouse Family"
before choosing the relationship.

## 4. A Formed Family Does Not Require a Spouse

Internally, "Formed Family" is a more general concept than "Spouse
Family."

Example:

A adds C as Son while A has no spouse in Astitva.

Astitva may establish:

    Formed Family X
    A
    C — Son

Later A adds B as Wife.

B joins the same family:

    Formed Family X
    A
    B — Wife
    C — Son

This supports single-parent and other valid family structures without
requiring a spouse to exist first.

The final user-facing terminology is still open to refinement.

## 5. Shared Family, Different Views

A and B should not receive duplicate spouse/formed-family records merely
to produce different views.

If A and B share Family X containing A, B, C, and D, both participate in
the **same family unit**.

When A logs in, A sees:

-   A's Born-in Family
-   A's Formed/Spouse Family

When B logs in, B sees:

-   B's Born-in Family
-   the same shared Formed/Spouse Family

Relationship labels and family context are rendered relative to the
logged-in person.

## 6. Partner's Born-in Family Is Separate

Suppose B's Born-in Family contains K, L, and M.

A's normal family view should **not** automatically display K, L, and M
merely because A is married to B.

A's formed family may internally maintain a structural reference to B's
Born-in Family for future capabilities, but:

-   B's born-in members are not copied into A's formed family.
-   The current UI does not traverse that reference.
-   The reference does not automatically expose those family members to
    A.

## 7. Permissions Are Independent of Relationships

Family relationship and authorization are separate concepts.

Supported family roles should include:

-   **ADMIN**
-   **EDITOR**
-   **READONLY**

Example:

If A creates Family X, A is initially ADMIN.

B may be ADMIN, EDITOR, or READONLY according to granted permissions.

Being A's wife or C's mother does not automatically give B permission to
edit family data.

If B is READONLY, B cannot modify A, C, or D merely because B is their
spouse/parent.

Private feature data and sharing outside the basic family profile remain
separately permission-controlled.

## 8. Joining an Existing Formed Family

If A already has a formed family and B does not:

    Family X
    A — ADMIN
    C — Son
    D — Daughter

A can invite B as Wife.

After B accepts, B joins **Family X**. Astitva should not create another
formed family for B.

B's authorization role can be ADMIN, EDITOR, or READONLY according to
the family permission flow.

## 9. Independent Representations of the Same Family

It is possible for two users to independently create family units that
later prove to represent the same real family.

Example:

    Family X
    A — ADMIN
    D — Daughter

    Family Y
    B — ADMIN
    C — Son

If A and B confirm their spouse relationship and the two units are
confirmed to represent the same formed family, the family units may be
combined.

Important rules:

-   Both existing ADMINs remain ADMIN after the family-unit combination.
-   One creator does not lose authority simply because one underlying
    family record survives.
-   Only the relevant family units are combined.
-   B's Born-in Family must not be pulled into A+B's formed family.
-   Family-unit combination does not imply automatic person
    deduplication.

## 10. Born-in Family Collision / Family-Unit Merge

A person should not end up with multiple active family units that both
represent the same Born-in Family.

Example:

C independently creates a Born-in Family containing A/B.

A already participates in the established family containing A/B/C/D.

When C connects to A and the relationship confirms that the two units
represent the same family, the **family units should be
merged/combined**, subject to appropriate consent.

Afterward, ADMINs and EDITORs review the resulting family.

## 11. Family Merge Consent — Confirmed Owner Decision

Combining two existing family units requires **explicit acceptance from
one ADMIN in each family**. Until both approvals are recorded, the
families remain separate and unchanged. A non-ADMIN's relationship
acceptance does not authorize a family-unit merge.

1. The relationship request identifies the affected family units and
   explains the proposed combination.
2. An email notification tells the recipient that an action is waiting.
3. Opening the email link leads to Astitva. After sign-in, opening that
   link or refreshing the browser/app loads the pending request and
   displays an **Accept** button to the authorized reviewer.
4. Each required ADMIN reviews the family impact and explicitly accepts
   inside Astitva. The app clearly shows which side is still awaiting
   approval.
5. Combination occurs only after one ADMIN from each family accepts and
   applicable relationship/security checks pass. Existing ADMINs retain
   their authority after combination.

**In-app acceptance is the consent mechanism; email is notification.**
Opening a link, refreshing, registration or verified email never counts
as acceptance. Relationship consent and family-merge authorization are
separate when the relationship recipient is not an ADMIN. No live-update
subscription is required merely to show a request after refresh.

## 12. No Automatic Person Deduplication

Astitva should **not automatically identify or merge individual family
members** merely because names or relationships look similar.

Example:

A independently added:

    C1 — NON_USER — Son

B independently added:

    C2 — NON_USER — Son

If their family units are later combined, both records may temporarily
remain.

Astitva should not silently conclude that C1 and C2 are the same person.

An ADMIN or appropriately authorized EDITOR reviews the records
manually.

## 13. Manual Duplicate Cleanup

When duplicate-looking member records exist:

1.  ADMIN/EDITOR reviews them.
2.  Authorized user updates/copies useful family information to the
    record that should remain.
3.  Only an **ADMIN** manually deletes the unwanted NON_USER member,
    after related data and references have been handled safely. EDITOR
    may review/edit permitted family details but cannot delete members.

There is no automatic person-data merge.

Deletion must not delete a linked Astitva account or unrelated private
user data.

## 14. Existing NON_USER Later Becomes an Astitva User

Suppose A previously added C as:

    C — NON_USER — Son

Years later C creates an Astitva account.

Astitva must not link the new account to the NON_USER record solely by
matching a name.

The family members should explicitly review the relationship/linking.

If the new account is determined to correspond to the existing member,
the account can be linked through the approved flow.

If both the linked-user member and old NON_USER member temporarily
coexist, ADMIN/EDITOR can review them. Only ADMIN may manually delete
the unwanted NON_USER record after related data/references are handled.

There is no automatic person merge.

## 15. Existing User Requests Relationship

Suppose C is already an Astitva user and A has:

    Family X
    A
    B
    D — Daughter

C searches for A and requests:

    A is my father

After A approves, C is added to the existing Family X as A's child.

From C's perspective, that same Family X is C's Born-in Family.

If A had previously created a NON_USER C, the authorized family members
can review the two records; only ADMIN may delete the obsolete NON_USER
entry after safely handling its related data/references.

## 16. Inviting a Person Who Does Not Yet Have an Account

Example: A adds B as Wife and B has no Astitva account.

Agreed flow:

1.  A enters B's name and email.
2.  B exists in the family as a NON_USER.
3.  Astitva sends an invitation email.
4.  B registers and verifies the email.
5.  Astitva can proceed through the explicit linking/review flow.
6.  B reviews and accepts the family relationship.

Registration or email verification alone does **not** mean B accepted
the relationship.

A useful lifecycle concept is:

    NON_USER
        ↓ invitation
    INVITED
        ↓ registration + verification
    VERIFIED USER
        ↓ relationship consent
    LINKED FAMILY MEMBER

Exact persisted status names can be decided during data-model/API
design.

## 17. Greenfield Placement Rule

Astitva is still greenfield enough that it should establish correct
family placement rules now instead of building broad migration logic for
incorrectly classified historical families.

Examples:

-   B adds K as Father → B's Born-in Family.
-   B adds C as Son → B's appropriate Formed Family.
-   Connecting A and B must not drag B's father K into A+B's Formed
    Family.

This keeps Born-in and Formed family boundaries explicit from creation
time.

## 18. Important Distinction: Family Merge vs Person Merge

These are different operations.

### Family-unit merge

Allowed when consent establishes that two family units represent the
same family.

The memberships/relationships can be brought into one shared family unit
for review.

### Person merge

Not automatic.

Two member records that may represent the same human remain separate
until authorized users review and manually resolve them.

This distinction is central to the current design.

## 19. Declined Relationship — Confirmed Owner Decision

If B registers, verifies the email and then declines A's relationship
request, **nothing changes in the original family representation**:

- A's original NON_USER record of B remains unchanged.
- No account link or family-unit combination occurs.
- B's account remains independent; verification is not consent.
- Do not delete, relabel or otherwise change the NON_USER member because
  of the decline.

This decision concerns family/member state. The invitation/request must
record the decline so it cannot later be treated as accepted. Detailed
request-history presentation, notifications and resend rules belong in
the feature proposal; no additional policy is inferred here.

## 20. Scope and Remaining Design Work

The owner has resolved the three discussion decisions: decline leaves
the NON_USER record unchanged, deletion is ADMIN-only, and a family-unit
merge requires one ADMIN acceptance from each family.

This reference is not implementation approval. A Proposed feature must
still specify the family-unit data model, APIs, request lifecycle,
role/creator handling, reference preservation, concurrency and failure
behavior, UI wireframe and observable acceptance criteria. It must
explicitly reconcile superseded F018 rules without granting broader
private-data access.

Duplicate-looking people may remain separate for manual review after a
safe family-unit combination. This differs from blocking every family
merge on possible person duplicates. Invalid relationship structures or
unsafe data/reference handling must not be silently accepted; the
proposal must define those blockers separately from manual cleanup.

------------------------------------------------------------------------

## Notes for Future B001 Revision

When B001 is eventually rewritten, its current broad "merge populated
family graphs" idea should be reconsidered.

The emerging model is more precise:

-   multiple family units;
-   relationship-first family placement;
-   contextual Born-in/Formed meaning;
-   shared family units rather than duplicated views;
-   explicit consent for family-unit combination;
-   permissions independent of relationship;
-   no automatic person deduplication;
-   manual duplicate-member cleanup.

Do not update B001 from these notes until the family-model brainstorming
is complete and explicitly requested.
