# GitHub Actions - Quick Guide

## What is GitHub Actions?

GitHub Actions is a **CI/CD automation** tool built into GitHub. It automatically runs tasks (like testing, linting, building) when you push code or create Pull Requests.

**CI** = Continuous Integration (automatically test code when it changes)  
**CD** = Continuous Deployment (automatically deploy code when tests pass)

## How This Project Uses GitHub Actions

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. You write code on a feature branch                         │
│                    ↓                                            │
│   2. You push to GitHub                                         │
│                    ↓                                            │
│   3. You create a Pull Request (PR)                             │
│                    ↓                                            │
│   ┌─────────────────────────────────────────┐                   │
│   │  GitHub Actions runs automatically:      │                   │
│   │  • Validates Markdown (docs)             │                   │
│   │  • Validates Python (notebooks)          │  ← CI runs here  │
│   │  • Runs tests                            │                   │
│   └─────────────────────────────────────────┘                   │
│                    ↓                                            │
│   4. If checks pass → Merge allowed                             │
│   5. If checks fail → Fix issues first                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Viewing Workflow Results

1. Go to your repository on GitHub
2. Click the **"Actions"** tab
3. See all workflow runs (green = passed, red = failed)
4. Click on a run to see details and logs

## The Workflows in This Project

### `ci.yml` - Continuous Integration
**Runs when:** PR created or code pushed to `main`/`develop`

| Job | What it checks |
|-----|----------------|
| `validate-docs` | Markdown files are well-formatted |
| `validate-python` | Python code has no syntax errors |
| `validate-notebooks` | Jupyter notebooks are valid JSON |

## Common Tasks

### Run Workflow Manually

1. Go to **Actions** tab
2. Select the workflow (e.g., "CI")
3. Click **"Run workflow"** button
4. Select branch and click **"Run workflow"**

### Skip CI for a Commit

Add `[skip ci]` to your commit message:
```bash
git commit -m "Update readme [skip ci]"
```

### Check Why a Build Failed

1. Go to **Actions** tab
2. Click on the failed run (red X)
3. Click on the failed job
4. Expand the failing step to see error details

## Branching Strategy

This project follows this workflow:

```
main (production)
  ↑
  │ (merge via PR)
  │
develop (integration)
  ↑
  │ (merge via PR)
  │
feature/your-feature (your work)
```

**To add a feature:**
```bash
# 1. Create feature branch from develop
git checkout develop
git pull
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "Add my feature"

# 3. Push to GitHub
git push -u origin feature/my-feature

# 4. Go to GitHub and create a Pull Request
#    (PR automatically triggers CI workflow)

# 5. After review and CI passes, merge the PR
```

## Fabric Deployment (Future)

After CI passes, deployment to Fabric environments uses **Fabric Deployment Pipelines** (not GitHub Actions):

| Environment | Trigger | Notes |
|-------------|---------|-------|
| Dev | Git integration auto-sync | Automatic when code merges |
| Test | Manual promotion | Click in Fabric portal |
| Prod | Manual + approval | Requires team review |

## Files Reference

```
.github/
└── workflows/
    ├── ci.yml          # Main CI workflow
    └── README.md       # This file
```

## Need Help?

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Understanding YAML syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GitHub Actions marketplace](https://github.com/marketplace?type=actions)
