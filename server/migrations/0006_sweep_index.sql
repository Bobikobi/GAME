-- The sign-in sweep runs on a timer (finding 10 of the 27.10 review) and deletes the sessions past their end
-- and the revoked ones. Without these it scans every session row once a minute.
create index sessions_expires on sessions (expires_at);
create index sessions_revoked on sessions (revoked_at) where revoked_at is not null;
