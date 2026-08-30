import { View, Text, TextInput, StyleSheet, FlatList } from 'react-native';
import { useState } from 'react';
import { searchGames } from '../api/client';
import { useQuery } from '@tanstack/react-query';

export function SearchScreen() {
  const [query, setQuery] = useState('');

  const { data: games, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchGames(query),
    enabled: query.length > 2,
  });

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search games..."
        placeholderTextColor="#888"
        value={query}
        onChangeText={setQuery}
      />
      
      {isLoading ? (
        <Text style={styles.text}>Searching...</Text>
      ) : (
        <FlatList
          data={games || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1416',
    padding: 16,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  text: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});
