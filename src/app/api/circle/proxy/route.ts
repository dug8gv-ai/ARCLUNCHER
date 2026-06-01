import { NextRequest, NextResponse } from 'next/server';

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-circle-target-url',
    },
  });
}

const addCorsHeaders = (response: NextResponse) => {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-circle-target-url');
  return response;
};

export async function POST(req: NextRequest) {
  try {
    const targetUrl = req.headers.get('x-circle-target-url');
    
    if (!targetUrl) {
      return addCorsHeaders(NextResponse.json({ error: 'Missing target URL' }, { status: 400 }));
    }

    const kitKey = process.env.CIRCLE_APP_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_APP_KIT_KEY;
    if (!kitKey) {
      return addCorsHeaders(NextResponse.json({ error: 'Missing kit key configuration on server' }, { status: 500 }));
    }

    let body;
    try {
      body = await req.text();
    } catch (e) {
      // Safe fallback if body parsing fails
      body = '';
    }

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
      body: body ? body : undefined
    });

    const responseData = await response.text();

    const res = new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      }
    });

    return addCorsHeaders(res);
  } catch (error: any) {
    console.error('Circle Proxy Error:', error);
    return addCorsHeaders(NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 }));
  }
}

export async function GET(req: NextRequest) {
  try {
    const targetUrl = req.headers.get('x-circle-target-url');
    
    if (!targetUrl) {
      return addCorsHeaders(NextResponse.json({ error: 'Missing target URL' }, { status: 400 }));
    }

    const kitKey = process.env.CIRCLE_APP_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_APP_KIT_KEY;
    if (!kitKey) {
      return addCorsHeaders(NextResponse.json({ error: 'Missing kit key configuration on server' }, { status: 500 }));
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${kitKey}`
    };

    const response = await fetch(targetUrl, {
      method: req.method,
      headers
    });

    const responseData = await response.text();

    const res = new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      }
    });

    return addCorsHeaders(res);
  } catch (error: any) {
    console.error('Circle Proxy Error:', error);
    return addCorsHeaders(NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 }));
  }
}
