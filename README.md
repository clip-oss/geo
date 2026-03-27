# GEO Audit Landing Page

A lead generation landing page that checks if local businesses appear in AI recommendations (ChatGPT and Claude). Business owners enter their details and receive an email report showing their "GEO Visibility Score."

## Features

- **Landing Page**: Professional, conversion-focused design targeting law firms, med spas, and service businesses
- **GEO Audit API**: Checks if a business appears in Claude and ChatGPT recommendations
- **Email Reports**: Automated HTML email reports with visibility scores and competitor analysis
- **Lead Storage**: Supabase integration for storing audit leads
- **Rate Limiting**: IP-based rate limiting (10 audits per hour)

## Tech Stack

- **Frontend**: Next.js 16, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI APIs**: Anthropic Claude, OpenAI ChatGPT
- **Email**: Gmail API (optional)
- **Icons**: Lucide React

## Getting Started

### 1. Clone and Install

```bash
cd geo-audit
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your API keys:

```bash
cp .env.example .env.local
```

Required environment variables:
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key
- `GMAIL_ACCESS_TOKEN` (optional) - Gmail API access token for sending emails
- `NEXT_PUBLIC_CALENDLY_URL` - Your Calendly booking link

### 3. Set Up Supabase

Run the SQL in `supabase-schema.sql` in your Supabase SQL Editor to create the `audit_leads` table.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── audit/
│   │       └── route.ts      # POST /api/audit endpoint
│   ├── globals.css           # Tailwind CSS + custom theme
│   ├── layout.tsx            # Root layout with fonts
│   └── page.tsx              # Landing page
└── lib/
    ├── email-generator.ts    # HTML email generation with humanizer
    ├── geo-check.ts          # Claude + ChatGPT API calls
    ├── gmail.ts              # Gmail API integration
    ├── rate-limit.ts         # IP-based rate limiting
    └── supabase.ts           # Supabase client + types
```

## API Endpoint

### POST /api/audit

Request body:
```json
{
  "businessName": "Acme Law Firm",
  "city": "Los Angeles",
  "email": "owner@acmelawfirm.com"
}
```

Response (200):
```json
{
  "success": true,
  "message": "Your GEO audit is being processed. Check your inbox within 5 minutes.",
  "leadId": "uuid-here"
}
```

The API:
1. Validates input and checks rate limits
2. Creates a lead record in Supabase
3. Returns success immediately (async processing)
4. In background: runs GEO check, generates email, sends report

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

The project is optimized for Vercel's serverless functions.

## Customization

### Change Agency Name

Search for "GEO Agency" in `src/app/page.tsx` and replace with your agency name.

### Update Calendly Link

Set `NEXT_PUBLIC_CALENDLY_URL` in your environment variables.

### Modify Email Template

Edit `src/lib/email-generator.ts` to customize the email report design.

### Adjust Rate Limits

Edit `src/lib/rate-limit.ts` to change the rate limit (default: 10 per hour per IP).

## License

Private - All rights reserved.
