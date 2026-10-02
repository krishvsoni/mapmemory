import { NextResponse } from 'next/server';

const API_URL = process.env.MAPMEMORY_API_URL ?? 'http://localhost:4000';

export function GET(): NextResponse {
  return NextResponse.redirect(`${API_URL}/v1/auth/kinde/login`);
}
