# Complete Deployment Guide: Vercel + Free MySQL Database

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Set Up Free MySQL Database](#step-1-set-up-free-mysql-database)
3. [Step 2: Push Code to GitHub](#step-2-push-code-to-github)
4. [Step 3: Deploy to Vercel](#step-3-deploy-to-vercel)
5. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
6. [Step 5: Initialize Database](#step-5-initialize-database)
7. [Important Notes](#important-notes)

---

## Prerequisites
- GitHub/GitLab/Bitbucket account
- Vercel account (free)
- One of these free database providers:
  - **Aiven for MySQL** (free tier)
  - **TiDB Cloud** (free tier, MySQL-compatible)
  - **CockroachDB Serverless** (free tier, PostgreSQL-compatible but with MySQL interface)
  - **Railway** (free tier for small projects)

---

## Step 1: Set Up Free MySQL Database

### Option A: Aiven for MySQL (Recommended - Easiest)
1. Go to [aiven.io](https://aiven.io) and sign up for a free account
2. Click "Create service" → Select "MySQL"
3. Fill in:
   - Service name: `zation-gempos`
   - Cloud provider: Choose one (AWS, GCP, Azure)
   - Region: Choose one close to your location
   - Service plan: Select "Free"
4. Click "Create free service"
5. Wait for the service to be ready (a few minutes)
6. Once ready, go to "Overview" tab → Copy the **Service URI** (connection string)
7. Save this connection string - you'll need it for Vercel

### Option B: TiDB Cloud
1. Go to [tidbcloud.com](https://tidbcloud.com) and sign up for a free account
2. Click "Create Cluster" → Select "Serverless"
3. Fill in cluster details and click "Create"
4. Once ready, go to "Connect" → Create a user, get connection string
5. Save the connection string

### Option C: Railway
1. Go to [railway.app](https://railway.app) and sign up for a free account
2. Click "New Project" → "Provision MySQL"
3. Once ready, go to "Variables" tab → Copy `DATABASE_URL`
4. Save the connection string

---

---

## Step 2: Push Code to GitHub

Your project is already a Git repo! Just push it to GitHub:

1. Go to [github.com](https://github.com) and create a new repository (public or private)
2. Follow GitHub's instructions to push your existing repo:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure project settings:
   - Project Name: (your choice, e.g., `zation-gempos`)
   - Framework Preset: Next.js (should auto-detect)
   - Root Directory: `zationgempos` (IMPORTANT! Your project is in this subfolder)
5. Click "Deploy" (it will fail at first - we need to add environment variables first)

---

## Step 4: Configure Environment Variables

In your Vercel project dashboard:
1. Go to "Settings" → "Environment Variables"
2. Add these variables (make sure to check "Automatically expose System Environment Variables"):

| Name | Value |
|------|-------|
| `DATABASE_URL` | Your database connection string (from Aiven/TiDB/Railway) |
| `JWT_SECRET` | Generate a strong random secret (use https://www.uuidgenerator.net or similar) |
| `SECRET_KEY` | Another strong random secret (different from JWT_SECRET) |
| `NEXT_PUBLIC_BASE_URL` | Your Vercel URL (e.g., `https://zation-gempos.vercel.app`) |
| `CRON_SECRET` | Another strong random secret |
| `SETUP_SECRET` | Another strong random secret |
| `INITIAL_ADMIN_PASSWORD` | Your admin password (e.g., `secure-password-123`) |
| `NODE_ENV` | `production` |

3. After adding all variables, go back to "Deployments" and click "Redeploy"

---

## Step 5: Initialize Database

Once deployed successfully:
1. Open your Vercel app URL
2. The database schema will be created automatically on first load
3. Log in with:
   - Username: `admin`
   - Password: The `INITIAL_ADMIN_PASSWORD` you set

---

## Important Notes

### Uploads Limitation
Vercel Serverless Functions have **ephemeral storage**, which means uploaded files won't persist between deployments or function invocations. For production use, you should:
- Use Cloudinary (free tier available)
- Or AWS S3 (free tier for 12 months)

### Backups
- **Manual**: Log in as super admin → Settings → Download backup
- **Cron**: Use a service like cron-job.org to call `/api/cron/backup` with `Authorization: Bearer YOUR_CRON_SECRET`

### Security
- Never commit `.env` files to Git
- Use strong secrets for all environment variables
- Enable HTTPS (Vercel does this automatically)

### Updating the App
Just push to your GitHub repo - Vercel will auto-deploy!
