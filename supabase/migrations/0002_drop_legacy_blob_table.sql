-- Run this only after confirming the new tables (0001_schema.sql) are live
-- and all users have migrated off the old whole-blob sync (see README.md).
drop table if exists taalib_state;
