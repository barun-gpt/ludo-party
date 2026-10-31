# Ludo Party server
Zero-dependency Node 22.13+ server: accounts (email/password, Google, Facebook), coin/progress sync, worldwide leaderboard, privacy + delete-account pages.
It MUST run behind HTTPS (Android blocks plain http) and MUST keep its database on a persistent disk.

Run locally:  `node index.js`   (data in ./data/ludo.db)  ·  check: http://localhost:8080/health

Environment variables
- PORT (default 8080), DB_PATH (default ./data/ludo.db; the Dockerfile uses /data/ludo.db -> mount a volume on /data)
- GOOGLE_CLIENT_ID = your Google *Web* OAuth client ID
- FACEBOOK_APP_ID, FACEBOOK_APP_SECRET  (the secret lives ONLY here, never in the app)
- CONTACT_EMAIL, APP_NAME  (shown on the privacy page - set the real email!)
- ALLOW_TEST_SOCIAL=1  (local testing only - never in production)

Leaderboard integrity: points only go up and are accepted at a human pace (burst 4,000, then 25 points/minute),
see CREDIT_MAX / CREDIT_PER_MIN in index.js. A tampered app cannot jump to #1.

Backup (safe while running):
  docker exec ludo node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/ludo.db').exec(\"VACUUM INTO '/data/backup-$(date +%F).db'\")"
  docker cp ludo:/data/backup-$(date +%F).db .
