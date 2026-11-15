import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorText, PageResponse } from '../../api';
import { Avatar, Card, LoadState } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface ConversationRow {
  id: number;
  title: string;
  initials: string;
  preview: string;
  updated_at: string;
  unread_count: number;
}

type ThreadItem =
  | { type: 'date_divider'; label: string }
  | { type: 'message'; id: number; body: string; sender_name: string | null; is_self: boolean; created_at: string };

interface MessagesPage {
  conversations: ConversationRow[];
  active: { id: number; title: string; initials: string } | null;
  messages: ThreadItem[];
}

export type MessagesStackParams = {
  Messages: undefined;
  Conversation: { id: number; title: string };
};

/* ---------- Conversation list ---------- */

export default function AgentMessagesScreen() {
  const nav = useNavigation<NativeStackNavigationProp<MessagesStackParams>>();
  const { data, error, refreshing, reload, onRefresh } = usePage<MessagesPage>('/agent/messages');

  // Refresh unread counts when coming back from a thread.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) return <LoadState error={error} onRetry={reload} />;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      {data.conversations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={36} color={colors.ink300} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.hint}>Messages from your agency, clients and contractors will show here.</Text>
        </View>
      ) : (
        <Card style={{ padding: 0 }}>
          {data.conversations.map((c, i) => (
            <Pressable
              key={c.id}
              style={[styles.row, i > 0 && styles.rowBorder]}
              onPress={() => nav.navigate('Conversation', { id: c.id, title: c.title })}
              accessibilityRole="button"
              accessibilityLabel={`${c.title}${c.unread_count ? `, ${c.unread_count} unread` : ''}`}
            >
              <Avatar initials={c.initials} size={42} />
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, c.unread_count > 0 && styles.nameUnread]} numberOfLines={1}>
                    {c.title}
                  </Text>
                  <Text style={styles.time}>{c.updated_at}</Text>
                </View>
                <Text style={[styles.preview, c.unread_count > 0 && styles.previewUnread]} numberOfLines={1}>
                  {c.preview}
                </Text>
              </View>
              {c.unread_count > 0 ? (
                <View style={styles.unread}>
                  <Text style={styles.unreadText}>{c.unread_count}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

/* ---------- One thread ---------- */

const POLL_MS = 15_000;

export function AgentConversationScreen() {
  const route = useRoute<RouteProp<MessagesStackParams, 'Conversation'>>();
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const [items, setItems] = useState<ThreadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<PageResponse<MessagesPage>>(`/agent/messages?conversation_id=${id}`);
      setItems(r.data.messages);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);

  // Load now, then poll while the thread is open.
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api.post(`/agent/messages/${id}`, { body });
      setDraft('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }

  if (!items) return <LoadState error={error} onRetry={load} />;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {items.length === 0 ? <Text style={[styles.hint, { textAlign: 'center' }]}>No messages yet. Say hello.</Text> : null}
        {items.map((m, i) =>
          m.type === 'date_divider' ? (
            <Text key={`d${i}`} style={styles.divider}>
              {m.label}
            </Text>
          ) : (
            <View key={m.id} style={[styles.bubble, m.is_self ? styles.bubbleSelf : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, m.is_self && { color: colors.white }]}>{m.body}</Text>
              <Text style={[styles.bubbleTime, m.is_self && { color: colors.brand100 }]}>{m.created_at}</Text>
            </View>
          ),
        )}
      </ScrollView>

      {error ? <Text style={styles.sendError}>{error}</Text> : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing(2)) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message"
          placeholderTextColor={colors.ink400}
          multiline
          accessibilityLabel="Message"
        />
        <Pressable
          style={[styles.send, (!draft.trim() || sending) && { opacity: 0.5 }]}
          onPress={send}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          {sending ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="send" size={18} color={colors.white} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  empty: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(16), paddingHorizontal: spacing(6) },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink800 },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3) },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.ink100 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  name: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink800 },
  nameUnread: { fontFamily: fonts.sansBold, color: colors.ink900 },
  time: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink400 },
  preview: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, marginTop: 2 },
  previewUnread: { fontFamily: fonts.sansSemiBold, color: colors.ink800 },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.white },
  thread: { padding: spacing(4), gap: spacing(2), flexGrow: 1, justifyContent: 'flex-end' },
  divider: {
    alignSelf: 'center',
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.ink500,
    backgroundColor: colors.ink100,
    borderRadius: radius.full,
    paddingHorizontal: spacing(3),
    paddingVertical: 3,
    overflow: 'hidden',
    marginVertical: spacing(2),
  },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  bubbleSelf: { alignSelf: 'flex-end', backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink800, lineHeight: 21 },
  bubbleTime: { fontFamily: fonts.sans, fontSize: 10, color: colors.ink400, alignSelf: 'flex-end', marginTop: 2 },
  sendError: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.danger, paddingHorizontal: spacing(4), paddingBottom: spacing(1) },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.ink200,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.xl,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink900,
    backgroundColor: colors.ink50,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
