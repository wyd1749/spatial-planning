# Spatial Planning account setup

- Accounts are stored in `data/users.json`.
- Passwords are **not stored in plain text**. Each password is stored as a random salt plus a `scrypt` hash.
- The initial senior officer account is `seniorofficer@gmail.com`.
- Set `SESSION_SECRET` in `.env.local` before deploying. Use a long random value and never commit it.
- Add staff through the Senior Officer dashboard's Create a user form; their password is saved as a salted hash.

## Important limitation
JSON file storage is suitable for a single-instance local test, but it is not a reliable production database for multi-instance hosting, backups, concurrent writes, or large numbers of accounts. Use a proper database and a hardened authentication system before exposing the application publicly.
