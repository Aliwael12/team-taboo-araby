import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host:true lets a phone on the same Wi-Fi reach the dev server at <your-ip>:5173
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
