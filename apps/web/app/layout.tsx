import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trackoot",
  description: "A real-time Spotify music quiz",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
