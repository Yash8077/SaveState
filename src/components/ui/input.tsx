import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-md rounded-b-sm border-0 border-b border-border-strong bg-subtle px-3.5 text-base text-fg placeholder:text-faint",
        "transition-[border-color,box-shadow] duration-150",
        "focus:border-accent focus:outline-none focus:ring-0",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md rounded-b-sm border-0 border-b border-border-strong bg-subtle px-3.5 py-3 text-base text-fg placeholder:text-faint",
        "focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
