# Development Setup Guide

This project has been configured with comprehensive development practices to ensure code quality and consistency.

## 🛠️ Development Tools Setup

### Pre-commit Hooks

The project uses Husky to enforce code quality before commits:

- **Pre-commit**: Runs `lint-staged` to format and lint only staged files
- **Pre-push**: Runs complete validation (format check, lint, type-check, and build)

### Code Quality Tools

#### Prettier (Code Formatting)

- **Configuration**: `.prettierrc`
- **Ignore patterns**: `.prettierignore`
- **Manual commands**:
  ```bash
  npm run format        # Format all files
  npm run format:check  # Check if files are formatted
  ```

#### ESLint (Code Linting)

- **Root config**: `.eslintrc.json`
- **API config**: `apps/api/.eslintrc.json`
- **Web config**: `apps/web/.eslintrc.json`
- **Manual commands**:
  ```bash
  npm run lint          # Lint all workspaces
  npm run lint:fix      # Auto-fix linting issues
  ```

#### TypeScript (Type Checking)

- **Manual commands**:
  ```bash
  npm run type-check    # Type check all workspaces
  ```

### Lint-staged Configuration

File: `.lintstagedrc.json`

Runs on staged files only:

- TypeScript/JavaScript files: ESLint fix + Prettier format
- JSON/Markdown files: Prettier format only

## 🚀 Available Scripts

### Root Level Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run build            # Build both applications
npm run start            # Start both applications in production

# Code Quality
npm run lint             # Lint both applications
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format all code with Prettier
npm run format:check     # Check formatting without changes
npm run type-check       # Type check both applications
npm run pre-commit       # Run all quality checks

# Individual Workspace Commands
npm run dev --workspace api     # Start only API
npm run dev --workspace web     # Start only web app
npm run lint --workspace api    # Lint only API
npm run lint --workspace web    # Lint only web app
```

### API Workspace Scripts

```bash
cd apps/api

npm run dev           # Development with hot reload
npm run build         # Build TypeScript
npm run start         # Start production server
npm run lint          # Lint API code
npm run lint:fix      # Auto-fix API linting issues
npm run type-check    # Type check API code
```

### Web Workspace Scripts

```bash
cd apps/web

npm run dev           # Development with hot reload
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Lint web app code
npm run lint:fix      # Auto-fix web linting issues
npm run type-check    # Type check web app code
```

## 🔧 Development Workflow

### 1. Initial Setup

```bash
git clone https://github.com/tasktrek-io/TaskTrek.git
cd TaskTrek
npm install  # Installs all dependencies and sets up git hooks
```

### 2. Daily Development

```bash
# Start development servers
npm run dev

# Make your changes...

# Before committing (optional - hooks will run automatically)
npm run format
npm run lint:fix
npm run type-check

# Commit changes (pre-commit hooks will run automatically)
git add .
git commit -m "Your commit message"

# Push changes (pre-push hooks will run automatically)
git push
```

### 3. Manual Quality Checks

```bash
# Run all quality checks manually
npm run pre-commit

# Or run individual checks
npm run format:check
npm run lint
npm run type-check
npm run build
```

## 🚨 Common Issues and Solutions

### Linting Errors

- **Unused variables**: Remove them or prefix with `_` (e.g., `_unused`)
- **Console statements**: Use `console.warn` or `console.error` for important logs, or add `// eslint-disable-next-line no-console`
- **Any types**: Replace with proper TypeScript types

### Formatting Issues

- Run `npm run format` to auto-fix
- Check `.prettierignore` if files should be excluded

### Type Errors

- Fix TypeScript type errors manually
- Ensure proper imports and type definitions

### Build Failures

- Fix linting and type errors first
- Check for missing dependencies
- Ensure environment variables are set

## 📋 Pre-commit Checklist

The automated hooks check:

1. ✅ **Code Formatting** (Prettier)
2. ✅ **Code Linting** (ESLint)
3. ✅ **Type Safety** (TypeScript)
4. ✅ **Build Success** (Both API and Web)

If any step fails, the commit/push will be blocked until issues are resolved.

## 🛡️ Git Hooks

### Pre-commit Hook

Located: `.husky/pre-commit`
Runs: `npx lint-staged`

### Pre-push Hook

Located: `.husky/pre-push`
Runs: `npm run pre-commit`

## 📝 Configuration Files Summary

| File                      | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `.prettierrc`             | Prettier formatting rules                |
| `.prettierignore`         | Files to exclude from formatting         |
| `.eslintrc.json`          | Root ESLint configuration                |
| `apps/api/.eslintrc.json` | API-specific linting rules               |
| `apps/web/.eslintrc.json` | Web app linting rules (includes Next.js) |
| `.lintstagedrc.json`      | Lint-staged configuration                |
| `.husky/pre-commit`       | Pre-commit git hook                      |
| `.husky/pre-push`         | Pre-push git hook                        |

## 🎯 Benefits

1. **Consistent Code Style**: Prettier ensures uniform formatting
2. **Code Quality**: ESLint catches potential bugs and enforces best practices
3. **Type Safety**: TypeScript prevents runtime errors
4. **Automated Validation**: Git hooks prevent bad code from entering the repository
5. **Team Productivity**: Reduces code review time by catching issues early
6. **CI/CD Ready**: Pre-validated code reduces build failures

## 🔄 Updating Dependencies

When updating linting or formatting dependencies:

```bash
# Update dependencies
npm update

# Test the setup
npm run pre-commit

# Commit the updates
git add package*.json
git commit -m "Update development dependencies"
```
