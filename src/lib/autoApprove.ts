import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "orbitx-auto-approve-buys";

export async function readAutoApproveBuys(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === "1";
  } catch {
    return false;
  }
}

export async function writeAutoApproveBuys(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await AsyncStorage.setItem(STORAGE_KEY, "1");
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Local preference only.
  }
}
