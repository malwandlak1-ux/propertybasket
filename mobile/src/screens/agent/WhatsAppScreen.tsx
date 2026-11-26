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
import { Badge, Card, LoadState } from '../../components/ui';
import { CrmStackParams } from '../../crm';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface Thread {
  phone: string;
  display: string;
  owner: string | null;
  last: string | null;
  at: string | null;
  open: boolean;
}

interface WhatsAppPage {
  account: { display_phone: string | null; verified_name: string | null; status: string; quality_rating: string | null } | null;
  threads: Thread[];
  campaigns: { id: number; name: string; status: string }[];
}

interface ChatMessage {
  id: number;
  direction: 'in' | 'out';
  body: string | null;
  media: { name: string | null; kind: string } | null;
  status: string;
  campaign: string | null;
  at: string | null;
}

interface ChatPage {
  display: string;
  prospect: { owner: string; unit: string | null; scheme: string | null; opted_out: boolean } | null;
  window_open_until: string | null;
  messages: ChatMessage[];
}

/* ---------- Inbox ---------- */

export default function AgentWhatsAppScreen() {
  const nav = useNavigation<NativeStackNavigationProp<CrmStackParams>>();
  const { data, error, refreshing, reload, onRefresh } = usePage<WhatsAppPage>('/agent/crm/whatsapp');

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) return <LoadState error={error} onRetry={reload} />;

  if (!data.account) {
    return (
      <View style={styles.center}>
        <Ionicons name="logo-whatsapp" size={44} color={colors.ink300} />
        <Text style={styles.emptyTitle}>WhatsApp isn't connected yet</Text>
        <Text style={styles.hintCenter}>
          Connect your own WhatsApp Business number under CRM → WhatsApp on the website. Once it's connected, owners' replies
          show here and you can answer them from your phone.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <Card style={styles.account}>
        <Ionicons name="logo-whatsapp" size={22} color="#128C7E" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{data.account.verified_name ?? 'WhatsApp Business'}</Text>
          <Text style={styles.hint}>{data.account.display_phone ?? ''}</Text>
        </View>
        <Badge tone={data.account.status === 'connected' ? 'success' : 'warning'}>{data.account.status.toUpperCase()}</Badge>
      </Card>

      {data.threads.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={36} color={colors.ink300} />
          <Text style={styles.emptyTitle}>No replies yet</Text>
          <Text style={styles.hintCenter}>When an owner answers one of your campaigns, the conversation appears here.</Text>
        </View>
      ) : (
        <Card style={{ padding: 0 }}>
          {data.threads.map((t, i) => (
            <Pressable
              key={t.phone}
              style={[styles.row, i > 0 && styles.rowBorder]}
              onPress={() => nav.navigate('WhatsAppChat', { phone: t.phone, title: t.owner ?? t.display })}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {t.owner ?? t.display}
                  </Text>
                  <Text style={styles.time}>{t.at}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {t.last ?? ''}
                </Text>
              </View>
              {t.open ? <Badge tone="success">CAN REPLY</Badge> : null}
            </Pressable>
          ))}
        </Card>
      )}

      <Text style={styles.note}>Campaigns and message templates are set up on the website.</Text>
    </ScrollView>
  );
}

/* ---------- One conversation ---------- */

const POLL_MS = 15_000;

export function AgentWhatsAppChatScreen() {
  const route = useRoute<RouteProp<CrmStackParams, 'WhatsAppChat'>>();
  const insets = useSafeAreaInsets();
  const { phone } = route.params;

  const [chat, setChat] = useState<ChatPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<PageResponse<ChatPage>>(`/agent/crm/whatsapp/chat?phone=${encodeURIComponent(phone)}`);
      setChat(r.data);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [phone]);

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
      await api.post('/agent/crm/whatsapp/chat', { phone, body });
      setDraft('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }

  if (!chat) return <LoadState error={error} onRetry={load} />;

  const canReply = !!chat.window_open_until && !chat.prospect?.opted_out;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {chat.prospect ? (
        <Text style={styles.context}>
          {[chat.prospect.scheme, chat.prospect.unit ? `Unit ${chat.prospect.unit}` : null, chat.display].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      <ScrollView ref={scroller} contentContainerStyle={styles.thread} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        {chat.messages.map((m) => {
          const mine = m.direction === 'out';
          return (
            <View key={m.id} style={[styles.bubble, mine ? styles.bubbleSelf : styles.bubbleOther]}>
              {m.campaign ? <Text style={[styles.campaign, mine && { color: colors.brand100 }]}>Campaign · {m.campaign}</Text> : null}
              {m.media ? (
                <Text style={[styles.media, mine && { color: colors.white }]}>
                  [{m.media.kind}
                  {m.media.name ? `: ${m.media.name}` : ''}] Open on the website to view
                </Text>
              ) : null}
              {m.body ? <Text style={[styles.bubbleText, mine && { color: colors.white }]}>{m.body}</Text> : null}
              <Text style={[styles.bubbleTime, mine && { color: colors.brand100 }]}>
                {m.at}
                {mine ? ` · ${m.status}` : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.sendError}>{error}</Text> : null}

      {canReply ? (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing(2)) }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={`Reply (open until ${chat.window_open_until})`}
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
      ) : (
        <View style={[styles.closed, { paddingBottom: Math.max(insets.bottom, spacing(3)) }]}>
          <Text style={styles.closedText}>
            {chat.prospect?.opted_out
              ? 'This owner opted out of WhatsApp messages.'
              : 'WhatsApp only allows free replies within 24 hours of the owner’s last message. Send an approved template from the website to reopen the chat.'}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(4) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(3), padding: spacing(8), backgroundColor: colors.ink50 },
  empty: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(12), paddingHorizontal: spacing(6) },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink800, textAlign: 'center' },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  hintCenter: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center', lineHeight: 19 },
  note: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink400, textAlign: 'center' },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  name: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink900 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3) },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.ink100 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  time: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink400 },
  preview: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, marginTop: 2 },
  context: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.ink500,
    textAlign: 'center',
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
  thread: { padding: spacing(4), gap: spacing(2), flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  bubbleSelf: { alignSelf: 'flex-end', backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink800, lineHeight: 21 },
  bubbleTime: { fontFamily: fonts.sans, fontSize: 10, color: colors.ink400, alignSelf: 'flex-end', marginTop: 2 },
  campaign: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.ink400, marginBottom: 2 },
  media: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink700, fontStyle: 'italic' },
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
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  closed: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.ink200, paddingHorizontal: spacing(4), paddingTop: spacing(3) },
  closedText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center', lineHeight: 19 },
});
