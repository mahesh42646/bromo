# Bromo Platform — Claude Code Instructions

## Project Layout
```
bromo/
├── bromo-mobile/   React Native 0.84 + NativeWind + React Navigation
├── bromo-web/      Next.js 14 App Router + Tailwind + shadcn/ui
└── bromo-api/      Node.js + Express + TypeScript + MongoDB
```

## Stack per Service

### bromo-mobile
- React Native 0.84, NativeWind v4, React Navigation v7
- State: Context API (see `src/context/`)
- Animations: react-native-reanimated v4
- Media: react-native-video, react-native-image-picker, camera-roll
- Icons: lucide-react-native
- Styling: NativeWind + tailwind-merge, dark mode default

### bromo-web
- Next.js 14 App Router (`src/app/`)
- Tailwind CSS + shadcn/ui (customized)
- Animation: GSAP + Framer Motion
- Icons: lucide-react

### bromo-api
- Express + TypeScript, entry: `src/app.ts`
- MongoDB + Mongoose models in `src/models/`
- Routes: `src/routes/` (auth, settings)
- Middleware: `src/middleware/`
- Utils: `src/utils/`

## Active Screens (mobile)
- HomeScreen, ReelsScreen, SearchScreen, ProfileScreen, StoreScreen
- Create flow: `src/screens/create/` → ShareScreen.tsx (currently open)

## Key Conventions
- TypeScript strict, no `any`
- Tailwind classes via NativeWind on mobile; Tailwind CSS on web
- Dark mode always
- Mobile-first always
- 8px spacing grid
- MongoDB + Mongoose (not Firebase)

## Skill Triggers
- Mobile UI component → `/flutter-widget` adapted for React Native
- Web page/component → `/component` or `/frontend-design`
- API route/model → `/api`
- Animations → `/gsap` (web)
- Code review → `/simplify` before presenting
- Firebase work → `/firebase`

## Token Rules
- Never explain what you're about to do — just do it
- Edit only changed sections, never rewrite entire files
- Skip obvious comments
- No filler phrases or summaries
