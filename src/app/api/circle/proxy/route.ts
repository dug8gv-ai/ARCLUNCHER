import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const targetUrl = req.headers.get('x-circle-target-url');
    
    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
    }

    const kitKey = process.env.CIRCLE_APP_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_APP_KIT_KEY;
    if (!kitKey) {
      return NextResponse.json({ error: 'Missing kit key configuration on server' }, { status: 500 });
    }

    const body = await req.text();
    const headers: Record<string, string> = {
      'Content-Type': req.headers.get('content-type') || 'application/json',
      'Authorization': `Bearer ${kitKey}`
    };

    // Forward specific headers if present
    const userAgent = req.headers.get('user-agent');
    if (userAgent) headers['User-Agent'] = userAgent;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body || undefined
    });

    const responseData = await response.text();

    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Circle Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const targetUrl = req.headers.get('x-circle-target-url');
    
    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
    }

    const kitKey = process.env.CIRCLE_APP_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_APP_KIT_KEY;
    if (!kitKey) {
      return NextResponse.json({ error: 'Missing kit key configuration on server' }, { status: 500 });
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${kitKey}`
    };

    const response = await fetch(targetUrl, {
      method: req.method,
      headers
    });

    const responseData = await response.text();

    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Circle Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
