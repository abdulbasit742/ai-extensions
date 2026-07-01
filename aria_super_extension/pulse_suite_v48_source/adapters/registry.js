// [ARIA] V40 OMNIPOTENCE - Adapter Registry
import { ManusAdapter } from './manus.js';
import { ChatGPTAdapter } from './chatgpt.js';
import { GeminiAdapter } from './gemini.js';
import { ClaudeAdapter } from './claude.js';
import { YouTubeAdapter } from './youtube.js';

export const Registry = {
  getAdapter: (url) => {
    if (url.includes("manus.ai")) return new ManusAdapter();
    if (url.includes("openai.com")) return new ChatGPTAdapter();
    if (url.includes("google.com")) return new GeminiAdapter();
    if (url.includes("anthropic.com")) return new ClaudeAdapter();
    if (url.includes("youtube.com")) return YouTubeAdapter;
    return null;
  }
};
