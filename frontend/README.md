# Video Analytics Frontend

React + Vite frontend for uploading videos and viewing processed person-count results from the FastAPI backend.

## Run locally

```bash
npm install
npm run dev
```

The app starts on `http://localhost:8080` by default.

## Backend URL

Set backend API URL in `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run preview` - preview build locally
- `npm run test` - run tests once
- `npm run test:watch` - run tests in watch mode
