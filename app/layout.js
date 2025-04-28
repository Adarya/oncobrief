import './globals.css';

export const metadata = {
  title: 'OncoBrief - Weekly Oncology Research Digest',
  description: 'A weekly summary of the latest oncology research papers from selected journals.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
} 