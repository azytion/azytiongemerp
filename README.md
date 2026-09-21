# Azytion GemERP

Web-based gemstone POS and inventory management (Next.js 16 + MySQL).

## Quick start

### 1. Start MySQL

```bash
docker compose up -d
```

Or use an existing MySQL 8+ server.

### 2. Configure environment

Copy `.env.example` to `.env.local` and set MySQL credentials:

```bash
DATABASE_URL=mysql://root:password@localhost:3306/zationgemerp
JWT_SECRET=your-strong-random-secret
SECRET_KEY=your-strong-random-secret
UPLOAD_DIR=./public/uploads
```

### 3. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database schema is created automatically on first request.

**Development default users** (non-production only):

| User    | Password |
|---------|----------|
| admin   | admin    |
| manager | manager  |
| cashier | cashier  |

## Production deployment

Deploy to a VPS or any Node.js host with:

- MySQL 8+ (managed or self-hosted)
- Persistent `UPLOAD_DIR` for product images
- Strong secrets: `JWT_SECRET`, `SECRET_KEY`, `CRON_SECRET`, `SETUP_SECRET`

Required variables:

```bash
JWT_SECRET=...
SECRET_KEY=...
DATABASE_URL=mysql://user:pass@host:3306/zationgemerp
UPLOAD_DIR=/var/data/uploads
CRON_SECRET=...
NEXT_PUBLIC_BASE_URL=https://your-domain.example
```

### Database init

Schema runs automatically. To force re-init in production:

```bash
curl -H "x-setup-secret: $SETUP_SECRET" https://your-domain/api/setup
```

### Backups

- **Manual:** Super admin → Settings → backup downloads a `.sql` file
- **Cron:** `GET /api/cron/backup` with `Authorization: Bearer $CRON_SECRET`

## Architecture changes (SQLite → MySQL)

- `better-sqlite3` replaced with `mysql2` connection pool
- Async database API (`await getDb()`, `await db.prepare(...).get()`)
- Idempotent offline sales via `client_sale_id` UUID
- Server actions require authentication
- Uploads require a valid session cookie

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
