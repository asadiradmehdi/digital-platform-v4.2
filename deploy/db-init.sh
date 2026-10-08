#!/bin/bash
# First start of the database volume only: application role without superuser or BYPASSRLS, so every
# row-level-security policy applies to the app exactly as in the tests.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username postgres <<SQL
CREATE ROLE zp_app LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE DATABASE zohalpay OWNER zp_app;
\c zohalpay
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
