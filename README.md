# Order Dimension Tracker

A production-ready web application for tracking order dimensions with BigSeller integration.

## Features

- 🔐 Authentication & Authorization
- 📦 Scan and track order dimensions
- 🔄 Sync with Google Drive BigSeller data
- 📊 Dashboard with statistics
- 📤 Export to CSV
- 👥 User management (Admin)
- 🔍 Search and filter orders
- 📱 Mobile responsive

## Quick Deploy

### Backend (Render)
1. Push to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Add environment variables
5. Deploy

### Frontend (Netlify)
1. Push to GitHub
2. New site from Git on Netlify
3. Connect repository
4. Add environment variables
5. Deploy

### Database (Supabase)
1. Create new project
2. Run schema.sql
3. Get connection string

## Environment Variables

### Backend
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDIS_URL`, `REDIS_PASSWORD`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

### Frontend
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Default Admin
- Email: admin@example.com
- Password: Admin123!

## License
MIT