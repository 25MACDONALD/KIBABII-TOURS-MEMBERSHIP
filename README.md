KIBABII Tours - E-Learning (Minimal scaffold)

This repository contains a minimal Node/Express backend and static frontend for a small e-learning portal where learners register and log in using their registration numbers, take quizzes, and download course materials.

Quick start

1. Install dependencies

```bash
cd /workspaces/KIBABII-TOURS-MEMBERSHIP
npm install
```

2. Run the server

```bash
npm start
```

3. Open the site in your browser: `http://localhost:3000`

Notes

- Default JWT secret is `dev-secret-change-me`. Set `JWT_SECRET` env var in production.
- Data is stored in `data.db` (SQLite) and seeded with one sample course, a sample material, and a short quiz.
- Frontend is static in the `public/` folder. Client uses localStorage to store JWT.

Next steps you might want me to do:
- Add proper file upload UI for instructors.
- Add an admin interface to create courses/quizzes.
- Add persistent session store and improved security hardening.
Please register your name and full details here. only for those going for the trip
