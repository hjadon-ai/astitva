# F018: Family relationship, invitation, and access rules

**Status:** Approved by the owner. Decisions 1–4 were confirmed; implementation is ready for Stage manual review.

## 1. Two groups from each person's perspective

The signed-in person is shown as **Self**. Family members appear in groups relative to that person:

| Group | Allowed relationship | Visible labels |
| --- | --- | --- |
| Born in family | Parent or sibling | Father, mother, parent; brother, sister, sibling |
| Spouse family | Partner or child | Husband, wife, partner; son, daughter, child |

The person adding a relationship chooses its label; the application does not infer gender from a name or email. A partner, parent, or child sees the same connected people with labels recalculated from their own viewpoint. For example, a father sees his son in Spouse family, and the son sees his father in Born in family.

## 2. Shared view, limited relationship model

- Each person can have **one current partner**. Multiple or former partners are outside F018.
- A partner pair has one shared Spouse family view. A child added to that shared family appears as a child for both partners. The spouse sees the same children after accepting the invitation.
- No shared-parent, half-sibling, stepchild, or custody model is included now. Sibling relationships are entered explicitly; they are not inferred from parent records.
- A spouse's parents are not automatically shown as the viewer's parents. Each person has their own Born in family view.
- A family person has one identity in the shared view, even if different relatives see different relationship labels.

| Signed-in person | Self label | Born in family | Spouse family |
| --- | --- | --- | --- |
| Husband | Self | His parents and explicitly linked siblings | Wife and their children |
| Wife | Self | Her parents and explicitly linked siblings | Husband and the same children |
| Son | Self | His parents and explicitly linked siblings | His own partner and children, if any |
| Father | Self | His parents and explicitly linked siblings | His partner and children |

## 3. Invitations and account linking

1. An ADMIN or EDITOR may add a family person with a name and relationship. The person may initially be a **NON_USER**, with no Astitva account and no sign-in access to the Family view.
2. A NON_USER can be invited later, for example when a child becomes old enough to create an account. An email is required when the invitation is sent, but not when the person record is first created.
3. The invitation is tied to the specific family person record. The recipient must verify the email on their Astitva account **and accept the invitation** before the account is linked and the shared Family view becomes visible.
4. Before sending, the server checks `users` for an existing account with the invitation email and directs the recipient to sign in or create an account accordingly. It also records the normalized email in `invitedEmails` so a new recipient can sign up in Production. A matching email alone never activates a link. An unverified account or an invitation that has not been accepted remains pending.
5. After acceptance, the invited person sees **Self** and the same connected family from their own perspective. The existing NON_USER record becomes the linked person; it is not duplicated.
6. An unrelated account cannot see or edit the family. Family linking alone never shares Diet, Finance, priorities, passwords, or other private account data; Diet and Finance require the owner's separate sharing choice below.
7. If an email matches multiple user records or multiple family person records, automatic linking stops for review. Changing a linked email requires a new verified invitation flow.

## 4. Access roles

Roles apply only to family-member records, not to unrelated Astitva users. The creator starts as **ADMIN**. An invited member starts as **READONLY** unless the creator has assigned a higher role to that person. Only the creator may grant or revoke **EDITOR** or **ADMIN** for another family member. A role may be assigned to a NON_USER record in advance, but it grants no app access until that person has a verified account and accepts an invitation.

| Action | Creator (ADMIN) | Additional ADMIN | EDITOR | READONLY | NON_USER without accepted invite |
| --- | --- | --- | --- | --- | --- |
| View connected family from own perspective | Yes | Yes | Yes | Yes | No sign-in access |
| Add or edit a family person or relationship | Yes | Yes | Yes | No | No |
| Remove a family relationship | Yes | Yes | No | No | No |
| Create the Born in or Spouse family view from own perspective when a shared family already exists | Yes | Yes | Yes | No | No |
| Send invitations | Yes | Yes | No | No | No |
| Grant or revoke ADMIN or EDITOR | Yes | No | No | No | No |

READONLY members can see their connected family, including reciprocal labels and shared children, but cannot create a family type or change its members from their own perspective. An ADMIN or EDITOR can add or edit; only an ADMIN can remove a relationship. Removing a family relationship does not delete anyone's Astitva account.

## 5. Optional Diet and Finance sharing

- Each member controls their **own** Diet and Finance information. They may choose to share either feature with specific family members whose invitations have been accepted.
- Sharing defaults to **no recipients**. The owner selects recipients separately for Diet and Finance; enabling one does not enable the other.
- A family role does not automatically grant access to Diet or Finance. ADMIN and EDITOR rights on the family graph do not grant access to another person's private feature data.
- A recipient may view only the feature and owner that were shared with them. They cannot create, edit, delete, connect, sync, or disconnect anything in the owner's Diet or Finance account. The owner keeps full control of their own data.
- The owner may stop sharing at any time; access should stop immediately. If a recipient leaves the family or loses their accepted membership, sharing access stops.
- A NON_USER or pending invite cannot view shared data. Invitations and email matching alone do not grant access.
- Finance sharing is for displayed account, balance, transaction, and holding information only. Bank credentials, Plaid access tokens, and connection management are never shared.
- This is a separate permission from family ADMIN, EDITOR, and READONLY. Future edit access would require another reviewed feature.

## 6. Examples

- **Husband and wife:** The husband creates a wife record and sends an invitation. After the wife verifies her email and accepts, she sees herself as Self and him as husband. She starts READONLY. The creator can promote her to EDITOR or ADMIN.
- **Child:** An ADMIN or EDITOR adds a son to the shared Spouse family. Both partners see him as son. When he later receives and accepts an invitation, he sees the linked parents in Born in family and starts READONLY unless a higher role was assigned to his NON_USER record.
- **Parent:** A user adds a father. Once the father accepts an invitation, he sees the user as a child in his Spouse family. His own parents and siblings belong in his Born in family, if explicitly added by someone with write access.
- **Sibling:** A brother or sister is linked explicitly. Each sees the other under Born in family after accepting an invitation. Adding two children to a parent does not silently create a sibling link.

## 7. Approved decisions

1. Only family members can receive active EDITOR access, and only the creator grants or revokes EDITOR or ADMIN. A NON_USER designation is inactive until invitation acceptance.
2. Children in the shared Spouse family are visible to both accepted partners regardless of role. Adding or changing children requires ADMIN or EDITOR.
3. Removing a family relationship requires ADMIN; EDITOR cannot remove one.
4. Diet and Finance sharing starts with no recipients. Each owner chooses recipients separately for each feature.

## 8. Implementation boundary

The invitation lifecycle, role checks, sharing checks, API contract, and database schema are implemented in the existing server and web app for Stage manual review. No separate Render service is part of F018.
