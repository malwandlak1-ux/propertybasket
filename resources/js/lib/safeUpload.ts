/**
 * Hostinger's web-application firewall (LiteSpeed/ModSecurity) answers
 * 403 Forbidden to any multipart upload whose *filename* contains an
 * apostrophe, double quote or semicolon (e.g. "O'Brien offer.pdf") — the
 * request never reaches Laravel. Re-wrap such files under a safe name before
 * posting. Spaces, brackets, & and - are allowed and kept.
 */
const UNSAFE = /['"`;\\<>|*?:]/g;

export function safeUploadName(name: string): string {
    const cleaned = name.replace(UNSAFE, '_').replace(/_{2,}/g, '_').trim();
    return cleaned || 'attachment';
}

export function safeUploadFile(file: File): File {
    const name = safeUploadName(file.name);
    return name === file.name ? file : new File([file], name, { type: file.type, lastModified: file.lastModified });
}
