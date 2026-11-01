import { Spinner } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

export function LoadingScreen(): JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Spinner />
    </View>
  );
}
