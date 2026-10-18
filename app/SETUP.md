# Quick Setup Guide

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Get Database URL
1. Go to https://console.neon.tech/
2. Sign up / Log in
3. Create a new project (free tier)
4. Copy the connection string
5. Create `.env.local` file with:
```env
DATABASE_URL=postgresql://...
```

### Step 3: Initialize Database
```bash
npm run db:generate
npm run db:migrate
```

### Step 4: Run the App
```bash
npm run dev
```

Open http://localhost:3000

## What You'll See

1. **Welcome Screen** - Red gradient background with "Fala Mestre!" logo
2. **Chat Interface** - Type "Olá!" to start
3. **Three Tabs:**
   - 💬 Chat: Main conversation
   - 👥 Elenco: Team stats
   - ⚽ Jogo: Play matches

## Try This Flow

1. Type: "Olá!"
2. AI responds with welcome message
3. Click "JOGAR AGORA" button
4. See match result with narration
5. Check your points increase
6. Refresh page - your progress is saved!

## Troubleshooting

**"DATABASE_URL not set"**
- You forgot to create `.env.local`
- Check the file exists in `/app` directory

**"Database migration failed"**
- Make sure your Neon database is active
- Check DATABASE_URL format is correct

**"App won't start"**
- Run `npm install` again
- Check Node.js version (need 18+)

## Next Steps

Once it's working:

1. **Test with real AI:** Add OpenRouter API key to `.env.local`
2. **Deploy to Vercel:** `npm run build` then push to GitHub
3. **Add more teams:** Edit `src/lib/game-engine.ts`
4. **Customize UI:** Edit `src/app/page.tsx`

## Need Help?

The full technical documentation is in the parent directory:
- `Documentation/` - Complete specs
- `docs/BRAINSTORM_CONSOLIDATED.md` - Product brainstorm
- `PRD.md` - Product requirements

---

**Status:** Ready to run  
**Build Time:** ~5 minutes  
**Cost:** Free (Neon free tier + Vercel hobby)
