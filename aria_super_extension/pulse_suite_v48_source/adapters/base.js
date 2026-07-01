// [ARIA] V40 OMNIPOTENCE - Base Adapter
export class BaseAdapter {
  constructor(name) {
    this.name = name;
  }
  async findInput() { throw new Error("Not implemented"); }
  async findButton() { throw new Error("Not implemented"); }
  async isThinking() { throw new Error("Not implemented"); }
}
