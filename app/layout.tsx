import "./globals.css";

export const metadata = {
  title: "Notion Tasks",
  description: "Unified Notion task hub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-900 text-zinc-50 antialiased" style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
