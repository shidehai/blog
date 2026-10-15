#!/bin/sh
set -eu

# The official PostgreSQL entrypoint invokes this only for an empty data volume.
# psql reads the password from its environment, never from argv or SQL logs.
: "${CMS_DB_PASSWORD:?CMS_DB_PASSWORD is required for first initialization}"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv cms_password CMS_DB_PASSWORD
BEGIN;
CREATE ROLE blog_cms LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'cms_password';
CREATE SCHEMA author_cms AUTHORIZATION blog_cms;
COMMIT;
SQL
