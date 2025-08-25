# TaskTrek - Project Management System

[![Node.js](https://img.shields.io/badge/Node.js-18.17.0+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.7-black.svg)](https://nextjs.org/)

A modern, full-stack project management application built with Next.js, Express.js, Node.js, and MongoDB. TaskTrek helps teams organize projects, manage tasks, and collaborate effectively with real-time updates and intuitive user interfaces.

## 🚀 Features

### Core Functionality

- **User Authentication & Authorization** - Secure JWT-based authentication
- **Workspace Management** - Multi-workspace support for different teams/organizations
- **Project Organization** - Create and manage projects within workspaces
- **Task Management** - Comprehensive task creation, assignment, and tracking
- **Real-time Notifications** - Stay updated with project activities and online status tracking
- **Activity Tracking** - Monitor task and project changes

### UI/UX Features

- **Responsive Design** - Works seamlessly on desktop and mobile
- **Dark/Light Theme** - Toggle between themes for better user experience
- **Interactive Dashboard** - Visual analytics and progress tracking
- **Intuitive Navigation** - Easy-to-use sidebar and workspace switching
- **Real-time Updates** - Live notifications and activity feeds

### Technical Features

- **TypeScript** - Full type safety across the entire stack
- **Modern React** - Built with React 18 and Next.js 14
- **RESTful API** - Well-structured Express.js backend
- **MongoDB Integration** - Robust data persistence with Mongoose
- **Docker Support** - Containerized development environment

## 🏗️ Architecture

```
TaskTrek/
├── apps/
│   ├── api/                 # Express.js Backend API
│   │   ├── src/
│   │   │   ├── models/      # MongoDB Models (User, Project, Task, etc.)
│   │   │   ├── routes/      # API Routes (auth, projects, tasks, etc.)
│   │   │   ├── middleware/  # Authentication & validation middleware
│   │   │   └── services/    # Business logic services
│   │   └── package.json
│   └── web/                 # Next.js Frontend
│       ├── src/
│       │   ├── app/         # Next.js 14 App Router
│       │   ├── components/  # React Components
│       │   ├── contexts/    # React Context providers
│       │   └── lib/         # Utility functions and API client
│       └── package.json
├── packages/                # Shared packages (future expansion)
├── docker-compose.yml       # Development database setup
└── package.json            # Root package.json with workspace scripts
```

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Material-UI (MUI)
- **HTTP Client**: Axios
- **Theme Management**: next-themes

### Backend

- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs for password hashing

### Development Tools

- **Package Manager**: npm (with workspaces)
- **Development**: Nodemon, ts-node
- **Database Management**: MongoDB Express (Web UI)
- **Containerization**: Docker & Docker Compose

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.17.0 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Docker** and **Docker Compose** - [Download](https://www.docker.com/get-started)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/tasktrek-io/TaskTrek.git
cd TaskTrek
```

### 2. Install Dependencies

```bash
# Install root dependencies and all workspace dependencies
npm install
```

### 3. Start Database Services

```bash
# Start MongoDB and Mongo Express using Docker
docker-compose up -d
```

This will start:

- **MongoDB** on `localhost:27017`
- **Mongo Express** (Database UI) on `localhost:8081`

### 4. Environment Configuration

Create environment files for the API:

```bash
# Create API environment file
touch apps/api/.env
```

Add the following to `apps/api/.env`:

```env
# Database
MONGO_URI=mongodb://localhost:27017/project_mgmt

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=4000
NODE_ENV=development

# CORS Configuration
WEB_ORIGIN=http://localhost:3000
```

### 5. Start Development Servers

```bash
# Start both frontend and backend in development mode
npm run dev
```

This will start:

- **Backend API** on `http://localhost:4000`
- **Frontend Web App** on `http://localhost:3000`

### 6. Access the Application

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Documentation**: [http://localhost:4000/health](http://localhost:4000/health)
- **Database UI**: [http://localhost:8081](http://localhost:8081)

## 📁 Project Structure

### API Structure (`apps/api/`)

```
src/
├── index.ts                 # Application entry point
├── middleware/
│   └── auth.ts             # JWT authentication middleware
├── models/                 # MongoDB Mongoose models
│   ├── User.ts            # User model
│   ├── Workspace.ts       # Workspace model
│   ├── Project.ts         # Project model
│   ├── Task.ts            # Task model
│   ├── Notification.ts    # Notification model
│   └── TaskActivity.ts    # Activity tracking model
├── routes/                # Express.js route handlers
│   ├── auth.ts           # Authentication routes
│   ├── users.ts          # User management routes
│   ├── workspaces.ts     # Workspace routes
│   ├── projects.ts       # Project routes
│   ├── tasks.ts          # Task routes
│   └── notifications.ts  # Notification routes
└── services/             # Business logic services
    ├── NotificationService.ts
    ├── TaskActivityService.ts
    └── WorkspaceService.ts
```

### Web Structure (`apps/web/`)

```
src/
├── app/                    # Next.js 14 App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles
│   ├── auth/              # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/         # Dashboard page
│   ├── workspaces/        # Workspace management
│   ├── projects/          # Project pages
│   └── tasks/             # Task management
├── components/            # Reusable React components
│   ├── AuthGuard.tsx     # Route protection component
│   ├── Sidebar.tsx       # Navigation sidebar
│   ├── NotificationBell.tsx
│   ├── TaskActivity.tsx
│   └── ThemeToggle.tsx
├── contexts/             # React Context providers
│   └── WorkspaceContext.tsx
└── lib/                  # Utilities and configurations
    └── api.ts           # Axios API client configuration
```

## 🔧 Development

### Available Scripts

From the root directory:

```bash
# Development
npm run dev          # Start both frontend and backend in development mode

# Production Build
npm run build        # Build both applications for production
npm run start        # Start both applications in production mode

# Code Quality
npm run lint         # Lint both applications
npm run lint:fix     # Lint and auto-fix issues in both applications
npm run format       # Format all code with Prettier
npm run format:check # Check if code is formatted correctly
npm run type-check   # Type check both applications
npm run pre-commit   # Run all checks (format, lint, type-check, build)

# Individual Applications
npm run dev --workspace api    # Start only the backend API
npm run dev --workspace web    # Start only the frontend app
```

### Code Quality & Development Practices

This project enforces code quality through automated tools:

#### Pre-commit Hooks

- **Prettier**: Automatically formats code on commit
- **ESLint**: Checks for code quality issues and enforces best practices
- **Type Checking**: Ensures TypeScript types are correct
- **Build Validation**: Confirms both applications build successfully

#### Pre-push Hooks

- **Complete Validation**: Runs format check, linting, type checking, and builds before pushing

#### Manual Commands

```bash
# Format all files
npm run format

# Check formatting without changing files
npm run format:check

# Lint all workspaces
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Type check all workspaces
npm run type-check

# Run all quality checks
npm run pre-commit
```

#### Configuration Files

- **`.prettierrc`** - Prettier configuration
- **`.eslintrc.json`** - Root ESLint configuration
- **`apps/api/.eslintrc.json`** - API-specific ESLint rules
- **`apps/web/.eslintrc.json`** - Web app ESLint rules (includes Next.js rules)
- **`.lintstagedrc.json`** - Lint-staged configuration for pre-commit hooks

### API Development

```bash
cd apps/api

# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm run start

# Lint API code
npm run lint

# Type check API code
npm run type-check
```

### Web Development

```bash
cd apps/web

# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint web app code
npm run lint

# Type check web app code
npm run type-check
```

## 🔐 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Workspaces

- `GET /api/workspaces` - Get user workspaces
- `POST /api/workspaces` - Create workspace
- `PUT /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace

### Projects

- `GET /api/projects` - Get user projects
- `GET /api/projects/workspace/:workspaceId` - Get workspace projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks

- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/assigned` - Get assigned tasks
- `GET /api/tasks/project/:projectId` - Get project tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Users

- `GET /api/users` - Get users
- `GET /api/users/:id` - Get user by ID

### Notifications

- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## 🎨 Customization

### Theme Configuration

The application supports dark and light themes. Modify theme settings in:

- `apps/web/tailwind.config.ts` - Tailwind CSS configuration
- `apps/web/src/app/globals.css` - Global CSS variables

### Database Models

Add or modify database models in `apps/api/src/models/`. Each model uses Mongoose with TypeScript interfaces.

### Adding New Features

1. **Backend**: Add routes in `apps/api/src/routes/`
2. **Frontend**: Add pages in `apps/web/src/app/`
3. **Components**: Add reusable components in `apps/web/src/components/`

## 🐳 Docker Deployment

### Development with Docker

```bash
# Start database services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Docker Setup

Create a production `docker-compose.prod.yml`:

```yaml
version: '3.8'
services:
  mongo:
    image: mongo:6
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: project_mgmt
    networks:
      - tasktrek-network

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - '4000:4000'
    environment:
      - MONGO_URI=mongodb://mongo:27017/project_mgmt
      - NODE_ENV=production
    depends_on:
      - mongo
    networks:
      - tasktrek-network

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NEXT_PUBLIC_API_URL=http://api:4000
    depends_on:
      - api
    networks:
      - tasktrek-network

volumes:
  mongo_data:

networks:
  tasktrek-network:
    driver: bridge
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test --workspace api
npm test --workspace web

# Run tests in watch mode
npm run test:watch
```

### Test Structure

- **API Tests**: Located in `apps/api/src/__tests__/`
- **Web Tests**: Located in `apps/web/src/__tests__/`

## 🚀 Deployment

### Vercel (Recommended for Frontend)

1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build --workspace web`
   - **Output Directory**: `apps/web/.next`

### Railway/Heroku (for Backend)

1. Create a new app on Railway or Heroku
2. Connect your GitHub repository
3. Set environment variables
4. Configure build settings:
   - **Build Command**: `npm run build --workspace api`
   - **Start Command**: `npm run start --workspace api`

### MongoDB Atlas

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Update `MONGO_URI` environment variable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add tests for new features

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Express.js](https://expressjs.com/) - Backend framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Material-UI](https://mui.com/) - React components

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/tasktrek-io/TaskTrek/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## 🔄 Changelog

### v1.0.0 (Initial Release)

- User authentication and authorization
- Workspace and project management
- Task creation and assignment
- Real-time notifications
- Responsive dashboard with analytics
- Dark/light theme support
- List view

---

**Built with ❤️ by the TaskTrek Team**
