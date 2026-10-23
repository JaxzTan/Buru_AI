import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "verify" | "danger" | "ghost";
  size?: "md" | "sm";
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cx("uk-btn", "uk-btn-" + variant, size === "sm" && "uk-btn-sm", className)}
    />
  );
}
