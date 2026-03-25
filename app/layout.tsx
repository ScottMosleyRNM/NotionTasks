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
      <body style={{ margin: 0, fontFamily: "Inter, Arial, sans-serif", background: "#18181b" }}>
        {children}
      </body>
    </html>
  );
}
