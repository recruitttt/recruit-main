import { Suspense } from "react";
import { RecruitAuthForm } from "@/components/auth/recruit-auth-form";

export default function SignInPage() {
  return (
    <Suspense>
      <RecruitAuthForm mode="sign-in" />
    </Suspense>
  );
}
