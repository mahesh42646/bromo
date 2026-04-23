import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Register",
  description: `Create a ${site.name} account for the web studio.`,
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
      <RegisterForm />
    </div>
  );
}
