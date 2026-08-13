import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            yolo<span className="text-accent">journal</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Anmelden</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
