import './globals.css';
import { Providers } from './providers';
import { ToastProvider } from '../components/ToastProvider';

export const metadata = {
  title: 'NL2SQL Generator',
  description: 'Natural Language to SQL Generator Tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased">
        <Providers>
          <ToastProvider />
          {children}
        </Providers>
      </body>
    </html>
  );
}

