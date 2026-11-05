/**
 * Voice notes for WhatsApp replies.
 *
 * WhatsApp only shows a real voice note (mic icon, plays inline) for Ogg files encoded
 * with Opus. Browsers record differently:
 *   - Firefox records Ogg/Opus directly            → sent as is
 *   - Chrome / Edge record WebM/Opus                → re-packed into Ogg here (same audio, no re-encoding)
 *   - Safari records MP4/AAC                        → sent as an .m4a audio file (plays, but as an audio file)
 */

export type RecordedVoice = { file: File; seconds: number; voice: boolean };

const RECORDER_TYPES = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

export function canRecordVoice(): boolean {
    return typeof window !== 'undefined'
        && typeof window.MediaRecorder !== 'undefined'
        && !!navigator.mediaDevices?.getUserMedia;
}

function pickType(): string {
    for (const t of RECORDER_TYPES) {
        try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* old browsers */ }
    }
    return '';
}

export type VoiceSession = { stop: () => Promise<RecordedVoice>; cancel: () => void };

/** Ask for the mic and start recording. Throws a friendly Error if the mic is blocked. */
export async function startVoiceNote(): Promise<VoiceSession> {
    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
        const name = (e as DOMException)?.name;
        throw new Error(name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Microphone access is blocked. Allow the microphone for this site in your browser, then try again.'
            : name === 'NotFoundError' ? 'No microphone found on this device.' : 'Couldn’t start the microphone.');
    }

    // WhatsApp wants mono voice notes. Most mics already are; fold a stereo one down to mono.
    let recStream = stream;
    let ctx: AudioContext | null = null;
    const channels = stream.getAudioTracks()[0]?.getSettings?.().channelCount;
    if (channels && channels > 1) {
        try {
            ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(stream);
            const dest = ctx.createMediaStreamDestination();
            dest.channelCount = 1;
            dest.channelCountMode = 'explicit';
            dest.channelInterpretation = 'speakers';
            src.connect(dest);
            recStream = dest.stream;
        } catch { ctx = null; recStream = stream; }
    }

    const type = pickType();
    // ~24 kbit/s keeps ~2½ minutes under WhatsApp's 512 KB "plays inline" limit; plenty for speech.
    const rec = new MediaRecorder(recStream, type ? { mimeType: type, audioBitsPerSecond: 24000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const startedAt = Date.now();
    rec.start();

    const release = () => {
        stream.getTracks().forEach((t) => t.stop());
        recStream.getTracks().forEach((t) => t.stop());
        ctx?.close().catch(() => {});
    };

    return {
        cancel() {
            rec.onstop = null;
            if (rec.state !== 'inactive') rec.stop();
            release();
        },
        stop() {
            return new Promise<RecordedVoice>((resolve, reject) => {
                rec.onstop = async () => {
                    release();
                    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
                    const recordedType = (rec.mimeType || type || chunks[0]?.type || '').toLowerCase();
                    const blob = new Blob(chunks, { type: recordedType });
                    try {
                        if (recordedType.includes('ogg')) {
                            resolve({ file: new File([blob], 'voice-note.ogg', { type: 'audio/ogg' }), seconds, voice: true });
                        } else if (recordedType.includes('webm')) {
                            const ogg = webmOpusToOgg(new Uint8Array(await blob.arrayBuffer()));
                            resolve({ file: new File([ogg], 'voice-note.ogg', { type: 'audio/ogg' }), seconds, voice: true });
                        } else {
                            resolve({ file: new File([blob], 'voice-note.m4a', { type: 'audio/mp4' }), seconds, voice: false });
                        }
                    } catch (e) {
                        reject(e instanceof Error ? e : new Error('Couldn’t prepare the voice note.'));
                    }
                };
                if (rec.state !== 'inactive') rec.stop(); else rec.onstop?.call(rec, new Event('stop'));
            });
        },
    };
}

/* ───────────── WebM (Matroska) → Ogg, Opus packets copied unchanged ───────────── */

const ID = {
    Segment: 0x18538067, Cluster: 0x1F43B675, BlockGroup: 0xA0, Tracks: 0x1654AE6B, TrackEntry: 0xAE, Audio: 0xE1,
    TrackNumber: 0xD7, CodecID: 0x86, CodecPrivate: 0x63A2, Channels: 0x9F, SimpleBlock: 0xA3, Block: 0xA1,
};
// Containers we step into rather than skip (their size is often "unknown" in live recordings).
const MASTERS = new Set([ID.Segment, ID.Cluster, ID.BlockGroup, ID.Tracks, ID.TrackEntry, ID.Audio]);

export function webmOpusToOgg(buf: Uint8Array): Uint8Array<ArrayBuffer> {
    let pos = 0;
    const vint = (keepMarker: boolean): number => {
        const first = buf[pos];
        if (first === undefined) throw new Error('Voice note recording was cut short.');
        let len = 1;
        while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
        if (len > 8) throw new Error('Voice note recording is damaged.');
        let value = keepMarker ? first : first & (0xFF >> len);
        let allOnes = value === (0xFF >> len);
        for (let i = 1; i < len; i++) {
            const b = buf[pos + i];
            value = value * 256 + b;
            if (b !== 0xFF) allOnes = false;
        }
        pos += len;
        return !keepMarker && allOnes ? -1 : value; // -1 = unknown size
    };
    const uint = (start: number, end: number) => { let v = 0; for (let i = start; i < end; i++) v = v * 256 + buf[i]; return v; };

    let opusTrack: number | null = null;
    let track: { num?: number; codec?: string; priv?: Uint8Array; channels?: number } = {};
    let head: Uint8Array | null = null;
    let channels = 1;
    const packets: Uint8Array[] = [];

    while (pos < buf.length) {
        const id = vint(true);
        const size = vint(false);
        if (MASTERS.has(id)) {
            if (id === ID.TrackEntry) track = {};
            continue;
        }
        if (size < 0) break;
        const start = pos;
        const end = Math.min(pos + size, buf.length);
        switch (id) {
            case ID.TrackNumber: track.num = uint(start, end); break;
            case ID.CodecID: track.codec = new TextDecoder().decode(buf.subarray(start, end)); break;
            case ID.CodecPrivate: track.priv = buf.slice(start, end); break;
            case ID.Channels: track.channels = uint(start, end); break;
            case ID.SimpleBlock:
            case ID.Block: {
                pos = start;
                const trackNum = vint(false);
                const flags = buf[pos + 2];
                const data = buf.subarray(pos + 3, end);
                if ((flags & 0x06) !== 0) throw new Error('This browser recorded the voice note in a format WhatsApp can’t take.');
                if (opusTrack === null || trackNum === opusTrack) packets.push(data.slice());
                break;
            }
        }
        if (track.codec === 'A_OPUS' && track.num !== undefined && opusTrack === null) {
            opusTrack = track.num;
            if (track.priv && track.priv.length >= 19) head = track.priv;
            if (track.channels) channels = track.channels;
        }
        pos = end;
    }
    if (!packets.length) throw new Error('The voice note was empty — try recording again.');

    return writeOggOpus(head ?? opusHead(channels), packets);
}

function opusHead(channels: number): Uint8Array {
    const h = new Uint8Array(19);
    h.set(new TextEncoder().encode('OpusHead'));
    const v = new DataView(h.buffer);
    h[8] = 1;               // version
    h[9] = channels;
    v.setUint16(10, 312, true); // pre-skip (encoder delay)
    v.setUint32(12, 48000, true);
    v.setInt16(16, 0, true);
    h[18] = 0;              // mapping family
    return h;
}

function opusTags(): Uint8Array {
    const vendor = new TextEncoder().encode('Property Basket');
    const t = new Uint8Array(8 + 4 + vendor.length + 4);
    t.set(new TextEncoder().encode('OpusTags'));
    new DataView(t.buffer).setUint32(8, vendor.length, true);
    t.set(vendor, 12);
    return t; // 0 user comments
}

/** Samples (at 48 kHz) in one Opus packet, from its TOC byte (RFC 6716 §3.1). */
function opusSamples(p: Uint8Array): number {
    if (!p.length) return 0;
    const toc = p[0];
    const config = toc >> 3;
    const frameMs = config < 12 ? [10, 20, 40, 60][config % 4]
        : config < 16 ? [10, 20][config % 2]
        : [2.5, 5, 10, 20][config % 4];
    const code = toc & 3;
    const frames = code === 0 ? 1 : code < 3 ? 2 : (p[1] ?? 0) & 0x3F;
    return frameMs * 48 * frames;
}

const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let r = i << 24;
        for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04C11DB7 : r << 1;
        t[i] = r >>> 0;
    }
    return t;
})();

function oggPage(type: number, granule: number, serial: number, seq: number, packets: Uint8Array[]): Uint8Array {
    const lacing: number[] = [];
    for (const p of packets) {
        for (let n = Math.floor(p.length / 255); n > 0; n--) lacing.push(255);
        lacing.push(p.length % 255);
    }
    const bodyLen = packets.reduce((s, p) => s + p.length, 0);
    const page = new Uint8Array(27 + lacing.length + bodyLen);
    const v = new DataView(page.buffer);
    page.set([0x4F, 0x67, 0x67, 0x53]); // "OggS"
    page[4] = 0;
    page[5] = type;
    v.setUint32(6, granule % 0x100000000, true);
    v.setUint32(10, Math.floor(granule / 0x100000000), true);
    v.setUint32(14, serial, true);
    v.setUint32(18, seq, true);
    page[26] = lacing.length;
    page.set(lacing, 27);
    let o = 27 + lacing.length;
    for (const p of packets) { page.set(p, o); o += p.length; }
    let crc = 0;
    for (let i = 0; i < page.length; i++) crc = ((crc << 8) ^ CRC[((crc >>> 24) ^ page[i]) & 0xFF]) >>> 0;
    v.setUint32(22, crc, true);
    return page;
}

function writeOggOpus(head: Uint8Array, packets: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const serial = (Math.random() * 0xFFFFFFFF) >>> 0;
    const pages: Uint8Array[] = [oggPage(0x02, 0, serial, 0, [head]), oggPage(0x00, 0, serial, 1, [opusTags()])];
    let seq = 2;
    let granule = 0;
    let batch: Uint8Array[] = [];
    let segs = 0;
    const flush = (last: boolean) => {
        pages.push(oggPage(last ? 0x04 : 0x00, granule, serial, seq++, batch));
        batch = [];
        segs = 0;
    };
    packets.forEach((p, i) => {
        const need = Math.floor(p.length / 255) + 1;
        if (batch.length && (segs + need > 255 || batch.length >= 50)) flush(false);
        batch.push(p);
        segs += need;
        granule += opusSamples(p);
        if (i === packets.length - 1) flush(true);
    });

    const out = new Uint8Array(pages.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of pages) { out.set(p, o); o += p.length; }
    return out;
}
