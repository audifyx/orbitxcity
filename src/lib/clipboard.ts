import { Platform } from "react-native";
import * as Clipboard from "expo-clipboard";

export async function copyText(value: string): Promise<boolean> {
  const text = value.trim();
  if (!text) {
    return false;
  }

  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
