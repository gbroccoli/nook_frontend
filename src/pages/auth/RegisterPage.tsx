import {cn} from "@/lib/utils.ts";
import RegisterForm from "@/components/auth/RegisterForm.tsx";

export function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className={cn("flex flex-col gap-6")}>
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
