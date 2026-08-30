import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { a as cn } from "./router-BQDdMn6j.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/input-CEwoJWnr.js
var import_jsx_runtime = require_jsx_runtime();
var buttonVariants = cva("inline-flex items-center justify-center gap-2 font-medium tracking-[0.01em] transition-colors duration-150 ease-[var(--ease-smooth-out)] active:not-disabled:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50", {
	variants: {
		variant: {
			primary: "bg-accent text-accent-fg hover:brightness-110",
			secondary: "bg-subtle text-fg hover:bg-elevated",
			ghost: "text-muted hover:bg-subtle hover:text-fg",
			danger: "bg-dropped/15 text-dropped hover:bg-dropped/25"
		},
		size: {
			sm: "h-9 rounded-full px-3.5 text-sm",
			md: "h-11 rounded-full px-5 text-sm",
			lg: "h-12 rounded-full px-6 text-base",
			icon: "size-12 rounded-full"
		}
	},
	defaultVariants: {
		variant: "primary",
		size: "md"
	}
});
function Button({ className, variant, size, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-12 w-full rounded-md rounded-b-sm border-0 border-b border-border-strong bg-subtle px-3.5 text-base text-fg placeholder:text-faint", "transition-[border-color,box-shadow] duration-150", "focus:border-accent focus:outline-none focus:ring-0", className),
		...props
	});
}
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("min-h-28 w-full rounded-md rounded-b-sm border-0 border-b border-border-strong bg-subtle px-3.5 py-3 text-base text-fg placeholder:text-faint", "focus:border-accent focus:outline-none", className),
		...props
	});
}
//#endregion
export { Input as n, Textarea as r, Button as t };
