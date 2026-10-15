import type { Metadata } from "next";
import "./deskkit.css";
import "./app.css";

export const metadata: Metadata = {
  title: "glassing",
  description: "jobs that fit your resume, checked every hour",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
