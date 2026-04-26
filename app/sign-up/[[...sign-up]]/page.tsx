import { Suspense } from "react";
import { RecruitAuthForm } from "@/components/auth/recruit-auth-form";

export default function SignUpPage() {
  return (
    <Suspense>
      <RecruitAuthForm mode="sign-up" />
    </Suspense>
  );
}
