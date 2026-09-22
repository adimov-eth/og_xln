/** Native URLSession transport; signed relay framing remains in the canonical runtime. */
type Packet = {
  id: string;
  event: string;
  text?: string;
  data?: string;
  code?: number;
  reason?: string;
  bytes?: number;
};
const sockets = new Map<string, NativeSocket>();
const post = (value: unknown) =>
  (
    window as unknown as { webkit: { messageHandlers: { socket: { postMessage(v: unknown): void } } } }
  ).webkit.messageHandlers.socket.postMessage(value);
class NativeSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly id = crypto.randomUUID();
  readonly url: string;
  readyState = 0;
  bufferedAmount = 0;
  binaryType: BinaryType = 'blob';
  protocol = '';
  extensions = '';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  constructor(url: string | URL, protocols?: string | string[]) {
    super();
    if (protocols && protocols.length) throw new Error('Native socket subprotocols are not configured.');
    this.url = new URL(url).href;
    sockets.set(this.id, this);
    post({ action: 'open', id: this.id, url: this.url });
  }
  send(data: string | ArrayBufferLike | ArrayBufferView | Blob): void {
    if (this.readyState !== 1) throw new DOMException('Socket is not open.', 'InvalidStateError');
    if (typeof data === 'string') {
      const bytes = new TextEncoder().encode(data).length;
      this.bufferedAmount += bytes;
      post({ action: 'send', id: this.id, text: data, bytes });
      return;
    }
    if (data instanceof Blob) throw new TypeError('Use ArrayBuffer for native binary messages.');
    const view = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    let binary = '';
    for (const byte of view) binary += String.fromCharCode(byte);
    this.bufferedAmount += view.byteLength;
    post({ action: 'send', id: this.id, data: btoa(binary), bytes: view.byteLength });
  }
  close(code = 1000, reason = ''): void {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    post({ action: 'close', id: this.id, code, reason });
  }
  receive(packet: Packet): void {
    if (packet.event === 'sent') {
      this.bufferedAmount = Math.max(0, this.bufferedAmount - (packet.bytes ?? 0));
      return;
    }
    if (packet.event === 'open') {
      this.readyState = 1;
      const event = new Event('open');
      this.onopen?.(event);
      this.dispatchEvent(event);
    }
    if (packet.event === 'error') {
      const event = new Event('error');
      this.onerror?.(event);
      this.dispatchEvent(event);
    }
    if (packet.event === 'message') {
      const bytes = packet.data ? Uint8Array.from(atob(packet.data), c => c.charCodeAt(0)) : null;
      const data = bytes ? (this.binaryType === 'arraybuffer' ? bytes.buffer : new Blob([bytes])) : (packet.text ?? '');
      const event = new MessageEvent('message', { data });
      this.onmessage?.(event);
      this.dispatchEvent(event);
    }
    if (packet.event === 'close') {
      this.readyState = 3;
      sockets.delete(this.id);
      const event = new CloseEvent('close', {
        code: packet.code ?? 1006,
        reason: packet.reason ?? '',
        wasClean: packet.code === 1000,
      });
      this.onclose?.(event);
      this.dispatchEvent(event);
    }
  }
}
(window as unknown as { xlnSocketEvent: (packet: Packet) => void }).xlnSocketEvent = packet =>
  sockets.get(packet.id)?.receive(packet);
window.WebSocket = NativeSocket as unknown as typeof WebSocket;
