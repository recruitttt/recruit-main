"use client";

import { Suspense } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RecruitAuthForm } from "@/components/auth/recruit-auth-form";
import { fadeUp } from "@/lib/motion-presets";

export default function SignUpPage() {
  const reduce = useReducedMotion();

  return (
    <Suspense>
      <motion.div
        initial={reduce ? false : "hidden"}
        animate="visible"
        variants={fadeUp}
      >
        <RecruitAuthForm mode="sign-up" />
      </motion.div>
    </Suspense>
  );
}
