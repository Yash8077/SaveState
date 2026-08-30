import { View, Text, StyleSheet } from 'react-native';

export function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Library Screen Placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1416',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
  },
});
