import React, { useContext } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, AuthContext } from './src/context/AuthContext';

// Import Screens
import LoginScreen from './src/screens/LoginScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatAreaScreen from './src/screens/ChatAreaScreen';
import ContactDetailScreen from './src/screens/ContactDetailScreen';

const Stack = createStackNavigator();

function NavigationStack() {
  const { user, token, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00a884" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token === null || user === null ? (
        // Unauthenticated Stack
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        // Authenticated Stack
        <>
          <Stack.Screen name="ChatList" component={ChatListScreen} />
          <Stack.Screen name="ChatArea" component={ChatAreaScreen} />
          <Stack.Screen 
            name="ContactDetail" 
            component={ContactDetailScreen} 
            options={{ 
              headerShown: true, 
              title: 'Contact Info',
              headerStyle: { backgroundColor: '#008069' },
              headerTintColor: '#ffffff',
            }} 
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <NavigationStack />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
