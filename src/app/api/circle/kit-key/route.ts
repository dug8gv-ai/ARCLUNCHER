import { NextResponse } from 'next/server';

export async function GET() {
  const kitKey = process.env.CIRCLE_APP_KIT_KEY || '';
  
  if (!kitKey) {
    return NextResponse.json({ error: 'Kit key not configured' }, { status: 500 });
  }

  return NextResponse.json({ kitKey });
}
