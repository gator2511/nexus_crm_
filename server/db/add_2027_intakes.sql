-- Nexus CRM demonstration intakes for the 2027 admissions cycle.
-- Repeatable: does not insert a second row for the same program and start date.
-- Run explicitly against the intended database; do not run schema.sql on populated data.
BEGIN;
WITH desired(name, start_date) AS (
  VALUES ('February 2027', DATE '2027-02-22'),
         ('July 2027', DATE '2027-07-19')
)
INSERT INTO intake(program_id,name,start_date,is_open)
SELECT p.id,d.name,d.start_date,TRUE
FROM program p CROSS JOIN desired d
WHERE p.is_active=TRUE
  AND NOT EXISTS (
    SELECT 1 FROM intake i
    WHERE i.program_id=p.id AND i.start_date=d.start_date
  );
COMMIT;

SELECT p.name AS program,i.name AS intake,i.start_date,i.is_open
FROM intake i JOIN program p ON p.id=i.program_id
WHERE i.start_date IN (DATE '2027-02-22',DATE '2027-07-19')
ORDER BY p.name,i.start_date;
