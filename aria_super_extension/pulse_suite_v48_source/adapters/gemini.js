// [ARIA] V40 OMNIPOTENCE - Gemini Adapter
import { BaseAdapter } from './base.js';

export class GeminiAdapter extends BaseAdapter {
  constructor() {
    super("Gemini");
    this.selectors = {
      input: 'div[role="textbox"]',
      button: 'button[aria-label="Send message"]',
      thinking: 'progress'
    };
  }
}
