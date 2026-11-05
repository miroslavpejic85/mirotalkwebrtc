# MongoDB migrations

![mongo](./mongodb.png)

`NPM`: https://www.npmjs.com/package/migrate-mongo

## Installation

```bash
$ npm install -g migrate-mongo
```

## CLI Usage

```bash
$ migrate-mongo
Usage: migrate-mongo [options] [command]


  Commands:

    init                  initialize a new migration project
    create [description]  create a new database migration with the provided description
    up [options]          run all unapplied database migrations
    down [options]        undo the last applied database migration
    status [options]      print the changelog of the database

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

## Config

Copy the `migrate-mongo-config-template.js` to `migrate-mongo-config.js` and Change (or review) the `config` acording to your MongoDB.

## Backup & restore

### Full database backup (recommended)

The users export below only covers the `users` collection. Rooms, events, bookings and invitations live in other collections, so schedule a full MongoDB backup for disaster recovery:

```bash
# Backup
$ mongodump --uri="mongodb://<user>:<password>@<host>:27017" --db=mirotalk --out=./backup-$(date +%F)

# Restore
$ mongorestore --uri="mongodb://<user>:<password>@<host>:27017" --db=mirotalk ./backup-<date>/mirotalk
```

On MongoDB Atlas, enable Cloud Backup snapshots instead.

### Users export / import (admin panel)

In **Users**, admins can:

- **Export** (download icon): saves a JSON backup of all users, or only the users matching the current search and filters. The file keeps each user's `_id`, password hash, plan and Stripe IDs, so restored users can sign in with their existing password. Session and password-reset tokens are never exported. Treat the file as sensitive.
- **Import** (upload icon): restores users from that JSON file. A preview shows how many users will be created, skipped or rejected before anything is written. Existing users are never modified: users whose email, `_id` or Stripe IDs already exist are skipped, so the same file can be imported repeatedly. Maximum file size is 20 MB.
- **Stripe re-sync** (automatic, when SaaS/Stripe is enabled): right after an import, every restored user linked to Stripe is checked against Stripe so the backup can't restore stale billing. Recurring plans get their current plan, status and expiry; Lifetime plans whose payment was refunded or disputed are canceled; links to Stripe customers or subscriptions that no longer exist are removed (e.g. a user that was deleted from the admin panel, which also deletes their Stripe customer). No emails are sent. The import summary lists every user that changed or failed.

API: `GET /api/v1/user/export`, `POST /api/v1/user/import` with `{ "backup": <file>, "dryRun": true|false }` and `POST /api/v1/stripe/sync-users` with `{ "ids": [<userId>, ...] }` (max 50 per request) — all admin only.
