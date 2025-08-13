import './globals.css';
import { ReactNode } from 'react';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TaskTrek - Project Management',
  description: 'Collaborative task and project management platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </body>
    </html>
  );
}
