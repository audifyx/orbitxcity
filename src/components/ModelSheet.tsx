import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";

export type ModelOption = {
  id: string;
  label: string;
  description: string;
};

export type ModelSheetProps = {
  visible: boolean;
  models: ModelOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function ModelSheet({
  visible,
  models,
  selectedId,
  onSelect,
  onClose,
}: ModelSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close model sheet"
        />

        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Select Model</Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {models.map((model) => {
              const isSelected = model.id === selectedId;
              return (
                <Pressable
                  key={model.id}
                  style={({ pressed }) => [
                    styles.item,
                    isSelected && styles.itemSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    onSelect(model.id);
                    onClose();
                  }}
                  accessibilityRole="button"
                >
                  <View style={styles.itemHeader}>
                    <Text
                      style={[
                        styles.itemLabel,
                        isSelected && styles.itemLabelSelected,
                      ]}
                    >
                      {model.label}
                    </Text>
                    {isSelected ? (
                      <Text style={styles.check}>✓</Text>
                    ) : null}
                  </View>
                  <Text style={styles.itemDescription}>{model.description}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.glass,
    paddingTop: 10,
    paddingHorizontal: 16,
    maxHeight: "72%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 8,
  },
  item: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  itemSelected: {
    borderColor: "rgba(126, 182, 255, 0.36)",
    backgroundColor: "rgba(126, 182, 255, 0.08)",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemLabel: {
    color: colors.mist,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  itemLabelSelected: {
    color: colors.frost,
  },
  check: {
    color: colors.signal,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  itemDescription: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.74,
  },
});
