import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { BRAND } from '@/constants/brand';

export default function SignInPage() {
  return (
    <div className="auth-page-container">
      <div className="auth-header">
        <Link href="/" className="auth-brand-logo">
          <span>{BRAND.name}</span>
        </Link>

        <p className="auth-subtitle">Sign in to access your dashborad</p>
      </div>

      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-lg border border-[#e5e5e5] rounded-xl',
            formButtonPrimary: 'bg-[#fe551b] hover:bg-[#e0440f] text-white',
          },
        }}
      />
    </div>
  );
}
