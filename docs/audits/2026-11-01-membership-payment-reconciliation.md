# Township Rollers FC — Membership and Payment Reconciliation Audit

**Audit date:** 2026-11-01  
**System:** `rollersfc.bitsaguru.com`  
**Repository:** `LukeMolly/popa`  
**Database inspected:** Neon `township-rollers-db` (`icy-lab-50830795`)  
**Scope:** Read-only inspection of member and payment tables and their reconciliation.  
**Change control:** No member records, payment statuses, existing approval logic, schema, deployment settings, or production code were modified.

## Confirmed database counts

| Measure | Count |
| --- | ---: |
| Registered members | 167 |
| Active members | 13 |
| Pending members | 154 |
| Payment records | 25 |
| Approved payment records | 7 |
| Submitted payment records | 18 |

## Member/payment reconciliation

| Member status | Payment record classification | Members |
| --- | --- | ---: |
| Active | Approved payment recorded | 7 |
| Active | Only submitted payment recorded | 2 |
| Active | No payment record | 4 |
| Pending | Submitted payment, not yet approved | 16 |
| Pending | No payment record | 138 |

**Interpretation:** A missing uploaded proof of payment or payment record does not establish non-payment. The existing administrator-approved offline payment process can activate a membership without a portal POP upload. Investigate the six active memberships not accompanied by an approved payment record before considering any correction.

## Data-integrity findings

- The dashboard's 167 = 13 + 154 membership figures agree with the database.
- No pending member had an approved payment record.
- No orphaned payment records were found.
- No member had more than one payment record.
- All 25 payment records had the amount of P200.
- One pending member had an identity-risk flag and no payment record.
- The seven approved payments had non-empty `reviewed_at` timestamps but empty `reviewed_by` fields; audit attribution requires investigation. Do not automatically fill these using assumptions.
- Sixteen pending members have a submitted payment record; these should be prioritized for manual verification.
- Of 16 submitted payments attached to pending members, nine have receipt attachment metadata and ten contain references. These groups may overlap.
- Payment status is not the same as membership status. Two active members have submitted-only payment records; this may be due to manual/offline administration, but needs reconciliation.

## Operational recommendations (not automatically executed)

1. Review and reconcile the 16 pending members with submitted payment evidence.
2. Verify supporting offline approval records for the four active members without payment records and the two active members with submitted-only payments.
3. Review the single flagged pending registration using the existing identity-review workflow.
4. Validate that **future** administrator approvals reliably record the responsible actor, without changing the already-working approval/activation semantics.
5. Verify member activation notifications and payment reminders through separately authorized, non-destructive preview testing.
6. Do not bulk-approve, automatically mark members unpaid, overwrite historical attribution, or modify production without explicit authorization and verification.

## Repeatable read-only validation queries

```sql
-- Membership totals
SELECT status, COUNT(*) AS members
FROM members
GROUP BY status
ORDER BY status;

-- Payment counts and amounts
SELECT status, amount, COUNT(*) AS payments
FROM payments
GROUP BY status, amount
ORDER BY status, amount;

-- One row per member, categorized by available payment evidence
WITH member_payments AS (
  SELECT m.id, m.status,
         COUNT(p.id) AS payment_count,
         COUNT(p.id) FILTER (WHERE p.status = 'approved') AS approved_count,
         COUNT(p.id) FILTER (WHERE p.status = 'submitted') AS submitted_count
  FROM members m
  LEFT JOIN payments p ON p.member_id = m.id
  GROUP BY m.id, m.status
)
SELECT status,
       CASE
         WHEN approved_count > 0 THEN 'approved_payment'
         WHEN submitted_count > 0 THEN 'submitted_payment_only'
         WHEN payment_count = 0 THEN 'no_payment_record'
         ELSE 'other_payment_status'
       END AS payment_class,
       COUNT(*) AS members
FROM member_payments
GROUP BY status, payment_class
ORDER BY status, payment_class;

-- Orphaned payment records
SELECT COUNT(*) AS orphaned_payments
FROM payments p LEFT JOIN members m ON m.id = p.member_id
WHERE m.id IS NULL;

-- Multiple records per member
SELECT COUNT(*) AS members_with_multiple_payments
FROM (
  SELECT member_id
  FROM payments
  GROUP BY member_id
  HAVING COUNT(*) > 1
) grouped;

-- Pending members with approved payments
SELECT COUNT(*) AS pending_with_approved_payments
FROM members m
WHERE m.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.member_id = m.id AND p.status = 'approved'
  );

-- Approved payments with missing review attribution
SELECT COUNT(*) AS approved_without_reviewer
FROM payments
WHERE status = 'approved'
  AND TRIM(reviewed_by) = '';
```

## Restrictions and interpretation

This document is a snapshot of one database inspection on 2026-11-01, not an application change or full end-to-end test. Reconciliation exceptions are **investigation candidates**, not confirmed bugs or evidence of fraud. The offline payment approval and member activation workflow was reported by the product owner as working; it must not be altered without a separately validated change request.
