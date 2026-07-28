# Security and privacy

## First-slice threat model

Assets and notes are sensitive local data. Risks include accidental upload,
temporary URI expiry, unintended publication, analytics leakage, and malformed
persisted records.

## Controls

- Photo permission is requested in context after education.
- Confirmed photos are copied into private app documents storage.
- No network upload occurs.
- Memory visibility defaults to private; publication is unavailable.
- Analytics contracts exclude URI, image bytes, note, and location.
- Persisted JSON is schema-validated on every read.
- `.env*` is ignored except `.env.example`.

Before cloud sync: add Supabase RLS and storage policy tests, strip EXIF before
public upload, issue signed URLs, isolate provider tokens, add account deletion and
portable data export jobs.
