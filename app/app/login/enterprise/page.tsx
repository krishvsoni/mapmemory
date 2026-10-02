'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { startEnterpriseLoginAction } from './actions';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/TextInput';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/Card';

const initialState = { error: null };

export default function EnterpriseLoginPage() {
  const [state, formAction, isPending] = useActionState(startEnterpriseLoginAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Enterprise sign-in</h1>
          <p className="text-slate-400 text-sm mt-1">
            Sign in with your organization&apos;s identity provider.
          </p>
        </div>

        <Card title="Your workspace">
          <form action={formAction} className="space-y-3">
            <TextInput name="tenantId" placeholder="Tenant ID" required />
            <ErrorBanner message={state.error} />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Redirecting…' : 'Continue to sign-in'}
            </Button>
          </form>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          Your organization&apos;s admin configures SSO for your tenant and can
          give you your Tenant ID. This redirects to your company&apos;s own
          identity provider — mapmemory never sees your password.
        </p>

        <div className="text-center">
          <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300">
            ← Back to sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
