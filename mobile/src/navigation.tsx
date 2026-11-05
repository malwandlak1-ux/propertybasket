import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './auth';
import { Avatar } from './components/ui';
import LoginScreen from './screens/LoginScreen';
import AgentListingsScreen from './screens/agent/ListingsScreen';
import AgentOverviewScreen from './screens/agent/OverviewScreen';
import AgentPipelineScreen from './screens/agent/PipelineScreen';
import TenantMaintenanceScreen from './screens/tenant/MaintenanceScreen';
import TenantOverviewScreen from './screens/tenant/OverviewScreen';
import TenantPaymentsScreen from './screens/tenant/PaymentsScreen';
import { colors, fonts } from './theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.ink50,
    card: colors.white,
    text: colors.ink800,
    border: colors.ink200,
  },
};

function ProfileScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <View style={styles.profile}>
      <Avatar initials={user.initials} size={72} />
      <Text style={styles.profileName}>{user.name}</Text>
      <Text style={styles.profileMeta}>
        {user.email} · {user.roles.join(', ')}
      </Text>
      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );

export default function Navigation() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  const isAgent = user.roles.includes('agent');

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand600,
          tabBarInactiveTintColor: colors.ink400,
          tabBarLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 10 },
          sceneStyle: { backgroundColor: colors.ink50 },
        }}
      >
        {isAgent ? (
          <>
            <Tab.Screen
              name="Overview"
              component={AgentOverviewScreen}
              options={{ tabBarIcon: icon('grid-outline') }}
            />
            <Tab.Screen
              name="Pipeline"
              component={AgentPipelineScreen}
              options={{ tabBarIcon: icon('funnel-outline') }}
            />
            <Tab.Screen
              name="Listings"
              component={AgentListingsScreen}
              options={{ tabBarIcon: icon('home-outline') }}
            />
          </>
        ) : (
          <>
            <Tab.Screen
              name="Home"
              component={TenantOverviewScreen}
              options={{ tabBarIcon: icon('home-outline') }}
            />
            <Tab.Screen
              name="Payments"
              component={TenantPaymentsScreen}
              options={{ tabBarIcon: icon('card-outline') }}
            />
            <Tab.Screen
              name="Maintenance"
              component={TenantMaintenanceScreen}
              options={{ tabBarIcon: icon('construct-outline') }}
            />
          </>
        )}
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarIcon: icon('person-circle-outline') }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink50 },
  profile: {
    flex: 1,
    backgroundColor: colors.ink50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  profileName: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink900, marginTop: 8 },
  profileMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500 },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white },
});
