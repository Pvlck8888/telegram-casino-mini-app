# Telegram Casino Mini App

### Premium Telegram Mini App Casino with 12+ Games, Admin Panel & Full Economy System

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Telegram](https://img.shields.io/badge/Telegram-Mini%20App-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots/webapps)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GoMoneyGo.xyz-ff6b35?logo=googlechrome&logoColor=white)](https://GoMoneyGo.xyz)

---

## Live Demo

**Try it now:** [GoMoneyGo.xyz](https://GoMoneyGo.xyz)

---

## Overview

A **production-ready** Telegram Mini App casino platform featuring **12+ fully functional games**, real-time multiplayer poker, comprehensive admin controls, and a complete economy system with USDT currency. Built with modern technologies and optimized for mobile Telegram experience.

**36,000+ lines of code** | **106 source files** | **Full-stack TypeScript**

---

## Games

| Game | Type | Description |
|------|------|-------------|
| **Poker** | Multiplayer | Full poker rooms with bot opponents, buy-in/rebuy, hand evaluation, Spin&Go tournaments |
| **Blackjack** | Card Game | Classic 21 with split, double down, insurance |
| **The Luxe Slots** | Premium Slots | 5x4 reels, bonus rounds (Velvet Nights, Black/Gold, Golden Hits), multiplier frames |
| **Egypt Treasures** | Themed Slots | Egyptian-themed slot machine with unique symbols and bonus features |
| **Crash** | Multiplier | Rising multiplier with cash-out mechanics |
| **Avia Masters** | Multiplier | Aviation-themed crash game variant |
| **Mines** | Strategy | Minesweeper-style risk/reward game |
| **Minedrop** | Strategy | Mine avoidance game with progressive rewards |
| **Dice** | Classic | Dice rolling with various bet types |
| **Rock Paper Scissors** | Classic | PvE with animated gameplay |
| **Turtle Race** | Betting | Animated turtle racing with odds |
| **Daily Fortune Wheel** | Bonus | Free daily spin with prizes up to $12 |

---

## Key Features

### Player Features
- **Telegram Authentication** -- Native Telegram login, no registration needed
- **USDT Currency System** -- Real currency with decimal betting from $0.10
- **Stars Currency** -- Secondary currency convertible to USDT (50 Stars = $1)
- **Wallet System** -- TON & USDT TRC20 deposit/withdrawal support
- **Referral Program** -- Invite friends and earn bonuses
- **Promo Codes** -- Redeemable promotional codes with various rewards
- **VIP System** -- Tiered VIP levels based on total deposits
- **Daily Fortune Wheel** -- Free daily spin with 6 prize tiers
- **Live Win Ticker** -- Real-time display of recent wins across all games
- **Animated Promo Banners** -- Auto-rotating promotional slideshow
- **Multi-language** -- Russian, English, Hebrew, Arabic

### Admin Panel
- **Game Control** -- Enable/disable individual games
- **Win Rate Management** -- Adjustable RTP (Return to Player) per game
- **Win Limiting System** -- Max win multiplier and loss recovery caps
- **User Management** -- View all users, manage balances, VIP tiers
- **Promo Code Generator** -- Create and manage promotional codes
- **Raffle System** -- Create raffles with animated winner selection
- **Broadcast Messages** -- Send messages to all users via Telegram bot
- **Deposit Address Config** -- Configure TON/USDT wallet addresses
- **Guest Cleanup** -- Bulk remove guest/test accounts
- **Real-time Statistics** -- User count, total bets, revenue tracking

### Technical Highlights
- **Full-stack TypeScript** -- Type-safe frontend and backend
- **PostgreSQL Database** -- Robust data storage with Drizzle ORM
- **Telegram Bot Integration** -- Dedicated bot with /start, referrals, broadcasts
- **WebSocket Support** -- Real-time poker multiplayer
- **Responsive Design** -- Mobile-first, optimized for Telegram viewport
- **Haptic Feedback** -- Native Telegram haptic responses
- **Sound System** -- Game-specific sound effects and audio controls
- **Dark Theme** -- Premium gaming aesthetic

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL with Drizzle ORM |
| **Telegram** | @telegram-apps/sdk-react, node-telegram-bot-api |
| **State** | TanStack Query v5 |
| **Routing** | Wouter |
| **Payments** | TON Connect, Telegram Stars |

---

## Project Structure

```
├── client/                 # Frontend React application
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Game pages and views
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities and helpers
├── server/                 # Backend Express server
│   ├── routes.ts           # API endpoints (4700+ lines)
│   ├── storage.ts          # Database operations
│   └── bot.ts              # Telegram bot service
├── shared/                 # Shared types and schema
│   └── schema.ts           # Database schema (Drizzle)
└── attached_assets/        # Game images and assets
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/telegram-casino-mini-app.git
cd telegram-casino-mini-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### Production Build

```bash
npm run build
npm run start
```

---

## Screenshots

The app features a dark premium gaming aesthetic with:
- Animated game lobby with category icons
- Real-time win ticker and promo slideshow
- Full-featured admin dashboard
- Responsive Telegram Mini App interface

---

## Economy System

| Feature | Details |
|---------|---------|
| **Primary Currency** | USDT (USD Tether) |
| **Minimum Bet** | $0.10 |
| **Stars Exchange** | 50 Stars = $1 USD |
| **Win Limiting** | Configurable max multiplier (default 50x) |
| **Loss Recovery** | Adjustable recovery percentage (default 50%) |
| **VIP Tiers** | Based on total deposit volume |
| **Referral Bonus** | Configurable via admin panel |

---

## Admin Access

Admin rights are assigned via the `isAdmin` flag in the database. Set it to `true` for your user account after first login. Admin panel is accessible via the settings menu with full control over:
- All game parameters and win rates
- User balances and VIP status
- Promo codes and raffles
- Broadcast messaging
- Deposit/withdrawal management

---

## License

This project is sold as-is for commercial use. All rights transfer to the buyer upon purchase.

---

## Contact

**Telegram:** [@Nahalist](https://t.me/Nahalist)

For purchase inquiries, customization requests, or technical questions -- message me directly on Telegram.

---

**Built with modern technologies for maximum performance and scalability.**
