# Vercel API Deployment

This directory contains the Express.js API that can be deployed to Vercel.

## Environment Variables

Set these in your Vercel project settings:

- `MONGO_URI` - Your MongoDB connection string
- `JWT_SECRET` - A secure random string for JWT signing
- `WEB_ORIGIN` - Your frontend URL (e.g., https://yourapp.vercel.app)
- `PORT` - Optional, defaults to what Vercel provides

## Deployment

1. Push this repo to GitHub
2. Import the project in Vercel
3. Set the root directory to `apps/api`
4. Add environment variables
5. Deploy

The API will be available at your Vercel domain.
