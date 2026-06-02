import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { PocketBaseProvider } from '@/contexts/pocketbase';

import '../styles.css';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <PocketBaseProvider>
        <div className='min-h-screen bg-rm-bg text-rm-text font-body'>
          <Outlet />
        </div>
      </PocketBaseProvider>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  );
}
