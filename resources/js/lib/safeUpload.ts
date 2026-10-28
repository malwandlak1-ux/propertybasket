/**
 * Hostinger's web-application firewall (LiteSpeed/ModSecurity) answers
 * 403 Forbidden to any multipart upload whose *filename* contains an
 * apostrophe, double quote or semicolon (e.g. "O'Brien offer.pdf") — the
 * request never reaches Laravel. Re-wrap such files under a safe name before
 * posting. Spaces, brackets, & and - are allowed and kept.
 *
 * installSafeUploads() applies this to every request (all upload forms), so
 * individual forms don't need to remember to.
 */
import axios from 'axios';
import { http } from '@inertiajs/react';

const UNSAFE = /['"`;\\<>|*?:]/g;

export function safeUploadName(name: string): string {
    const cleaned = name.replace(UNSAFE, '_').replace(/_{2,}/g, '_').trim();
    return cleaned || 'attachment';
}

export function safeUploadFile(file: File): File {
    const name = safeUploadName(file.name);
    return name === file.name ? file : new File([file], name, { type: file.type, lastModified: file.lastModified });
}

/** Same FormData with any unsafe filename re-wrapped; returns the original when nothing needed changing. */
export function safeFormData(fd: FormData): FormData {
    let changed = false;
    const out = new FormData();
    fd.forEach((value, key) => {
        if (value instanceof File) {
            const safe = safeUploadFile(value);
            if (safe !== value) changed = true;
            out.append(key, safe, safe.name);
        } else {
            out.append(key, value);
        }
    });
    return changed ? out : fd;
}

let installed = false;

export function installSafeUploads(): void {
    if (installed) return;
    installed = true;

    // Inertia router / useForm uploads (FormData is built before this runs).
    http.onRequest((config) => {
        if (config.data instanceof FormData) {
            const data = safeFormData(config.data);
            if (data !== config.data) return { ...config, data };
        }
        return config;
    });

    // Any direct axios upload.
    axios.interceptors.request.use((config) => {
        if (config.data instanceof FormData) config.data = safeFormData(config.data);
        return config;
    });
}
