# Trust Rating Frontend

A Vite + React frontend for the Trust Rating Module with reviews, ratings, and trust score features.

## Tech Stack

- React 18 (JavaScript)
- Vite
- TailwindCSS
- React Router v6
- TanStack React Query
- Axios
- React Hook Form
- Zod
- Vitest + React Testing Library

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `VITE_API_BASE_URL` in `.env` to point to your backend API.

## Run Development Server

```bash
npm run dev
```

## Run Tests

```bash
npm test
```

## Build for Production

```bash
npm run build
```

## Project Structure

- `src/api/` - API client and data fetching hooks
- `src/state/` - Authentication state management
- `src/components/` - Reusable components
  - `rating/` - Rating widgets and summary cards
  - `reviews/` - Review forms and lists
  - `trust/` - Trust score and badges
- `src/pages/` - Page components
- `src/routes/` - Router configuration
- `src/utils/` - Utility functions
