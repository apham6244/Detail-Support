/**
 * cn — join conditional class names into a single string.
 * Keeps falsy values out so components stay readable:
 *   cn("btn", isActive && "btn-active", disabled && "opacity-50")
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
