import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './auth';
import { Avatar, UnderHeaderContext } from './components/ui';
import { onPushOpened } from './push';
import ComingSoonScreen from './screens/ComingSoonScreen';
import LoginScreen from './screens/LoginScreen';
import AgentCalendarScreen from './screens/agent/CalendarScreen';
import AgentCommissionScreen from './screens/agent/CommissionScreen';
import AgentFfcScreen from './screens/agent/FfcScreen';
import AgentListingsScreen from './screens/agent/ListingsScreen';
import AgentMaintenanceScreen from './screens/agent/MaintenanceScreen';
import AgentMessagesScreen, { AgentConversationScreen } from './screens/agent/MessagesScreen';
import MoreScreen, { MORE_ITEMS, MoreStackParams } from './screens/agent/MoreScreen';
import AgentOverviewScreen from './screens/agent/OverviewScreen';
import AgentPipelineScreen from './screens/agent/PipelineScreen';
import AgentTenantsScreen from './screens/agent/TenantsScreen';
import TenantMaintenanceScreen from './screens/tenant/MaintenanceScreen';
import TenantOverviewScreen from './screens/tenant/OverviewScreen';
import TenantPaymentsScreen from './screens/tenant/PaymentsScreen';
import { colors, fonts } from './theme';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator<MoreStackParams>();
const navigationRef = createNavigationContainerRef<any>();

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

/** Screens behind "More" that already have a real implementation. */
const BUILT: Partial<Record<keyof MoreStackParams, React.ComponentType<any>>> = {
  Leads: AgentPipelineScreen,
  Messages: AgentMessagesScreen,
  Tenants: AgentTenantsScreen,
  Maintenance: AgentMaintenanceScreen,
  Commission: AgentCommissionScreen,
  'FFC & Compliance': AgentFfcScreen,
};

function AgentMoreStack() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.display, color: colors.ink900 },
        headerTintColor: colors.brand600,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.ink50 },
        contentStyle: { backgroundColor: colors.ink50 },
        headerBackButtonDisplayMode: 'minimal',
      }}
      // Sub-screens sit under a header, so they skip the status-bar inset.
      screenLayout={({ children }) => <UnderHeaderContext.Provider value>{children}</UnderHeaderContext.Provider>}
    >
      <MoreStack.Screen name="More" component={MoreScreen} />
      {MORE_ITEMS.map((item) => (
        <MoreStack.Screen key={item.name} name={item.name} component={BUILT[item.name] ?? ComingSoonScreen} />
      ))}
      <MoreStack.Screen
        name="Conversation"
        component={AgentConversationScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </MoreStack.Navigator>
  );
}

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
  const isAgent = !!user?.roles.includes('agent');

  // Tapping a push opens the right place: reminder → that day, lead → Leads.
  useEffect(() => {
    if (!isAgent) return;
    return onPushOpened((data) => {
      const go = () => {
        if (data.type === 'reminder') navigationRef.navigate('Calendar', { date: data.date });
        else navigationRef.navigate('MoreTab', { screen: 'Leads' });
      };
      if (navigationRef.isReady()) go();
      else setTimeout(go, 500);
    });
  }, [isAgent]);

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <NavigationContainer theme={navTheme} ref={navigationRef}>
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
            <Tab.Screen name="Dashboard" component={AgentOverviewScreen} options={{ tabBarIcon: icon('grid-outline') }} />
            <Tab.Screen name="CRM" component={ComingSoonScreen} options={{ tabBarIcon: icon('people-circle-outline') }} />
            <Tab.Screen name="Calendar" component={AgentCalendarScreen} options={{ tabBarIcon: icon('calendar-outline') }} />
            <Tab.Screen name="Listings" component={AgentListingsScreen} options={{ tabBarIcon: icon('home-outline') }} />
            <Tab.Screen
              name="MoreTab"
              component={AgentMoreStack}
              options={{ title: 'More', tabBarIcon: icon('menu-outline') }}
            />
          </>
        ) : (
          <>
            <Tab.Screen name="Home" component={TenantOverviewScreen} options={{ tabBarIcon: icon('home-outline') }} />
            <Tab.Screen name="Payments" component={TenantPaymentsScreen} options={{ tabBarIcon: icon('card-outline') }} />
            <Tab.Screen name="Maintenance" component={TenantMaintenanceScreen} options={{ tabBarIcon: icon('construct-outline') }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: icon('person-circle-outline') }} />
          </>
        )}
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
