import { o as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn, t as authClient } from "./client-CVqXY6bk.mjs";
import { t as GROK_PROVIDERS } from "./server-DUCxmiPA.mjs";
import { n as Input, t as Button } from "./input-CEwoJWnr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-fSwT_EiE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const [mode, setMode] = (0, import_react.useState)("signin");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onEmail(e) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			if (mode === "signup") {
				const res = await authClient.signUp.email({
					email,
					password,
					name: name.trim() || email.split("@")[0] || "Player",
					callbackURL: "/"
				});
				if (res.error) throw new Error(res.error.message || "Could not create account");
			} else {
				const res = await authClient.signIn.email({
					email,
					password,
					callbackURL: "/"
				});
				if (res.error) throw new Error(res.error.message || "Could not sign in");
			}
			window.location.assign("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-bg px-5 py-10 text-fg pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/",
				className: "grid size-12 place-items-center rounded-xl bg-accent text-lg font-medium text-accent-fg",
				"aria-label": "SaveState home",
				children: "S"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-5 text-3xl font-medium tracking-tight",
				children: mode === "signin" ? "Sign in" : "Create account"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Your library syncs with this account. No Steam or PSN login."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 space-y-2",
				children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "secondary",
					className: "w-full",
					onClick: () => signIn(p.providerId, { callbackURL: "/" }),
					children: ["Continue with ", p.label]
				}, p.providerId))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "my-5 flex items-center gap-3 text-xs text-faint",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" }),
					"or email",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "space-y-3",
				onSubmit: onEmail,
				children: [
					mode === "signup" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Name",
						value: name,
						onChange: (e) => setName(e.target.value),
						autoComplete: "name"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "email",
						required: true,
						placeholder: "Email",
						value: email,
						onChange: (e) => setEmail(e.target.value),
						autoComplete: "email"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "password",
						required: true,
						minLength: 8,
						placeholder: "Password",
						value: password,
						onChange: (e) => setPassword(e.target.value),
						autoComplete: mode === "signup" ? "new-password" : "current-password"
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-dropped",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "w-full",
						disabled: busy,
						children: busy ? "Please wait…" : mode === "signin" ? "Sign in with email" : "Create account"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-4 min-h-12 text-sm text-muted hover:text-fg",
				onClick: () => {
					setMode(mode === "signin" ? "signup" : "signin");
					setError(null);
				},
				children: mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"
			})
		]
	});
}
//#endregion
export { Login as component };
