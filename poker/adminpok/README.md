# AdminPok

Next.js + shadcn/ui admin desk for the poker platform. It talks to the existing `/api/admin` backend and controls users, live play, rooms, games, tournaments, withdrawals, and platform revenue.

## Run

```bash
cd adminpok
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the demo admin:

```
username: admin
password: admin123
```

The backend creates or resets this account on startup.

## API

Set the backend URL in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://152.42.220.141:3060
```

For a local backend:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The backend must expose the admin routes already in `poc/app/routes/admin.routes.js`, including live rooms:

- `GET /api/admin/rooms/live`
- `POST /api/admin/rooms/:id/close`
- `POST /api/admin/rooms/:id/kick`
- `GET /api/admin/games`
- `PUT /api/admin/users/:id/status`
