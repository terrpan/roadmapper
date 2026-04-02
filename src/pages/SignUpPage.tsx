import { SignUp } from '@clerk/react';

export function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
