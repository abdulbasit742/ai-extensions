// [ARIA] V40 OMNIPOTENCE - Claude Adapter
import { BaseAdapter } from './base.js';

export class ClaudeAdapter extends BaseAdapter {
  constructor() {
    super("Claude");
    this.selectors = {
      input: '[contenteditable="true"]',
      button: 'button[aria-label="Send Message"]',
      thinking: '.typing-indicator'
    };
  }
}
