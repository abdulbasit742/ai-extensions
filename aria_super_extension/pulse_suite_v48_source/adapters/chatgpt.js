// [ARIA] V40 OMNIPOTENCE - ChatGPT Adapter
import { BaseAdapter } from './base.js';

export class ChatGPTAdapter extends BaseAdapter {
  constructor() {
    super("ChatGPT");
    this.selectors = {
      input: '#prompt-textarea',
      button: '[data-testid="send-button"]',
      thinking: '.result-streaming'
    };
  }
}
