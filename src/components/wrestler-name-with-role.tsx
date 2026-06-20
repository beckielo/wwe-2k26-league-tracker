import type { ReactNode } from "react";
import { getPreviousSplitNameColorRole, type PreviousSplitNameColorRole } from "@/domain/previous-split-name-colors";

const nameColorClassByRole: Record<PreviousSplitNameColorRole, string> = {
  "double-winner": "name-color-double-winner",
  "elite-cup": "name-color-elite-cup",
  "global-champion": "name-color-global-champion",
  "continental-champion": "name-color-continental-champion",
  "national-champion": "name-color-national-champion",
  "regional-champion": "name-color-regional-champion",
  normal: "name-color-normal",
};

function normalized(value?: string | null): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

export function isCurrentUserWrestler(wrestler: string, currentUserWrestler?: string | null): boolean {
  return Boolean(currentUserWrestler && normalized(wrestler) === normalized(currentUserWrestler));
}

export function wrestlerNameRoleClassName(role: PreviousSplitNameColorRole, extraClassName?: string): string {
  return ["wrestler-name-with-role", nameColorClassByRole[role], extraClassName].filter(Boolean).join(" ");
}

export function ControllerIcon({ className }: { className?: string }) {
  return <svg className={["current-user-controller-icon", className].filter(Boolean).join(" ")} viewBox="0 0 24 24" aria-label="Current User" role="img" focusable="false">
    <path d="M7.4 9.2h9.2c2 0 3.7 1.4 4.1 3.3l.7 3.4c.3 1.5-.8 2.9-2.3 2.9-.7 0-1.3-.3-1.8-.8l-1.7-1.8H8.4L6.7 18c-.5.5-1.1.8-1.8.8-1.5 0-2.6-1.4-2.3-2.9l.7-3.4c.4-1.9 2.1-3.3 4.1-3.3Z" />
    <path d="M8 12v3M6.5 13.5h3M15.8 13.3h.01M18.1 13.3h.01" />
  </svg>;
}

export function WrestlerNameWithRole({
  wrestler,
  currentUserWrestler,
  championRoles,
  children,
  className,
}: {
  wrestler: string;
  currentUserWrestler?: string | null;
  championRoles?: Map<string, PreviousSplitNameColorRole>;
  children?: ReactNode;
  className?: string;
}) {
  const role = getPreviousSplitNameColorRole({ wrestler, championRoles });
  const isCurrentUser = isCurrentUserWrestler(wrestler, currentUserWrestler);
  return <span className={wrestlerNameRoleClassName(role, className)}>
    <span className="wrestler-name-text">{children ?? wrestler}</span>
    {isCurrentUser && <ControllerIcon />}
  </span>;
}
