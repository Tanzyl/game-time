import { io } from 'socket.io-client';
// VITE_SERVER_URL is set for cross-origin builds (itch.io); default is same-origin
const url = import.meta.env.VITE_SERVER_URL;
const opts = { autoConnect: true, transports: ['websocket', 'polling'] };
export const socket = url ? io(url, opts) : io(opts);
window.gtSocket = socket;
