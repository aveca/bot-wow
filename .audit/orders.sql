SELECT provider, status, COUNT(*) AS n, SUM(amount) AS cents,
       MIN(datetime(created_at/1000,'unixepoch')) AS first_seen,
       MAX(datetime(created_at/1000,'unixepoch')) AS last_seen,
       SUM(CASE WHEN instr(metadata, char(34)||'mode'||char(34)||':'||char(34)||'test') > 0 THEN 1 ELSE 0 END) AS mollie_test,
       SUM(CASE WHEN instr(metadata, char(34)||'mode'||char(34)||':'||char(34)||'live') > 0 THEN 1 ELSE 0 END) AS mollie_live
FROM orders GROUP BY provider, status ORDER BY provider, status;
