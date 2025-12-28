# IOCL Air Quality Control System - Complete Deployment Guide

> **Last Updated:** December 25, 2025
> **Project:** IOCL XTRA O2 Monitoring Dashboard
> **Repository:** https://github.com/Hiteshldt/cb_iocl_monitoring_dashboard_v1.0_08_2025

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [AWS Services Used](#3-aws-services-used)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Frontend Deployment (S3)](#5-frontend-deployment-s3)
6. [Backend Deployment (EC2)](#6-backend-deployment-ec2)
7. [GitHub Actions Workflow](#7-github-actions-workflow)
8. [Environment Variables](#8-environment-variables)
9. [GitHub Secrets](#9-github-secrets)
10. [How to Deploy Updates](#10-how-to-deploy-updates)
11. [Troubleshooting Guide](#11-troubleshooting-guide)
12. [Useful Commands](#12-useful-commands)
13. [URLs and Endpoints](#13-urls-and-endpoints)
14. [Security Configuration](#14-security-configuration)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DEPLOYMENT ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Developer's Machine                                                                │
│   ┌─────────────────┐                                                               │
│   │  Local Dev      │                                                               │
│   │  - VS Code      │                                                               │
│   │  - Git          │                                                               │
│   └────────┬────────┘                                                               │
│            │ git push                                                               │
│            ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                              GITHUB                                          │   │
│   │  Repository: Hiteshldt/cb_iocl_monitoring_dashboard_v1.0_08_2025            │   │
│   │                                                                              │   │
│   │  Branches:                                                                   │   │
│   │  ├── main        → Development branch (no auto-deploy)                      │   │
│   │  └── production  → Production branch (triggers auto-deploy)                 │   │
│   │                                                                              │   │
│   │  GitHub Actions: .github/workflows/deploy.yml                               │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│            │                                                                        │
│            │ On push to 'production' branch                                        │
│            ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                         GITHUB ACTIONS                                       │   │
│   │                                                                              │   │
│   │  ┌─────────────────────────┐    ┌─────────────────────────┐                 │   │
│   │  │   deploy-frontend       │    │   deploy-backend        │                 │   │
│   │  │                         │    │                         │                 │   │
│   │  │  1. Checkout code       │    │  1. Checkout code       │                 │   │
│   │  │  2. Setup Node.js 20    │    │  2. SSH into EC2        │                 │   │
│   │  │  3. npm ci              │    │  3. git pull            │                 │   │
│   │  │  4. npm run build       │    │  4. npm ci              │                 │   │
│   │  │  5. AWS OIDC Auth       │    │  5. Update .env         │                 │   │
│   │  │  6. S3 sync             │    │  6. PM2 restart         │                 │   │
│   │  └───────────┬─────────────┘    └───────────┬─────────────┘                 │   │
│   │              │                              │                                │   │
│   └──────────────┼──────────────────────────────┼────────────────────────────────┘   │
│                  │                              │                                    │
│                  ▼                              ▼                                    │
│   ┌──────────────────────────────────────────────────────────────────────────────┐  │
│   │                                  AWS                                          │  │
│   │                                                                               │  │
│   │  ┌─────────────────────────────┐    ┌─────────────────────────────┐          │  │
│   │  │         S3 BUCKET           │    │           EC2               │          │  │
│   │  │                             │    │                             │          │  │
│   │  │  Bucket: iocl-frontend      │    │  Instance: iocl-backend-    │          │  │
│   │  │  Region: us-east-1          │    │           server            │          │  │
│   │  │                             │    │  IP: 52.90.59.121           │          │  │
│   │  │  Static Website Hosting:    │    │  OS: Ubuntu 24.04 LTS       │          │  │
│   │  │  - Index: index.html        │    │  Type: t2.small             │          │  │
│   │  │  - Error: index.html        │    │                             │          │  │
│   │  │                             │    │  Stack:                     │          │  │
│   │  │  Contains:                  │    │  - Node.js 20.x             │          │  │
│   │  │  - React build files        │    │  - PM2 (process manager)    │          │  │
│   │  │  - index.html               │    │  - Nginx (reverse proxy)    │          │  │
│   │  │  - assets/                  │    │                             │          │  │
│   │  │  - *.js, *.css              │    │  App Location:              │          │  │
│   │  │                             │    │  ~/iocl-app/backend/        │          │  │
│   │  └─────────────────────────────┘    └─────────────────────────────┘          │  │
│   │              │                              │                                 │  │
│   │              │                              │                                 │  │
│   │              ▼                              ▼                                 │  │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │  │
│   │  │                         USER ACCESS                                      │ │  │
│   │  │                                                                          │ │  │
│   │  │  Frontend URL:                                                           │ │  │
│   │  │  http://iocl-frontend.s3-website-us-east-1.amazonaws.com                │ │  │
│   │  │                                                                          │ │  │
│   │  │  Backend API:                                                            │ │  │
│   │  │  http://52.90.59.121/api/*                                              │ │  │
│   │  │                                                                          │ │  │
│   │  │  WebSocket:                                                              │ │  │
│   │  │  http://52.90.59.121 (Socket.IO)                                        │ │  │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │  │
│   │                                                                               │  │
│   └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI Framework |
| Vite | 7.2.4 | Build tool & dev server |
| React Router DOM | 7.10.1 | Client-side routing |
| Axios | 1.13.2 | HTTP client for API calls |
| Socket.IO Client | 4.8.1 | Real-time WebSocket communication |
| Tailwind CSS | 3.3.0 | Utility-first CSS framework |
| Lucide React | 0.556.0 | Icon library |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | JavaScript runtime |
| Express | 4.18.2 | Web framework |
| Socket.IO | 4.6.1 | Real-time WebSocket server |
| Axios | 1.6.2 | HTTP client for AWS API calls |
| JSON Web Token | 9.0.2 | Authentication |
| node-cron | 3.0.3 | Scheduled tasks |
| dotenv | 16.3.1 | Environment variable management |
| cors | 2.8.5 | Cross-Origin Resource Sharing |

### Infrastructure
| Service | Purpose |
|---------|---------|
| AWS S3 | Static website hosting for frontend |
| AWS EC2 | Virtual machine for backend |
| Nginx | Reverse proxy on EC2 |
| PM2 | Node.js process manager |
| GitHub Actions | CI/CD automation |

---

## 3. AWS Services Used

### 3.1 AWS S3 (Simple Storage Service)

**Purpose:** Hosts the React frontend as a static website

**Configuration:**
- **Bucket Name:** `iocl-frontend`
- **Region:** `us-east-1`
- **Static Website Hosting:** Enabled
- **Index Document:** `index.html`
- **Error Document:** `index.html` (for SPA routing)
- **Public Access:** Enabled (for website hosting)

**Bucket Policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::iocl-frontend/*"
        }
    ]
}
```

**Website URL:** `http://iocl-frontend.s3-website-us-east-1.amazonaws.com`

---

### 3.2 AWS EC2 (Elastic Compute Cloud)

**Purpose:** Runs the Node.js backend server

**Instance Details:**
- **Instance Name:** `iocl-backend-server`
- **Instance ID:** `i-0b8540c8289662cf6`
- **Instance Type:** `t2.small`
- **AMI:** Ubuntu 24.04 LTS (`ami-0ecb62995f68bb549`)
- **Region:** `us-east-1`
- **Public IP:** `52.90.59.121`
- **Public DNS:** `ec2-52-90-59-121.compute-1.amazonaws.com`
- **Private IP:** `172.31.28.154`
- **Key Pair:** `iocl-backend-server-pem-key`

**Security Group Inbound Rules:**
| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | 0.0.0.0/0 | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |

**Installed Software:**
- Node.js 20.x
- npm
- PM2 (process manager)
- Nginx (reverse proxy)
- Git

---

### 3.3 AWS IAM (Identity and Access Management)

**Purpose:** Secure authentication for GitHub Actions to deploy to S3

**Method:** OIDC (OpenID Connect) - No access keys stored!

**Components:**
1. **Identity Provider:**
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. **IAM Role:** `GitHubActions-IOCL-Deploy`
   - ARN: `arn:aws:iam::548586340642:role/GitHubActions-IOCL-Deploy`
   - Permissions: `AmazonS3FullAccess` (for S3 deployment)

3. **Trust Policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::548586340642:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                },
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": "repo:Hiteshldt/cb_iocl_monitoring_dashboard_v1.0_08_2025:ref:refs/heads/production"
                }
            }
        }
    ]
}
```

---

## 4. CI/CD Pipeline

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CI/CD PIPELINE FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  DEVELOPER                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  1. Work on 'main' branch                                                  │ │
│  │     $ git checkout main                                                    │ │
│  │     $ # make code changes                                                  │ │
│  │     $ git add .                                                            │ │
│  │     $ git commit -m "Add feature"                                          │ │
│  │     $ git push origin main                                                 │ │
│  │                                                                            │ │
│  │  2. When ready to deploy, merge to 'production'                           │ │
│  │     $ git checkout production                                              │ │
│  │     $ git merge main                                                       │ │
│  │     $ git push origin production  ◄──── This triggers deployment!         │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                       │                                          │
│                                       ▼                                          │
│  GITHUB ACTIONS (Automatic)                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Workflow: .github/workflows/deploy.yml                                    │ │
│  │                                                                            │ │
│  │  Triggered by: push to 'production' branch                                │ │
│  │                                                                            │ │
│  │  Jobs (run in parallel):                                                   │ │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐         │ │
│  │  │    deploy-frontend          │  │    deploy-backend           │         │ │
│  │  │                             │  │                             │         │ │
│  │  │  ✓ Checkout code           │  │  ✓ Checkout code           │         │ │
│  │  │  ✓ Setup Node.js 20        │  │  ✓ SSH into EC2            │         │ │
│  │  │  ✓ npm ci (install deps)   │  │  ✓ Pull latest code        │         │ │
│  │  │  ✓ npm run build           │  │  ✓ npm ci --production     │         │ │
│  │  │  ✓ OIDC Auth to AWS        │  │  ✓ Update .env file        │         │ │
│  │  │  ✓ S3 sync (upload)        │  │  ✓ PM2 restart             │         │ │
│  │  └─────────────────────────────┘  └─────────────────────────────┘         │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                       │                                          │
│                                       ▼                                          │
│  RESULT                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  ✓ Frontend: New build uploaded to S3                                     │ │
│  │  ✓ Backend: New code deployed and running on EC2                          │ │
│  │  ✓ Both accessible immediately!                                           │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Branch Strategy

| Branch | Purpose | Auto-Deploy |
|--------|---------|-------------|
| `main` | Development, testing, feature work | No |
| `production` | Live production code | **Yes** - triggers GitHub Actions |

---

## 5. Frontend Deployment (S3)

### How It Works

1. **GitHub Actions** checks out the code
2. Installs Node.js 20.x
3. Runs `npm ci` in the `frontend/` directory
4. Runs `npm run build` which:
   - Uses Vite to bundle the React app
   - Injects environment variables (`VITE_API_URL`, `VITE_SOCKET_URL`)
   - Outputs to `frontend/dist/`
5. Authenticates to AWS using OIDC (no access keys!)
6. Syncs `dist/` folder to S3 bucket using `aws s3 sync --delete`

### Build Output Structure

```
frontend/dist/
├── index.html
├── assets/
│   ├── index-[hash].js      # Main React bundle
│   ├── index-[hash].css     # Compiled CSS
│   └── [other assets]
└── vite.svg
```

### Environment Variables (Build Time)

These are injected during the build process:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_URL` | `http://52.90.59.121/api` | Backend API endpoint |
| `VITE_SOCKET_URL` | `http://52.90.59.121` | WebSocket endpoint |

**Important:** These are baked into the JavaScript bundle at build time!

---

## 6. Backend Deployment (EC2)

### Server Setup (One-Time)

```bash
# SSH into EC2
ssh -i iocl-backend-server-pem-key.pem ubuntu@52.90.59.121

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

### Nginx Configuration

**File:** `/etc/nginx/sites-available/default`

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket support (required for Socket.IO)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Why Nginx?**
- Acts as reverse proxy (port 80 → port 3000)
- Handles WebSocket upgrades for Socket.IO
- Can add SSL/HTTPS later
- Better performance and security

### Application Directory Structure

```
/home/ubuntu/
└── iocl-app/
    ├── .git/
    ├── backend/
    │   ├── server.js          # Main entry point
    │   ├── package.json
    │   ├── .env               # Environment variables
    │   ├── config/
    │   ├── routes/
    │   ├── services/
    │   ├── middleware/
    │   ├── utils/
    │   └── data/              # Persistent data storage
    └── frontend/              # (not used on EC2)
```

### PM2 Process Management

PM2 keeps the Node.js app running and restarts it if it crashes.

**Process Name:** `iocl-backend`

**PM2 Commands:**
```bash
pm2 status                    # Check process status
pm2 logs iocl-backend         # View logs
pm2 restart iocl-backend      # Restart app
pm2 stop iocl-backend         # Stop app
pm2 delete iocl-backend       # Remove process
pm2 save                      # Save process list for auto-restart
```

**Auto-Start on Reboot:**
```bash
pm2 startup                   # Generate startup script
# Run the command it outputs
pm2 save                      # Save current processes
```

---

## 7. GitHub Actions Workflow

### Workflow File Location

`.github/workflows/deploy.yml`

### Full Workflow Code

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - production

# Required for OIDC authentication with AWS
permissions:
  id-token: write   # Required for requesting the JWT
  contents: read    # Required for actions/checkout

jobs:
  # ============================================
  # DEPLOY FRONTEND TO S3
  # ============================================
  deploy-frontend:
    name: Deploy Frontend to S3
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Build frontend
        working-directory: ./frontend
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.BACKEND_URL }}
          VITE_SOCKET_URL: ${{ secrets.BACKEND_SOCKET_URL }}

      # OIDC Authentication (no access keys needed!)
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Deploy to S3
        working-directory: ./frontend
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
          echo "✅ Frontend deployed to S3!"

  # ============================================
  # DEPLOY BACKEND TO EC2
  # ============================================
  deploy-backend:
    name: Deploy Backend to EC2
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            echo "🚀 Starting backend deployment..."

            # Navigate to app directory (create if doesn't exist)
            mkdir -p ~/iocl-app
            cd ~/iocl-app

            # Clone or pull latest code
            if [ -d ".git" ]; then
              echo "📥 Pulling latest changes..."
              git fetch origin production
              git reset --hard origin/production
            else
              echo "📦 Cloning repository..."
              git clone -b production https://github.com/${{ github.repository }}.git .
            fi

            # Navigate to backend
            cd backend

            # Install dependencies
            echo "📦 Installing dependencies..."
            npm ci --production

            # Create/update .env file
            cat > .env << 'ENVEOF'
            PORT=${{ secrets.BACKEND_PORT }}
            NODE_ENV=production
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            AWS_REGION=${{ secrets.AWS_REGION }}
            ENVEOF

            # Restart the application with PM2
            echo "🔄 Restarting application..."
            pm2 delete iocl-backend 2>/dev/null || true
            pm2 start server.js --name iocl-backend
            pm2 save

            echo "✅ Backend deployment complete!"
```

---

## 8. Environment Variables

### Backend (.env on EC2)

**Location:** `/home/ubuntu/iocl-app/backend/.env`

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# AWS Configuration
AWS_REGION=us-east-1
AWS_API_BASE_URL=https://vtg0j85nv4.execute-api.us-east-1.amazonaws.com/device
AWS_WEBSOCKET_URL=wss://ztw46d04q3.execute-api.us-east-1.amazonaws.com/production

# Device Configuration
ACTUAL_DEVICE_ID=BTTE1250001
DISPLAY_DEVICE_ID=IOCL_XTRA_O2_ADMIN
DEVICE_IMEI=860710081332028
DEVICE_METER=2

# Authentication
JWT_SECRET=iocl_xtra_o2_secret_key_2025_secure_random_string
JWT_EXPIRES_IN=24h
ADMIN_PASSWORD=IOCL_XTRA_O2_ADMIN123

# Service Intervals
DISPLAY_UPDATE_INTERVAL=10000
```

### Frontend (.env for local development)

**Location:** `frontend/.env`

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

**Note:** For production, these are set via GitHub Secrets and injected at build time.

---

## 9. GitHub Secrets

**Location:** GitHub → Repository → Settings → Secrets and variables → Actions

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `AWS_ROLE_ARN` | `arn:aws:iam::548586340642:role/GitHubActions-IOCL-Deploy` | IAM role for OIDC auth |
| `AWS_REGION` | `us-east-1` | AWS region |
| `S3_BUCKET` | `iocl-frontend` | S3 bucket name |
| `EC2_HOST` | `52.90.59.121` | EC2 public IP |
| `EC2_USERNAME` | `ubuntu` | EC2 SSH username |
| `EC2_SSH_KEY` | (full .pem file content) | EC2 SSH private key |
| `BACKEND_PORT` | `3000` | Backend server port |
| `BACKEND_URL` | `http://52.90.59.121/api` | Backend API URL (for frontend) |
| `BACKEND_SOCKET_URL` | `http://52.90.59.121` | Socket URL (for frontend) |
| `JWT_SECRET` | `iocl_xtra_o2_secret_key_2025_secure_random_string` | JWT signing secret |

---

## 10. How to Deploy Updates

### Standard Deployment Flow

```bash
# 1. Make sure you're on main branch
git checkout main

# 2. Pull latest changes
git pull origin main

# 3. Make your code changes
# ... edit files ...

# 4. Commit changes
git add .
git commit -m "Description of changes"

# 5. Push to main (no deployment yet)
git push origin main

# 6. When ready to deploy, switch to production
git checkout production

# 7. Merge main into production
git merge main

# 8. Push to production (THIS TRIGGERS DEPLOYMENT!)
git push origin production

# 9. Go back to main for more development
git checkout main
```

### Quick Deploy (Skip main branch)

```bash
# If you want to deploy directly
git checkout production
# Make changes...
git add .
git commit -m "Hotfix"
git push origin production
# Deployment triggers automatically!
```

### Monitor Deployment

1. Go to GitHub → Repository → **Actions** tab
2. Watch the workflow run
3. ✅ Green = Success
4. ❌ Red = Failed (check logs)

---

## 11. Troubleshooting Guide

### Frontend Issues

#### Issue: 404 on page refresh
**Cause:** S3 doesn't handle SPA routing
**Solution:** Error document is set to `index.html` ✓

#### Issue: API calls fail with CORS error
**Cause:** Backend CORS not configured
**Solution:** Backend has `app.use(cors())` ✓

#### Issue: "net::ERR_CONNECTION_TIMED_OUT"
**Cause:** EC2 security group blocking traffic
**Solution:** Add HTTP (80) inbound rule with 0.0.0.0/0

### Backend Issues

#### Issue: 502 Bad Gateway from Nginx
**Cause:** Node.js app not running
**Solution:**
```bash
ssh -i key.pem ubuntu@52.90.59.121
pm2 status
pm2 restart iocl-backend
pm2 logs iocl-backend
```

#### Issue: PM2 shows app "errored"
**Cause:** Application crashed
**Solution:**
```bash
pm2 logs iocl-backend --lines 100
# Check for error messages
```

#### Issue: Environment variables not loaded
**Cause:** .env file missing or wrong location
**Solution:**
```bash
cd ~/iocl-app/backend
cat .env  # Verify contents
pm2 restart iocl-backend --update-env
```

### GitHub Actions Issues

#### Issue: "OIDC: Could not get credentials"
**Cause:** IAM role trust policy misconfigured
**Solution:** Check trust policy has correct repo name

#### Issue: SSH connection timeout to EC2
**Cause:** Security group not allowing SSH from GitHub IPs
**Solution:** Allow SSH from 0.0.0.0/0

#### Issue: npm ci fails
**Cause:** No package-lock.json or corrupted
**Solution:**
```bash
# Locally
cd frontend  # or backend
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

---

## 12. Useful Commands

### Local Development

```bash
# Frontend
cd frontend
npm install
npm run dev          # Start dev server (localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build

# Backend
cd backend
npm install
npm run dev          # Start with nodemon (localhost:3001)
npm start            # Start without nodemon
```

### EC2 Server

```bash
# SSH into server
ssh -i iocl-backend-server-pem-key.pem ubuntu@52.90.59.121

# PM2 Commands
pm2 status                     # View all processes
pm2 logs iocl-backend          # View logs (Ctrl+C to exit)
pm2 logs iocl-backend --lines 100  # View last 100 lines
pm2 restart iocl-backend       # Restart app
pm2 stop iocl-backend          # Stop app
pm2 delete iocl-backend        # Remove process
pm2 monit                      # Real-time monitoring dashboard

# Nginx Commands
sudo nginx -t                  # Test configuration
sudo systemctl restart nginx   # Restart Nginx
sudo systemctl status nginx    # Check status
sudo nano /etc/nginx/sites-available/default  # Edit config

# System Commands
htop                          # System resources
df -h                         # Disk usage
free -m                       # Memory usage
```

### Git Commands

```bash
# Branch management
git branch                    # List branches
git checkout main             # Switch to main
git checkout production       # Switch to production
git merge main                # Merge main into current branch

# Deployment
git push origin production    # Deploy!

# View history
git log --oneline -10         # Last 10 commits
git status                    # Check current state
```

### AWS CLI (if installed)

```bash
# S3
aws s3 ls s3://iocl-frontend/           # List bucket contents
aws s3 sync dist/ s3://iocl-frontend/   # Upload files
aws s3 rm s3://iocl-frontend/ --recursive  # Clear bucket

# EC2
aws ec2 describe-instances --instance-ids i-0b8540c8289662cf6
```

---

## 13. URLs and Endpoints

### Production URLs

| Service | URL |
|---------|-----|
| **Frontend** | http://iocl-frontend.s3-website-us-east-1.amazonaws.com |
| **Backend API** | http://52.90.59.121/api |
| **Backend Health** | http://52.90.59.121/health |
| **WebSocket** | http://52.90.59.121 (Socket.IO) |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/verify` | Verify JWT token |
| GET | `/api/device/current` | Get current device data |
| GET | `/api/device/status` | Get device status |
| GET | `/api/device/history/:period` | Get historical data |
| GET | `/api/relay/states` | Get relay states |
| POST | `/api/relay/control` | Control relays |
| GET | `/api/automation/rules` | Get automation rules |
| POST | `/api/automation/rules` | Create automation rule |
| GET | `/health` | Health check |

### AWS Endpoints (Used by Backend)

| Service | URL |
|---------|-----|
| **AWS API Gateway** | https://vtg0j85nv4.execute-api.us-east-1.amazonaws.com/device |
| **AWS WebSocket** | wss://ztw46d04q3.execute-api.us-east-1.amazonaws.com/production |

---

## 14. Security Configuration

### EC2 Security Group

**Security Group Rules (Inbound):**

| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| SSH | TCP | 22 | 0.0.0.0/0 | SSH access |
| HTTP | TCP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Secure web traffic |

**Recommendation:** For better security, restrict SSH to your IP only.

### S3 Bucket Security

- Public access enabled (required for static website hosting)
- Bucket policy allows `s3:GetObject` for everyone
- No write access for public

### IAM Security

- Using OIDC for GitHub Actions (no long-lived access keys!)
- Role restricted to specific repository and branch
- Minimal permissions (S3 access only)

### Application Security

- JWT-based authentication
- CORS enabled
- Environment variables for secrets (not in code)

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUICK REFERENCE CARD                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TO DEPLOY:                                                      │
│  $ git checkout production                                       │
│  $ git merge main                                                │
│  $ git push origin production                                    │
│                                                                  │
│  FRONTEND URL:                                                   │
│  http://iocl-frontend.s3-website-us-east-1.amazonaws.com        │
│                                                                  │
│  BACKEND URL:                                                    │
│  http://52.90.59.121                                            │
│                                                                  │
│  SSH INTO EC2:                                                   │
│  $ ssh -i iocl-backend-server-pem-key.pem ubuntu@52.90.59.121   │
│                                                                  │
│  CHECK BACKEND STATUS:                                           │
│  $ pm2 status                                                    │
│  $ pm2 logs iocl-backend                                         │
│                                                                  │
│  RESTART BACKEND:                                                │
│  $ pm2 restart iocl-backend                                      │
│                                                                  │
│  VIEW DEPLOYMENT:                                                │
│  GitHub → Repository → Actions tab                               │
│                                                                  │
│  AWS ACCOUNT: 548586340642                                       │
│  REGION: us-east-1                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-25 | Initial deployment setup |
| 2025-12-25 | Configured CI/CD with GitHub Actions |
| 2025-12-25 | Set up OIDC authentication for AWS |
| 2025-12-25 | Deployed frontend to S3 |
| 2025-12-25 | Deployed backend to EC2 with PM2 and Nginx |

---

## Support

For issues with this deployment:
1. Check the [Troubleshooting Guide](#11-troubleshooting-guide)
2. Review GitHub Actions logs
3. Check PM2 logs on EC2
4. Review this documentation

---

*This document is part of the IOCL Air Quality Control System project.*
