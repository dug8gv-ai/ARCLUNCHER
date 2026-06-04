import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(req: NextRequest) {
  try {
    const { appUrl, hash, wallet } = await req.json();

    if (!appUrl || !hash || !wallet) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // Attempt to scrape the URL
    const response = await fetch(appUrl, { 
      method: 'GET',
      headers: {
        'User-Agent': 'ArcOmni-Verification-Bot/1.0',
      },
      // timeout handling might be required depending on Next config, but standard fetch is okay for simple pages
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch the URL' }, { status: 400 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for the specific meta tag
    const metaTag = $('meta[name="arcomni-verification"]').attr('content');

    if (metaTag && metaTag === hash) {
      // Validated! Update the database
      const { error } = await supabase
        .from('registered_apps')
        .update({ is_verified: true })
        .match({ verification_hash: hash, developer_wallet: wallet });

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to update verification status in DB' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Meta tag not found or hash mismatch' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown verification error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
