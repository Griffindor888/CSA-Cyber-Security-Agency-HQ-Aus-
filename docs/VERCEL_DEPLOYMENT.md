# Vercel Deployment Runbook (Maintainers)

## Purpose

Keep Vercel deployment correctly linked to this repository after renames or project-setting changes.

## Current deployment model

- Static site served from repository root (`.`)
- No custom build command
- No custom output directory
- Runtime behavior controlled by root `vercel.json` (headers and redirects)

## Rename/relink checklist

1. In Vercel, open the project and confirm linked repository is `Griffindor888/CSA-Cyber-Security-Agency-HQ-Aus-`.
2. Confirm **Production Branch** is the intended default branch.
3. Confirm **Root Directory** is `.`.
4. Confirm there is no project-level override for build/output settings.

## Deploy procedure

1. Push validated changes to the repository.
2. Trigger a Vercel redeploy from the latest commit.
3. Verify deployment status is successful.
4. Smoke-test key routes: `/`, `/company/`, `/technology/`, `/security/`, `/contact/`.

## If deployment reads the wrong repo

1. Disconnect the project’s Git repository in Vercel.
2. Reconnect to `Griffindor888/CSA-Cyber-Security-Agency-HQ-Aus-`.
3. Re-check Root Directory (`.`) and branch settings.
4. Redeploy latest commit and re-test routes.
