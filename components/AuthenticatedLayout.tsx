"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import ContrastDiagnostic from "@/components/ContrastDiagnostic";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
      <ContrastDiagnostic />
    </div>
  );
}
