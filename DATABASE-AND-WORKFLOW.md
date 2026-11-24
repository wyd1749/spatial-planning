# Spatial Planning data and workflow (local JSON mode)

## Persistence
- `data/users.json`: staff accounts, password salts and scrypt hashes. Passwords are not stored in plaintext.
- `data/database.json`: applications, case notes, consultation responses, document register entries and activity audit events. Created on first start from the existing `lib/planning-data.json` starter data if it does not yet exist.
- JSON writes use a temporary file and rename for atomic file replacement; mutations in this server process are queued.

## Working modules
- Login / role redirect: Senior Officer, Management, Planning Officer
- Application register: search, register, open individual record
- Individual application record: stage/status/assignment (Management), notes, consultations, document register
- Management review: approve or return for amendment
- Consultation log: add and view responses linked to applications
- Reports: counts and breakdowns based on the saved applications
- Staff directory: role-appropriate view
- Senior Officer accounts: create staff accounts, save role changes, enable/disable accounts, export user list
- Dashboard: live application totals and activity events; export application register CSV

## Starter data
The first run imports the original sample applications from `lib/planning-data.json`. Replace those starter examples with actual department records before treating the reporting totals as official.


## File limitations
The document register stores metadata (name and notes) only. Actual file uploads/downloads are not implemented in this JSON-storage build. JSON storage is for local testing and small single-server trials, not multi-server/production deployment. For production, use a relational database, audit retention, backup/restore, and server-side authorization hardening.
