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

Deploying to Railway
--------------------

Quick guide to deploy this app to Railway (recommended for full backend + frontend):

1. Create a Railway account and login at https://railway.app
2. Create a new project and choose **Deploy from GitHub**. Connect your GitHub account and select the `25MACDONALD/KIBABII-TOURS-MEMBERSHIP` repository.
3. Railway will detect this is a Node app. In the service settings set the following environment variables under *Variables*:
	- `JWT_SECRET` — a long secret for signing tokens (example: `change-this-secret`)
	- (optional) `ADMIN_REGNO` — a regno that will be auto-promoted when registering (useful to bootstrap an admin)
	- `PORT` — Railway sets this automatically, you don't usually need to set it.

4. Database note: this project currently uses SQLite (`data.db`) by default. SQLite stores the DB as a file and may not be suitable for production on Railway because containers can be ephemeral. Recommended options:
	- Add a PostgreSQL plugin on Railway and migrate the app to use PostgreSQL (recommended). I can help implement this migration.
	- Or, accept SQLite for light/demo usage (data may be lost on redeploy). For persistent storage use a proper SQL service.

5. Optional: If you want to deploy via Docker on Railway, the repository includes a `Dockerfile`. Railway can build the Docker image automatically.

6. Deploy and open the generated URL. Your full backend + frontend app will be served from Railway's domain.

Automated deploy with GitHub integration
---------------------------------------
You can enable automatic deploys in Railway so each push to `main` triggers a new deployment.

If you'd like, I can:
- Implement PostgreSQL migration and update `server.js` (switch from SQLite to PostgreSQL using `pg`).
- Add a GitHub Actions workflow to build and push a Docker image.
- Configure Railway project variables and trigger the first deploy (I will need your Railway access to do that).

If you want me to proceed with a PostgreSQL migration or set up CI/CD, tell me which option you prefer and I'll implement it.
Please register your name and full details here. only for those going for the trip
