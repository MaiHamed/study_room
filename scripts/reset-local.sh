#!/usr/bin/env sh
set -eu

# Rebuild the local Supabase database from migrations and seed.sql.
supabase db reset
