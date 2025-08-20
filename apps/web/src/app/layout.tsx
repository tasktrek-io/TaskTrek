import './globals.css';
import { ReactNode } from 'react';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { SocketProvider } from '../contexts/SocketContext';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TaskTrek - Project Management',
  description: 'Collaborative task and project management platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <SocketProvider>
          <WorkspaceProvider>
            {children}
          </WorkspaceProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
