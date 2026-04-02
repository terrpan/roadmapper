import { Show, RedirectToSignIn, useOrganization } from '@clerk/react';
import type { ReactNode } from 'react';

function OrgRequired({ children }: { children: ReactNode }) {
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No organization selected</h2>
          <p className="text-sm text-gray-500 mb-4">
            Create or select an organization to get started.
            <br />
            Use the organization switcher in the header.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  return (
    <Show
      when="signed-in"
      fallback={<RedirectToSignIn />}
    >
      <OrgRequired>{children}</OrgRequired>
    </Show>
  );
}
