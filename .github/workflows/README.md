# GitHub Actions Workflows

This directory contains the CI/CD workflows for the Acquisitions API project.

## Workflows

### 1. `lint-and-format.yml` - Code Quality Checks
- **Triggers**: Push and PR to `main` and `staging` branches
- **Purpose**: Ensures code quality and consistency
- **Features**:
  - Runs ESLint for code linting
  - Runs Prettier for code formatting checks
  - Provides clear error annotations with fix suggestions
  - Fails workflow if issues are found

### 2. `tests.yml` - Test Execution
- **Triggers**: Push and PR to `main` and `staging` branches  
- **Purpose**: Runs the test suite and generates coverage reports
- **Features**:
  - Runs Jest tests with proper Node.js ESM configuration
  - Sets test environment variables (`NODE_ENV=test`, `NODE_OPTIONS=--experimental-vm-modules`)
  - Uploads coverage reports as artifacts (30 days retention)
  - Generates GitHub step summary with test results and coverage
  - Provides detailed error annotations for test failures

### 3. `docker-build-and-push.yml` - Container Build & Deploy
- **Triggers**: Push to `main` branch or manual dispatch
- **Purpose**: Builds and pushes Docker images to Docker Hub
- **Features**:
  - Multi-platform builds (linux/amd64, linux/arm64)
  - Docker Hub authentication using secrets
  - Metadata extraction with multiple tag formats:
    - `latest` (for main branch)
    - Branch name
    - `main-<sha>` (commit SHA)
    - `prod-YYYYMMDD-HHmmss` (timestamp)
  - Efficient caching using GitHub Actions cache
  - Comprehensive build summary with usage instructions

## Required Secrets

For the Docker workflow to work properly, you need to set these repository secrets:

- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password or access token

## Workflow Dependencies

The workflows are designed to:
1. **lint-and-format.yml** - Run first to catch basic code issues
2. **tests.yml** - Run in parallel or after linting to verify functionality  
3. **docker-build-and-push.yml** - Run only on main branch after tests pass

## Local Development Commands

Before pushing code, you can run these commands locally:

```bash
# Linting and formatting
npm run lint          # Check for linting issues
npm run lint:fix      # Auto-fix linting issues
npm run format:check  # Check formatting
npm run format        # Fix formatting

# Testing
npm test              # Run tests with coverage
```