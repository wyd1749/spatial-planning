# Spatial Planning Management System

Modernized City of Mutare Spatial Planning portal. The system uses role-based sign-in and JSON files for local persistence.

## Local start (Windows / VS Code)
1. Install Node.js 20.9+.
2. Extract the archive and open the `spatial_work` folder in VS Code.
3. Open Terminal in that folder and run `npm install`.
4. Run `npm run dev`.
5. Browse to `http://localhost:3000`.

For a local development environment, the `SESSION_SECRET` development fallback is active. Set a long random `SESSION_SECRET` in `.env.local` before deployment. Do not use JSON files as the production database for a shared government system.


## Modules wired in this update
- Authentication and role redirects.
- Application register, search, registration, individual records.
- Management stage/status updates and approve/return review actions.
- Case notes, consultation responses, document metadata register.
- Live counts/reports and CSV exports.
- Staff directory and Senior Officer user account creation/role/status controls.
- Activity log records for application/user actions.


## JSON data
- `data/users.json` holds staff users and salted password hashes.
- `data/database.json` is generated on first API use; application/case/consultation/document/activity data persist there.
- The first-run database seeds from `lib/planning-data.json`. These seed entries are sample records; replace them with real department applications before relying on totals for official reporting.


## Production note
JSON file storage is intended for local demonstration and small single-server testing. It is not recommended for production multi-user concurrent workloads. For a proper deployment, migrate application and account data to PostgreSQL, configure backups and audit retention, and harden the session secret and server permissions.
