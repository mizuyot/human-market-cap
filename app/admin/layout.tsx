import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "査定管理 | 人間時価総額 CALCULATOR",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
