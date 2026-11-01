import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where Convex Auth keeps its tokens. iOS/Android use the Keychain/Keystore via
 * expo-secure-store; on web, `undefined` makes Convex Auth fall back to localStorage
 * (expo-secure-store has no web implementation).
 */
export const authStorage =
  Platform.OS === "web"
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
