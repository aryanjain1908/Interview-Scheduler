import clsx, { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach the merger our custom theme keys (tailwind.config.js) so they resolve correctly.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { shadow: [{ shadow: ["card", "lift"] }] } },
});

/** Join class names; when two Tailwind classes conflict (w-full vs w-52), the later one wins. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
