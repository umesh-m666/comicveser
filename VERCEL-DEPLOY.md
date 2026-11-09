# Host the web app on Vercel, keep the API on Render

Why: some networks cannot reach Render's IP range. Vercel uses different addresses, and with the proxy below the browser talks
only to the Vercel address (the API is called server-to-server), which also removes cross-site cookie problems.

1. vercel.com -> Add New Project -> import the GitHub repo.
2. Root Directory: `apps/web`. Framework: Next.js (auto). Node 20.
3. Environment variables (Production):
   - `NEXT_PUBLIC_API_URL` = `/api`
   - `API_INTERNAL_URL`   = `https://<your-api>.onrender.com/api`
4. Deploy. You get `https://<project>.vercel.app`.
5. Render API service -> `WEB_ORIGIN` = `https://<project>.vercel.app` (comma-separate to keep the old Render web URL), then redeploy.
6. Test on the restricted network: `https://<project>.vercel.app`, then log in and open /admin.
