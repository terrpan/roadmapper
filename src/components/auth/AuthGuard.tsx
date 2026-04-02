import { Show, RedirectToSignIn, useOrganization, OrganizationList } from '@clerk/react';
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
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome to Roadmapper</h2>
          <p className="text-sm text-gray-500 mb-6">
            Create or join an organization to get started.
          </p>
          <OrganizationList
            hidePersonal={true}
            afterSelectOrganizationUrl="/"
            afterCreateOrganizationUrl="/"
          />
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
