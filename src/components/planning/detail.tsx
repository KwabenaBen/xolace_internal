import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { View } from "react-native";

/** A labelled block of read-only text on a feature/task page. */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <View className="gap-1">
      <Typography type="body-xs" color="muted" weight="medium">
        {label}
      </Typography>
      {typeof children === "string" ? <Typography type="body">{children}</Typography> : children}
    </View>
  );
}

/** A titled list section with a count, e.g. "Tasks · 3". */
export function Section({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  /** Shown instead of the children when `count` is 0. */
  empty?: string;
}): JSX.Element {
  return (
    <View className="gap-3">
      <Typography.Heading type="h5">
        {count !== undefined ? `${title} · ${count}` : title}
      </Typography.Heading>
      {count === 0 && empty !== undefined ? (
        <Typography type="body-sm" color="muted">
          {empty}
        </Typography>
      ) : (
        children
      )}
    </View>
  );
}
