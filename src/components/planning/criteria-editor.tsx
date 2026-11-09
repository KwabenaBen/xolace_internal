import { Ionicons } from "@expo/vector-icons";
import { Button, Input, Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

/**
 * Editable list of acceptance criteria — the checklist the verifier ticks off later.
 * Blank rows are ignored on save.
 */
export function CriteriaEditor({
  value,
  onChange,
  label = "Acceptance criteria",
  hint,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  hint?: string;
}): JSX.Element {
  const muted = useThemeColor("muted");
  const rows = value.length === 0 ? [""] : value;

  function update(index: number, text: string) {
    onChange(rows.map((row, i) => (i === index ? text : row)));
  }
  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <View className="gap-2">
      <View className="gap-0.5">
        <Typography type="body-sm" weight="medium">
          {label}
        </Typography>
        {hint !== undefined ? (
          <Typography type="body-xs" color="muted">
            {hint}
          </Typography>
        ) : null}
      </View>
      {rows.map((row, index) => (
        <View key={index} className="flex-row items-center gap-2">
          <Typography type="body-sm" color="muted" className="w-5 text-right">
            {index + 1}.
          </Typography>
          <Input
            className="flex-1"
            value={row}
            onChangeText={(text) => update(index, text)}
            placeholder="e.g. Works on a small iPhone"
            accessibilityLabel={`Criterion ${index + 1}`}
          />
          {rows.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove criterion ${index + 1}`}
              hitSlop={8}
              onPress={() => remove(index)}
              className="active:opacity-60"
            >
              <Ionicons name="close-circle" size={22} color={muted} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onPress={() => onChange([...rows, ""])}
      >
        + Add criterion
      </Button>
    </View>
  );
}
