import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * A yes/no remembered on this device only (e.g. "the Board guide was closed"): the Keychain via
 * expo-secure-store on iOS/Android, localStorage on web. Not synced between devices; gone if the
 * app is deleted. Keys: letters, digits, ".", "-" and "_".
 */
async function readFlag(key: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") return window.localStorage.getItem(key) === "1";
    return (await SecureStore.getItemAsync(key)) === "1";
  } catch {
    return false;
  }
}

async function writeFlag(key: string, value: boolean): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (value) window.localStorage.setItem(key, "1");
      else window.localStorage.removeItem(key);
    } else if (value) {
      await SecureStore.setItemAsync(key, "1");
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Storage unavailable (e.g. private browsing): the flag just won't stick.
  }
}

/** `undefined` until the stored value has been read. */
export function useDeviceFlag(key: string): [boolean | undefined, (value: boolean) => void] {
  const [value, setValue] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let isCurrent = true;
    void readFlag(key).then((stored) => {
      if (isCurrent) setValue(stored);
    });
    return () => {
      isCurrent = false;
    };
  }, [key]);

  function update(next: boolean) {
    setValue(next);
    void writeFlag(key, next);
  }

  return [value, update];
}
