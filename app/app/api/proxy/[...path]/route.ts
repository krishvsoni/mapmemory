import { NextResponse, type NextRequest } from 'next/server';
import { getApiKey } from '@/lib/session';

const API_URL = process.env.MAPMEMORY_API_URL ?? 'http://localhost:4000';
const BLOCKED_PREFIXES = ['v1/internal', 'v1/webhooks'];

// Routes any future client-side fetch through the server so the real backend origin never appears in the browser's network tab.
async function forward(request: NextRequest, segments: string[]): Promise<NextResponse> {
  const path = segments.join('/');
  if (BLOCKED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'Not found' }, { status: 404 });
  }

  const apiKey = await getApiKey();
  const headers = new Headers();
  headers.set('Content-Type', request.headers.get('content-type') ?? 'application/json');
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const response = await fetch(`${API_URL}/${path}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : undefined,
    cache: 'no-store',
  });

  const responseBody = await response.text();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' },
  });
}

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return forward(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return forward(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return forward(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return forward(request, (await context.params).path);
}
