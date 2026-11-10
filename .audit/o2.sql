SELECT provider, status, COUNT(*) AS n,
  SUM(CASE WHEN instr(email, '@example.') > 0 OR instr(email,'@test') > 0 OR instr(email,'@localhost') > 0 THEN 1 ELSE 0 END) AS obvious_test,
  COUNT(DISTINCT substr(email, instr(email,'@')+1)) AS distinct_domains
FROM orders GROUP BY provider, status;
