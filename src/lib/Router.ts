import type { InteractiveMenu } from './InteractiveMenu';

/** Bridge for MenuViews to request a different view to be rendered. */
export class Router {
  constructor(private readonly interactiveMenu: InteractiveMenu) {}

  /** Request a view swap from the InteractiveMenu parent. */
  triggerView(viewId: string, args: unknown[] = []) {
    this.interactiveMenu.swapView(viewId, args);
  }

  /** Request that the parent InteractiveMenu closes. */
  triggerClose() {
    this.interactiveMenu.closeMenu();
  }

  /** Returns the id of the InteractiveMenu parent. */
  parentId() {
    return this.interactiveMenu.id;
  }

  getParent() {
    return this.interactiveMenu;
  }
}
